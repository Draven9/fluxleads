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

    const sendMessage = useCallback(async (content: string, media?: { file: Blob | File, type: 'audio' | 'image' | 'document' | 'video' }) => {
        if (!sessionId || !organizationId) return;

        let mediaUrl: string | null = null;
        let messageType = 'text';

        // 1. Upload Media if present
        if (media) {
            try {
                const fileExt = media.type === 'image' ? 'jpg' : media.type === 'audio' ? 'webm' : 'bin';
                const fileName = `${organizationId}/${sessionId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(fileName, media.file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('chat-media')
                    .getPublicUrl(fileName);

                mediaUrl = publicUrl;
                messageType = media.type;
            } catch (error) {
                console.error('Error uploading media:', error);
                throw new Error('Failed to upload media');
            }
        }

        // Format sender name for text messages
        let finalContent = content;
        if (content && !mediaUrl) { // Only add signature to text messages for now, or both? Let's keep it simple.
            let senderName = 'Atendente';
            if (profile) {
                senderName = profile.first_name ||
                    profile.nickname ||
                    profile.email.split('@')[0] ||
                    'Atendente';
            }
            finalContent = `*[${senderName}]:* ${content}`;
        }

        // Send via Edge Function (saves to DB + triggers webhook)
        const { error } = await supabase.functions.invoke('chat-out', {
            body: {
                organization_id: organizationId,
                session_id: sessionId,
                content: finalContent,
                media_url: mediaUrl,
                message_type: messageType
            }
        });

        if (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }, [sessionId, organizationId, profile]);

    return { messages, loading, sendMessage };
}
