import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ChatSession } from '../types';

export function useChatSessions() {
    const { organizationId } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!organizationId) return;

        // Initial Fetch
        const fetchSessions = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)') // Join with contacts
                .eq('organization_id', organizationId)
                .order('last_message_at', { ascending: false });

            if (error) {
                console.error('Error fetching sessions:', error);
            } else {
                setSessions(data as ChatSession[]);
            }
            setLoading(false);
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

        let finalProviderId = providerId;

        // When called without a specific providerId (e.g. from ChatLayout), look up
        // an existing session by contact_id first.
        if (!finalProviderId) {
            const { data: existing } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)')
                .eq('organization_id', organizationId)
                .eq('contact_id', contactId)
                .maybeSingle();

            if (existing) {
                // If it exists but lacks provider_id, we need to try and fix it
                if (!existing.provider_id && existing.contact?.phone) {
                    const phone = existing.contact.phone;
                    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                    
                    const { data: updated } = await supabase
                        .from('chat_sessions')
                        .update({ provider_id: jid })
                        .eq('id', existing.id)
                        .select('*, contact:contacts(*)')
                        .single();
                    
                    if (updated) {
                        setSessions(prev => prev.some(s => s.id === updated.id) ? prev.map(s => s.id === updated.id ? (updated as ChatSession) : s) : [updated as ChatSession, ...prev]);
                        return updated as ChatSession;
                    }
                }

                // Ensure it's in local state so the UI selects it immediately
                setSessions(prev => prev.some(s => s.id === existing.id) ? prev : [existing as ChatSession, ...prev]);
                return existing as ChatSession;
            }

            // If not found in sessions, we NEED the contact's phone to create a valid provider_id
            const { data: contact } = await supabase
                .from('contacts')
                .select('phone')
                .eq('id', contactId)
                .single();
            
            if (contact?.phone) {
                finalProviderId = contact.phone.includes('@') ? contact.phone : `${contact.phone}@s.whatsapp.net`;
            }
        }

        // 1. Tentar encontrar a sessão existente primeiro para evitar erro de RLS com upsert
        const { data: existing } = await supabase
            .from('chat_sessions')
            .select('*, contact:contacts(*)')
            .eq('organization_id', organizationId)
            .eq('contact_id', contactId)
            .maybeSingle();

        if (existing) {
            // 2. Se já existe, apenas atualizamos provider_id se necessário e incrementamos data
            const { data: updated, error: updateError } = await supabase
                .from('chat_sessions')
                .update({
                    provider_id: finalProviderId || existing.provider_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select('*, contact:contacts(*)')
                .single();
            
            const res = (updated || existing) as ChatSession;
            setSessions(prev => {
                const existingIdx = prev.findIndex(s => s.id === res.id);
                if (existingIdx !== -1) {
                    const copy = [...prev];
                    copy[existingIdx] = res;
                    return copy;
                }
                return [res, ...prev];
            });
            return res;
        }

        // 3. Se não existe, inserimos uma nova
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
            console.error('[useChatSessions] Falha ao criar sessão:', insertError);
            return null;
        }

        const res = inserted as ChatSession;
        setSessions(prev => [res, ...prev]);
        return res;
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
