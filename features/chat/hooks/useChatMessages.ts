import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Message } from '../types';
import { toast } from 'react-hot-toast';

const MESSAGES_PER_PAGE = 50;

export function useChatMessages(sessionId: string | null) {
    const { organizationId, profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    // Fetch Messages (Initial Load)
    useEffect(() => {
        if (!sessionId || !organizationId) return;

        const fetchInitialMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('messages')
                .select('*, reply_to_message_id')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false }) // Get newest first
                .range(0, MESSAGES_PER_PAGE - 1);

            if (error) {
                toast.error('Erro ao carregar mensagens.');
            } else {
                // Reverse to display chronologically (oldest at top)
                setMessages((data as Message[]).reverse());
                setHasMore(data.length === MESSAGES_PER_PAGE);
                setPage(1);
            }
            setLoading(false);
        };

        fetchInitialMessages();

        // Mark as read
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
                    // Start Optimistic UI handled by sendMessage, but for incoming:
                    const newMsg = payload.new as Message;
                    setMessages((prev) => {
                        // Avoid duplicates if optimistic update already added it
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, organizationId]);

    const loadMore = useCallback(async () => {
        if (!sessionId || !hasMore || loading) return;

        setLoading(true);
        const from = page * MESSAGES_PER_PAGE;
        const to = from + MESSAGES_PER_PAGE - 1;

        const { data, error } = await supabase
            .from('messages')
            .select('*, reply_to_message_id')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            toast.error('Erro ao carregar mensagens antigas.');
        } else {
            if (data.length > 0) {
                const olderMessages = (data as Message[]).reverse();
                setMessages(prev => [...olderMessages, ...prev]);
                setPage(prev => prev + 1);
                setHasMore(data.length === MESSAGES_PER_PAGE);
            } else {
                setHasMore(false);
            }
        }
        setLoading(false);
    }, [sessionId, hasMore, loading, page]);

    const sendMessage = useCallback(async (content: string, media?: { file: Blob | File, type: 'audio' | 'image' | 'document' | 'video' }, replyToId?: string, mentions?: string[]) => {
        if (!sessionId || !organizationId) return;

        let mediaUrl: string | null = null;
        let messageType = 'text';
        let mediaName: string | undefined = undefined;

        // 1. Upload Media if present
        if (media) {
            const toastId = toast.loading('Enviando mídia...');
            try {
                // Get extension from original file name if possible, otherwise fallback
                const fileObj = media.file as File;
                const originalName = fileObj.name;
                mediaName = originalName; // Capture original name for display

                const fileExt = originalName ? originalName.split('.').pop() : (media.type === 'image' ? 'jpg' : media.type === 'audio' ? 'webm' : 'bin');

                // Determine MIME type
                const mimeType = fileObj.type || (media.type === 'image' ? 'image/jpeg' : media.type === 'audio' ? 'audio/webm' : 'application/octet-stream');

                // If no name found (e.g. Blob), generate one based on type
                if (!mediaName) {
                    mediaName = `file.${fileExt}`;
                }

                // Sanitize filename to be URL-safe but readable
                // Remove special chars, spaces to underscores, keep alphanumeric and dots/hyphens
                const safeName = originalName
                    ? originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
                    : `file.${fileExt}`;

                // Construct a path that includes the sanitized original name
                // e.g., organization/session/timestamp_My_Contract.pdf
                const fileName = `${organizationId}/${sessionId}/${Date.now()}_${safeName}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(fileName, media.file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: mimeType // Explicitly set content type
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('chat-media')
                    .getPublicUrl(fileName);

                mediaUrl = publicUrl;
                messageType = media.type;
                toast.dismiss(toastId);
            } catch (error) {
                console.error('Error uploading media:', error);
                toast.error('Erro ao enviar mídia.', { id: toastId });
                throw new Error('Failed to upload media');
            }
        }

        // Format sender name for text messages
        let finalContent = content;
        if (content && !mediaUrl) {
            let senderName = 'Atendente';
            if (profile) {
                senderName = profile.first_name ||
                    profile.nickname ||
                    profile.email.split('@')[0] ||
                    'Atendente';
            }
            finalContent = `*[${senderName}]:* ${content}`;
        }

        // Optimistic UI Update
        const tempId = crypto.randomUUID();
        const optimisticMessage: Message = {
            id: tempId,
            organization_id: organizationId,
            session_id: sessionId,
            direction: 'outbound',
            content: finalContent,
            message_type: messageType as any,
            media_url: mediaUrl || (media ? URL.createObjectURL(media.file) : undefined),
            status: 'sending',
            created_at: new Date().toISOString(),
            reply_to_message_id: replyToId
        };
        setMessages((prev) => [...prev, optimisticMessage]);

        // Send via Edge Function (saves to DB + triggers webhook)
        const { error } = await supabase.functions.invoke('chat-out', {
            body: {
                organization_id: organizationId,
                session_id: sessionId,
                content: finalContent,
                media_url: mediaUrl,
                media_name: mediaName, // Pass captured original filename
                media_mimetype: media?.file?.type || (messageType === 'image' ? 'image/jpeg' : messageType === 'audio' ? 'audio/webm' : 'application/octet-stream'),
                message_type: messageType,
                reply_to_message_id: replyToId,
                mentions: mentions
            }
        });

        if (error) {
            console.error('Error sending message:', error);
            toast.error('Erro ao enviar mensagem.');
            // Remove optimistic message on error? Or mark as failed?
            // Ideally mark as failed, but for now let's keep it simple.
            setMessages(prev => prev.filter(m => m.id !== tempId));
            throw error;
        }
    }, [sessionId, organizationId, profile]);

    const deleteMessage = useCallback(async (messageId: string) => {
        // Optimistic Update
        const previousMessages = [...messages];
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error('Error deleting message:', error);
            toast.error('Erro ao apagar mensagem.');
            setMessages(previousMessages); // Rollback
        } else {
            toast.success('Mensagem apagada.');
        }
    }, [messages]);

    return { messages, loading, sendMessage, deleteMessage, loadMore, hasMore };
}
