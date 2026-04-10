import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ChatSession } from '../types';

export function useChatSessions() {
    const { organizationId } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!organizationId) {
            console.log('[useChatSessions] Aguardando organizationId...');
            setLoading(false); // Libera o loading mesmo sem org para não travar a UI
            return;
        }

        // Initial Fetch
        const fetchSessions = async () => {
            console.log('[useChatSessions] Iniciando busca de sessões para org:', organizationId);
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('chat_sessions')
                    .select('*, contact:contacts(*)') // Join with contacts
                    .eq('organization_id', organizationId)
                    .order('last_message_at', { ascending: false });

                if (error) {
                    console.error('[useChatSessions] Erro ao buscar:', error);
                } else {
                    console.log('[useChatSessions] Sessões carregadas:', data?.length || 0);
                    setSessions(data as ChatSession[]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchSessions();

        // Realtime Subscription — canal único por organização para evitar colisão
        const channelId = `chat_sessions_list_${organizationId}_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE
                    schema: 'public',
                    table: 'chat_sessions',
                    filter: `organization_id=eq.${organizationId}`,
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        // Fetch the new session with contact info
                        const { data } = await supabase
                            .from('chat_sessions')
                            .select('*, contact:contacts(*)')
                            .eq('id', payload.new.id)
                            .single();

                        if (data) {
                            setSessions((prev) => {
                                // Avoid duplicates
                                if (prev.some(s => s.id === data.id)) return prev;
                                return [data as ChatSession, ...prev];
                            });
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        setSessions((prev) => {
                            const updatedSession = payload.new as ChatSession;
                            const existing = prev.find(s => s.id === updatedSession.id);

                            const merged = existing ? { ...existing, ...updatedSession } : updatedSession;

                            const newList = prev.map(s => s.id === merged.id ? merged : s);
                            return newList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                        });
                    }
                }
            )
            .subscribe();

        // Fallback HTTP Polling mechanism (in case WebSocket is blocked by Antivirus/AdBlock/Network)
        const pollInterval = setInterval(async () => {
            const { data } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)')
                .eq('organization_id', organizationId)
                .order('last_message_at', { ascending: false })
                .limit(50); // Get latest 50 to sync state efficiently

            if (data && data.length > 0) {
                setSessions((prev) => {
                    let updated = [...prev];
                    let hasChanges = false;
                    for (const serverSession of data) {
                        const existing = updated.find(s => s.id === serverSession.id);
                        if (!existing) {
                            hasChanges = true;
                            updated.push(serverSession as ChatSession);
                        } else if (
                            existing.last_message_at !== serverSession.last_message_at ||
                            existing.unread_count !== serverSession.unread_count ||
                            existing.is_marked_unread !== serverSession.is_marked_unread
                        ) {
                            hasChanges = true;
                            // update existing
                            updated = updated.map(s => s.id === existing.id ? { ...s, ...serverSession } as ChatSession : s);
                        }
                    }
                    if (hasChanges) {
                        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                    }
                    return prev;
                });
            }
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [organizationId]);

    const createOrGetSession = async (
        contactId: string,
        provider: string = 'whatsapp',
        providerId?: string
    ): Promise<ChatSession | null> => {
        if (!organizationId) return null;

        try {
            console.log(`[useChatSessions] Tentando abrir sessão para contato: ${contactId}`);

            // 1. Check for existing session (Simplificamos a query para evitar erros de join no UUID)
            const { data: existing, error: findError } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('contact_id', contactId)
                .maybeSingle();

            if (findError) {
                console.error('[useChatSessions] Erro ao buscar sessão:', findError);
                throw findError;
            }

            let finalProviderId = providerId || existing?.provider_id;

            // 2. Fetch contact info if needed
            const { data: contact, error: contactError } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single();

            if (contactError) {
                console.error('[useChatSessions] Erro ao buscar contato:', contactError);
            }

            if (!finalProviderId && contact?.phone) {
                const phone = contact.phone.trim();
                finalProviderId = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            }

            if (existing) {
                console.log('[useChatSessions] Sessão existente encontrada:', existing.id);
                // Attach contact if missing
                const sessionWithContact = { ...existing, contact } as ChatSession;
                
                // Add to list if not present
                setSessions(prev => {
                    if (prev.some(s => s.id === sessionWithContact.id)) return prev;
                    return [sessionWithContact, ...prev];
                });

                return sessionWithContact;
            }

            if (!finalProviderId) {
                console.warn('[useChatSessions] Não foi possível determinar o provider_id (telefone faltando)');
                return null;
            }

            // 3. Create new session
            console.log('[useChatSessions] Criando nova sessão no banco...', {
                org: organizationId,
                contact: contactId,
                providerId: finalProviderId
            });

            // Tenta o insert. Se falhar por RLS, o erro aparecerá aqui.
            const { data: inserted, error: insertError } = await supabase
                .from('chat_sessions')
                .insert({
                    organization_id: organizationId,
                    contact_id: contactId,
                    provider,
                    provider_id: finalProviderId,
                    name: contact?.name || finalProviderId,
                    updated_at: new Date().toISOString(),
                })
                .select() // Deixamos o select vazio para ver se ele infere corretamente
                .maybeSingle();

            if (insertError) {
                console.error('[useChatSessions] Erro no INSERT:', insertError);
                if (insertError.code === '23505') {
                    console.log('[useChatSessions] Concorrência: sessão já existia.');
                    const { data: retry } = await supabase
                        .from('chat_sessions')
                        .select('*')
                        .eq('contact_id', contactId)
                        .maybeSingle();
                    return retry ? { ...retry, contact } as ChatSession : null;
                }
                throw insertError;
            }

            const res = { ...inserted, contact } as ChatSession;
            console.log('[useChatSessions] Sessão criada com sucesso:', res.id);
            setSessions(prev => [res, ...prev]);
            return res;

        } catch (err: any) {
            console.error('[useChatSessions] Erro crítico na sessão:', err.message || err);
            return null;
        }
    };

    const deleteSession = async (sessionId: string) => {
        // Optimistic Update
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting session:', error);
            // Optionally fetch sessions again to revert logic
        }
    };

    const toggleMarkUnread = async (sessionId: string, currentStatus: boolean) => {
        // Optimistic
        setSessions((prev) => prev.map(s =>
            s.id === sessionId ? { ...s, is_marked_unread: !currentStatus } : s
        ));

        const { error } = await supabase
            .from('chat_sessions')
            .update({ is_marked_unread: !currentStatus })
            .eq('id', sessionId);

        if (error) {
            console.error('Error toggling unread:', error);
            // Revert
            setSessions((prev) => prev.map(s =>
                s.id === sessionId ? { ...s, is_marked_unread: currentStatus } : s
            ));
        }
    };

    return { sessions, loading, createOrGetSession, deleteSession, toggleMarkUnread };
}
