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

    // Track pending optimistic message IDs so we can replace them
    // when the real INSERT event arrives from Supabase Realtime.
    const pendingTempIds = useRef<Set<string>>(new Set());
    
    // Store latest fetched message date for polling
    const lastMessageDateRef = useRef(new Date().toISOString());

    // Fetch Messages (Initial Load)
    useEffect(() => {
        if (!sessionId || !organizationId) return;

        // Reset state on session change
        setMessages([]);
        setHasMore(true);
        setPage(0);
        pendingTempIds.current.clear();
        lastMessageDateRef.current = new Date().toISOString();

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
                const fetched = (data || []) as Message[];
                if (fetched.length > 0) {
                    lastMessageDateRef.current = fetched[0].created_at;
                    // Reverse to display chronologically (oldest at top)
                    setMessages(fetched.reverse());
                    setHasMore(data.length === MESSAGES_PER_PAGE);
                    setPage(1);
                } else {
                    // AUTO-SYNC LOGIC: If no messages locally, try to pull from Evolution
                    try {
                        // 1. Get the session to find the provider_id (JID)
                        const { data: session } = await supabase
                            .from('chat_sessions')
                            .select('provider_id')
                            .eq('id', sessionId)
                            .single();

                        if (session?.provider_id) {
                            // 2. Trigger background sync via proxy
                            const { whatsappService } = await import('@/lib/supabase/whatsapp');
                            await whatsappService.syncHistory(sessionId, session.provider_id);
                        }
                    } catch (syncErr) {
                        console.error('[useChatMessages] Auto-sync failed:', syncErr);
                    } finally {
                        // RE-FETCH: After sync attempt (success or fail), we try to load again 
                        // to show whatever the proxy managed to save.
                        const { data: finalData } = await supabase
                            .from('messages')
                            .select('*, reply_to_message_id')
                            .eq('session_id', sessionId)
                            .order('created_at', { ascending: false })
                            .limit(MESSAGES_PER_PAGE);

                        if (finalData && finalData.length > 0) {
                            const mapped = (finalData as Message[]).reverse();
                            setMessages(mapped);
                            lastMessageDateRef.current = mapped[mapped.length - 1].created_at;
                            setHasMore(finalData.length === MESSAGES_PER_PAGE);
                            setPage(1);
                        }
                    }
                }
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
        const channelId = `chat_messages_${sessionId}_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    if (newMsg.created_at > lastMessageDateRef.current) {
                        lastMessageDateRef.current = newMsg.created_at;
                    }
                    setMessages((prev) => {
                        // Always check for the real message ID first to avoid duplicates
                        // when polling and realtime race with the same base state.
                        if (prev.some(m => m.id === newMsg.id)) return prev;

                        // If we have a pending optimistic message, replace it
                        // with the confirmed real message from the DB.
                        if (pendingTempIds.current.size > 0) {
                            const tempId = pendingTempIds.current.values().next().value;
                            if (tempId) {
                                pendingTempIds.current.delete(tempId);
                                return prev.map(m => m.id === tempId ? newMsg : m);
                            }
                        }

                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        // Fallback HTTP Polling mechanism (in case WebSocket is blocked by Antivirus/AdBlock/Network)
        const pollInterval = setInterval(async () => {
            const { data } = await supabase
                .from('messages')
                .select('*, reply_to_message_id')
                .eq('session_id', sessionId)
                .gt('created_at', lastMessageDateRef.current)
                .order('created_at', { ascending: true });

            if (data && data.length > 0) {
                lastMessageDateRef.current = data[data.length - 1].created_at;
                setMessages((prev) => {
                    // Filter out messages already in the list (by real ID) — must check first
                    // before consuming tempIds, to avoid duplicate when realtime already handled it.
                    const newMessages = data.filter((nMsg: any) => !prev.some(pMsg => pMsg.id === nMsg.id));
                    if (newMessages.length === 0) return prev;

                    let updated = [...prev];
                    for (const nMsg of newMessages) {
                        // Check again with accumulated state to avoid duplicates within the batch
                        if (updated.some(m => m.id === (nMsg as Message).id)) continue;

                        if (pendingTempIds.current.size > 0) {
                             const tempId = pendingTempIds.current.values().next().value;
                             if (tempId) {
                                 pendingTempIds.current.delete(tempId);
                                 updated = updated.map(m => m.id === tempId ? (nMsg as Message) : m);
                                 continue;
                             }
                        }
                        updated.push(nMsg as Message);
                    }
                    return updated;
                });
            }
        }, 4000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
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
                const safeName = originalName
                    ? originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
                    : `file.${fileExt}`;

                const fileName = `${organizationId}/${sessionId}/${Date.now()}_${safeName}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(fileName, media.file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: mimeType
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

        // Optimistic UI Update — track tempId so Realtime can replace it
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

        // Register tempId BEFORE adding to state so Realtime handler sees it
        pendingTempIds.current.add(tempId);
        setMessages((prev) => [...prev, optimisticMessage]);

        // Send via Edge Function (saves to DB + triggers webhook)
        const { error } = await supabase.functions.invoke('chat-out', {
            body: {
                organization_id: organizationId,
                session_id: sessionId,
                content: finalContent,
                media_url: mediaUrl,
                media_name: mediaName,
                media_mimetype: media?.file?.type || (messageType === 'image' ? 'image/jpeg' : messageType === 'audio' ? 'audio/webm' : 'application/octet-stream'),
                message_type: messageType,
                reply_to_message_id: replyToId,
                mentions: mentions
            }
        });

        if (error) {
            console.error('Error sending message:', error);
            toast.error('Erro ao enviar mensagem.');
            // Remove the optimistic message on error
            pendingTempIds.current.delete(tempId);
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
