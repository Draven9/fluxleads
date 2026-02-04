import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Message } from '../types';

export function useChatMessages(sessionId: string | null) {
    const { organizationId, profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch Messages
    useEffect(() => {
        if (!sessionId || !organizationId) return;

        const fetchMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
            } else {
                setMessages(data as Message[]);
            }
            setLoading(false);
        };

        fetchMessages();

        // Mark as read (Clear unread count)
        // We defer this slightly or call it on mount of chat window
        supabase
            .from('chat_sessions')
            .update({ unread_count: 0 })
            .eq('id', sessionId)
            .then();

        // Realtime Subscription
        const channel = supabase
            .channel(`chat_messages_${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as Message]);

                    // If message is inbound, we should technically mark as read if user is looking at it
                    // But strict read receipts require more complex logic. 
                    // For now, we assume if window is open, it's read.
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, organizationId]);

    const sendMessage = useCallback(async (content: string) => {
        if (!sessionId || !organizationId) return;

        // Format message with signature
        // Example: *[João]:* Olá, tudo bem?
        const senderName = profile?.first_name || profile?.nickname || 'Atendente';
        const finalContent = `*[${senderName}]:* ${content}`;

        // Send via Edge Function (saves to DB + triggers webhook)
        const { error } = await supabase.functions.invoke('chat-out', {
            body: {
                organization_id: organizationId,
                session_id: sessionId,
                content: finalContent
            }
        });

        if (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }, [sessionId, organizationId]);

    return { messages, loading, sendMessage };
}
