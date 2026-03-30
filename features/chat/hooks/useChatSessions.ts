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

        // When called without a specific providerId (e.g. from ChatLayout), look up
        // an existing session by contact_id first. This avoids creating a duplicate
        // session with provider_id = null, since ON CONFLICT (organization_id, provider_id)
        // does not match NULL values in Postgres (NULL != NULL).
        if (!providerId) {
            const { data: existing } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)')
                .eq('organization_id', organizationId)
                .eq('contact_id', contactId)
                .maybeSingle();

            if (existing) {
                // Ensure it's in local state so the UI selects it immediately
                setSessions(prev => prev.some(s => s.id === existing.id) ? prev : [existing as ChatSession, ...prev]);
                return existing as ChatSession;
            }
        }

        // Upsert idempotente: ON CONFLICT em (organization_id, contact_id)
        // Eliminando race conditions onde webhooks simultâneos criam sessões duplicadas
        const { data, error } = await supabase
            .from('chat_sessions')
            .upsert(
                {
                    organization_id: organizationId,
                    contact_id: contactId,
                    provider,
                    ...(providerId ? { provider_id: providerId } : {}),
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'organization_id,contact_id',
                    ignoreDuplicates: false,
                }
            )
            .select('id')
            .single();

        if (error) {
            console.error('[useChatSessions] createOrGetSession upsert failed:', error);
            return null;
        }

        if (data?.id) {
            // Fetch full object to put in local state immediately without waiting for realtime
            const { data: fullSession } = await supabase
                .from('chat_sessions')
                .select('*, contact:contacts(*)')
                .eq('id', data.id)
                .single();

            if (fullSession) {
                setSessions(prev => {
                    const existingIdx = prev.findIndex(s => s.id === fullSession.id);
                    if (existingIdx !== -1) {
                        const copy = [...prev];
                        copy[existingIdx] = fullSession as ChatSession;
                        return copy;
                    }
                    return [fullSession as ChatSession, ...prev];
                });
                return fullSession as ChatSession;
            }
        }

        return null;
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
