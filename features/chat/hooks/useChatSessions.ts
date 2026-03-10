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
        const channel = supabase
            .channel(`chat_sessions_list_${organizationId}`)
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId]);

    const createOrGetSession = async (
        contactId: string,
        provider: string = 'whatsapp',
        providerId?: string
    ): Promise<string | null> => {
        if (!organizationId) return null;

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

        return data.id;
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
