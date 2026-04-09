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
            // 1. Check for existing session
            const { data: existing, error: findError } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)')
                .eq('organization_id', organizationId)
                .eq('contact_id', contactId)
                .maybeSingle();

            if (findError) throw findError;

            let finalProviderId = providerId || existing?.provider_id;

            // 2. If no providerId yet, we must fetch the contact's phone
            if (!finalProviderId) {
                const { data: contact } = await supabase
                    .from('contacts')
                    .select('phone')
                    .eq('id', contactId)
                    .single();
                
                if (contact?.phone) {
                    finalProviderId = contact.phone.includes('@') ? contact.phone : `${contact.phone}@s.whatsapp.net`;
                }
            }

            if (existing) {
                // 3. Update existing session if needed (e.g. provider_id was missing)
                const updates: any = { updated_at: new Date().toISOString() };
                if (finalProviderId && !existing.provider_id) {
                    updates.provider_id = finalProviderId;
                }

                const { data: updated, error: updateError } = await supabase
                    .from('chat_sessions')
                    .update(updates)
                    .eq('id', existing.id)
                    .select('*, contact:contacts(*)')
                    .single();

                const res = (updated || existing) as ChatSession;
                setSessions(prev => {
                    const idx = prev.findIndex(s => s.id === res.id);
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = res;
                        return copy;
                    }
                    return [res, ...prev];
                });
                return res;
            }

            // 4. Create new session
            const { data: inserted, error: insertError } = await supabase
                .from('chat_sessions')
                .insert({
                    organization_id: organizationId,
                    contact_id: contactId,
                    provider,
                    provider_id: finalProviderId,
                    updated_at: new Date().toISOString(),
                })
                .select('*, contact:contacts(*)')
                .single();

            if (insertError) {
                // Handle race condition: if it was created by someone else in the meantime
                if (insertError.code === '23505') {
                    const { data: retry } = await supabase
                        .from('chat_sessions')
                        .select('*, contact:contacts(*)')
                        .eq('contact_id', contactId)
                        .single();
                    if (retry) {
                        const res = retry as ChatSession;
                        setSessions(prev => [res, ...prev]);
                        return res;
                    }
                }
                throw insertError;
            }

            const res = inserted as ChatSession;
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
