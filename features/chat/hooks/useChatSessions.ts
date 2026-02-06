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

        // Realtime Subscription
        const channel = supabase
            .channel('chat_sessions_list')
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
                            setSessions((prev) => [data as ChatSession, ...prev]);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        setSessions((prev) => {
                            const updatedSession = payload.new as ChatSession;
                            const existing = prev.find(s => s.id === updatedSession.id);

                            // Preserve the contact info if not fetched again (simplified)
                            // Ideally we might want to re-fetch if relations change, but for unread count updates/timestamp this is faster
                            const merged = existing ? { ...existing, ...updatedSession } : updatedSession;

                            // Re-sort
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

    const createOrGetSession = async (contactId: string): Promise<string | null> => {
        if (!organizationId) return null;

        // Check locally first (opt) or just DB check
        // Check DB for existing session
        const { data: existing } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('contact_id', contactId)
            .single();

        if (existing) {
            return existing.id;
        }

        // Create new
        const { data: newSession, error } = await supabase
            .from('chat_sessions')
            .insert({
                organization_id: organizationId,
                contact_id: contactId,
                provider: 'whatsapp', // Default
                unread_count: 0
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error creating session:', error);
            return null;
        }
        return newSession.id;
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

    return { sessions, loading, createOrGetSession, deleteSession };
}
