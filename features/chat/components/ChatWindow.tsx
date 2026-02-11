'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatSession, Message } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';
import { useGroupParticipants } from '../hooks/useGroupParticipants';
import { useAuth } from '@/context/AuthContext';
import { ForwardModal } from './ForwardModal';
import { supabase } from '@/lib/supabase';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatWindowProps {
    session: ChatSession;
    onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, onBack }) => {
    const { messages, loading, sendMessage, deleteMessage, loadMore, hasMore } = useChatMessages(session.id);
    const { profile, organizationId } = useAuth();
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Group Mentions State
    const isGroup = session.contact?.source === 'whatsapp_group';
    const { participants, fetchParticipants } = useGroupParticipants(session.provider_id, isGroup);

    // Fetch participants on load if group
    useEffect(() => {
        if (isGroup) {
            fetchParticipants();
        }
    }, [isGroup, fetchParticipants]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);
    const lastMessageIdRef = useRef<string | null>(null);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    // Smart Scroll Logic
    useEffect(() => {
        if (messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        const isNewMessage = lastMsg?.id !== lastMessageIdRef.current;

        // Only scroll to bottom if it's a NEW message at the end (sent or received)
        // OR if it's the very first load.
        if (isNewMessage || lastMessageIdRef.current === null) {
            scrollToBottom();
        } else {
            // It was a "prepend" (load more). Maintain scroll position.
            if (scrollContainerRef.current && prevScrollHeightRef.current) {
                const newScrollHeight = scrollContainerRef.current.scrollHeight;
                const diff = newScrollHeight - prevScrollHeightRef.current;
                scrollContainerRef.current.scrollTop = diff;
                prevScrollHeightRef.current = 0; // Reset
            }
        }

        lastMessageIdRef.current = lastMsg?.id || null;
    }, [messages]);

    useEffect(() => {
        if (replyingTo) scrollToBottom();
    }, [replyingTo]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;

        if (scrollTop === 0 && hasMore && !loading) {
            // User hit top, load more
            if (scrollContainerRef.current) {
                prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
            }
            loadMore?.();
        }
    };

    const handleSend = async (content: string, attachment?: File | null, mentions?: string[]) => {
        const replyToId = replyingTo?.id;
        setReplyingTo(null);

        try {
            if (attachment) {
                let type: 'image' | 'video' | 'document' | 'audio' = 'document';
                if (attachment.type.startsWith('image/')) type = 'image';
                else if (attachment.type.startsWith('video/')) type = 'video';
                else if (attachment.type.startsWith('audio/')) type = 'audio';

                await sendMessage(content, { file: attachment, type }, replyToId);
            } else {
                await sendMessage(content, undefined, replyToId, mentions);
            }
        } catch (error) {
            console.error('Failed to send', error);
        }
    };

    const handleForwardToSession = async (targetSessionId: string) => {
        if (!forwardingMessage || !organizationId) return;

        try {
            const { error } = await supabase.functions.invoke('chat-out', {
                body: {
                    organization_id: organizationId,
                    session_id: targetSessionId,
                    content: forwardingMessage.content,
                    media_url: forwardingMessage.media_url,
                    message_type: forwardingMessage.message_type,
                    is_forwarded: true,
                    forward_original_message_id: forwardingMessage.id
                }
            });

            if (error) throw error;
            setForwardingMessage(null);
            alert('Mensagem encaminhada com sucesso!');
        } catch (error) {
            console.error('Error forwarding:', error);
            alert('Erro ao encaminhar mensagem.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            <ChatHeader session={session} onBack={onBack} />

            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-black/20"
            >
                {loading && hasMore && (
                    <div className="flex justify-center p-2">
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                )}
                {loading && !hasMore && messages.length === 0 && (
                    <div className="flex justify-center p-4">
                        <span className="text-slate-400 text-sm">Carregando mensagens...</span>
                    </div>
                )}

                {messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    const quotedMsg = msg.reply_to_message_id
                        ? messages.find(m => m.id === msg.reply_to_message_id)
                        : null;

                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            session={session}
                            isOutbound={isOutbound}
                            isAdmin={isAdmin}
                            onReply={setReplyingTo}
                            onForward={setForwardingMessage}
                            onDelete={deleteMessage}
                            quotedMessage={quotedMsg}
                        />
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <ChatInput
                onSend={handleSend}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                session={session}
                isGroup={isGroup}
                participants={participants}
            />

            <ForwardModal
                isOpen={!!forwardingMessage}
                onClose={() => setForwardingMessage(null)}
                onForward={handleForwardToSession}
            />
        </div>
    );
};
