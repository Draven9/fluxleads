'use client';

import { ArrowLeft, Send, User, Paperclip, Mic, X, Trash2, Reply, Loader2 } from 'lucide-react';
import { ChatSession, Message } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';
import { useGroupParticipants } from '../hooks/useGroupParticipants';
import { useAuth } from '@/context/AuthContext';
import { AudioRecorder } from './AudioRecorder';
import { MessageMenu } from './MessageMenu';
import { ForwardModal } from './ForwardModal';
import { supabase } from '@/lib/supabase';

interface ChatWindowProps {
    session: ChatSession;
    onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, onBack }) => {
    const { messages, loading, sendMessage, deleteMessage, loadMore, hasMore } = useChatMessages(session.id);
    const { profile, organizationId } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Group Mentions State
    const isGroup = session.contact?.source === 'whatsapp_group';
    const providerId = session.provider_id || '';
    const groupJid = providerId.includes('@g.us')
        ? providerId
        : (session.contact?.phone && session.contact.phone.includes('-') ? `${session.contact.phone}@g.us` : providerId);
    // Heuristic for JID if provider_id is just number. Groups usually have explicit JID in provider_id or we construct it.

    // Actually, provider_id IS the JID usually.

    const { participants, fetchParticipants } = useGroupParticipants(session.provider_id, isGroup);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [trackedMentions, setTrackedMentions] = useState<{ jid: string, name: string }[]>([]);

    useEffect(() => {
        if (isGroup && mentionQuery !== null) {
            fetchParticipants();
        }
    }, [isGroup, mentionQuery, fetchParticipants]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);
    const lastMessageIdRef = useRef<string | null>(null);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); // changed to auto to match instant feel, smooth can be dizzying on load
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
                prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight; // Save height BEFORE load
            }
            loadMore?.();
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() && !attachment) return;

        const msgContent = newMessage;
        const msgAttachment = attachment;
        const replyToId = replyingTo?.id;

        setNewMessage('');
        setAttachment(null);
        setReplyingTo(null);

        try {
            if (msgAttachment) {
                let type: 'image' | 'video' | 'document' | 'audio' = 'document';
                if (msgAttachment.type.startsWith('image/')) type = 'image';
                else if (msgAttachment.type.startsWith('video/')) type = 'video';
                else if (msgAttachment.type.startsWith('audio/')) type = 'audio';

                await sendMessage(msgContent, { file: msgAttachment, type }, replyToId);
            } else {
                // Filter mentions that are actually in the final text
                const activeMentions = trackedMentions
                    .filter(m => msgContent.includes(`@${m.name}`))
                    .map(m => m.jid);

                // Unique JIDs
                const uniqueMentions = [...new Set(activeMentions)];

                await sendMessage(msgContent, undefined, replyToId, uniqueMentions.length > 0 ? uniqueMentions : undefined);
            }
        } catch (error) {
            console.error('Failed to send', error);
            // Optionally restore state on error
        }
    };

    const handleAudioRecorded = async (audioBlob: Blob) => {
        setIsRecording(false);
        try {
            await sendMessage('', { file: audioBlob, type: 'audio' });
        } catch (error) {
            console.error('Failed to send audio', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDelete = async (messageId: string) => {
        if (window.confirm('Tem certeza que deseja apagar esta mensagem? Esta ação não pode ser desfeita.')) {
            await deleteMessage(messageId);
        }
    };

    const handleReply = (msg: Message) => {
        setReplyingTo(msg);
        inputRef.current?.focus();
    };

    const handleForwardToSession = async (targetSessionId: string) => {
        if (!forwardingMessage || !organizationId) return;

        try {
            // Invoke Edge Function directly to send to other session
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
            {/* Header */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center space-x-3 shadow-sm z-10 shrink-0">
                <button onClick={onBack} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">
                    <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Contact Info */}
                <div className="relative">
                    {session.contact?.avatar ? (
                        <img src={session.contact.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <User className="w-5 h-5" />
                        </div>
                    )}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${session.provider === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                </div>

                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{session.contact?.name || session.provider_id}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{session.provider} • {session.contact?.phone || session.provider_id}</span>
                </div>
            </div>

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

                    const getMediaSrc = (msg: Message) => {
                        if (!msg.media_url) return '';
                        if (msg.media_url.startsWith('http') || msg.media_url.startsWith('data:')) return msg.media_url;

                        // Detect MIME type from Base64 signature
                        if (msg.media_url.startsWith('/9j/')) return `data:image/jpeg;base64,${msg.media_url}`;
                        if (msg.media_url.startsWith('iVBORw0')) return `data:image/png;base64,${msg.media_url}`;
                        if (msg.media_url.startsWith('R0lGOD')) return `data:image/gif;base64,${msg.media_url}`;
                        if (msg.media_url.startsWith('UklGR')) return `data:image/webp;base64,${msg.media_url}`;

                        // Audio
                        if (msg.media_url.startsWith('T2dnUw')) return `data:audio/ogg;base64,${msg.media_url}`;
                        if (msg.media_url.startsWith('SUQz')) return `data:audio/mp3;base64,${msg.media_url}`; // ID3 tag

                        // Documents
                        if (msg.media_url.startsWith('JVBER')) return `data:application/pdf;base64,${msg.media_url}`;

                        // Videos (MP4 usually starts with ....ftyp or similar, harder to detect by fixed start if header varies, but often:)
                        // AAAA... ftypisom

                        // Fallback logic using message_type if available
                        if (msg.message_type === 'image') return `data:image/jpeg;base64,${msg.media_url}`; // Default assumption
                        if (msg.message_type === 'audio') return `data:audio/ogg;base64,${msg.media_url}`;
                        if (msg.message_type === 'video') return `data:video/mp4;base64,${msg.media_url}`;

                        return msg.media_url;
                    };

                    const mediaSrc = getMediaSrc(msg);

                    return (
                        <div key={msg.id} className={`group flex items-end gap-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>

                            {/* Menu Button (Left for Outbound) */}
                            {isOutbound && (
                                <div className="mb-2">
                                    <MessageMenu
                                        isOutbound={isOutbound}
                                        isAdmin={isAdmin}
                                        onReply={() => handleReply(msg)}
                                        onForward={() => setForwardingMessage(msg)}
                                        onDelete={() => handleDelete(msg.id)}
                                    />
                                </div>
                            )}

                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm ${isOutbound
                                ? 'bg-primary-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                                }`}>

                                {/* Quoted Message */}
                                {quotedMsg && (
                                    <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 cursor-pointer opacity-90 ${isOutbound
                                        ? 'bg-primary-700/50 border-white/50 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 border-primary-500 text-slate-600 dark:text-slate-300'
                                        }`}>
                                        <p className="font-semibold mb-0.5">{quotedMsg.direction === 'outbound' ? 'Você' : session.contact?.name || 'Cliente'}</p>
                                        <p className="truncate">{quotedMsg.content || (quotedMsg.media_url ? '[Mídia]' : 'Mensagem sem texto')}</p>
                                    </div>
                                )}

                                {/* Media Rendering (Simplified logic from before, just ensure it works) */}
                                {msg.media_url && (
                                    <div className="mb-2">
                                        {(msg.message_type === 'image' || msg.message_type === 'imageMessage') && (
                                            <img src={mediaSrc} alt="Imagem" className="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(mediaSrc, '_blank')} />
                                        )}
                                        {(msg.message_type === 'audio' || msg.message_type === 'audioMessage') && (
                                            <audio controls className="w-full min-w-[200px]" src={mediaSrc}>Seu navegador não suporta áudio.</audio>
                                        )}
                                        {(msg.message_type === 'video' || msg.message_type === 'videoMessage') && (
                                            <video controls className="rounded-lg max-h-64 w-full"><source src={mediaSrc} /></video>
                                        )}
                                        {(msg.message_type === 'document' || msg.message_type === 'documentMessage') && (
                                            <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-2 p-2 rounded-lg ${isOutbound ? 'bg-primary-700/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                                <span className="underline truncate max-w-[200px]">Abrir Documento</span>
                                            </a>
                                        )}
                                    </div>
                                )}

                                {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

                                <div className={`text-[10px] mt-1 text-right ${isOutbound ? 'text-primary-200' : 'text-slate-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {isOutbound && (
                                        <span className="ml-1 opacity-70">
                                            {msg.status === 'sent' && '✓'}
                                            {msg.status === 'delivered' && '✓✓'}
                                            {msg.status === 'read' && '✓✓'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Menu Button (Right for Inbound) */}
                            {!isOutbound && (
                                <div className="mb-2">
                                    <MessageMenu
                                        isOutbound={isOutbound}
                                        isAdmin={isAdmin}
                                        onReply={() => handleReply(msg)}
                                        onForward={() => setForwardingMessage(msg)}
                                        onDelete={() => handleDelete(msg.id)}
                                    />
                                </div>
                            )}

                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 shrink-0">

                {/* Reply Preview */}
                {replyingTo && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between animate-slide-up">
                        <div className="border-l-4 border-primary-500 pl-3 flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-0.5">
                                Respondendo a {replyingTo.direction === 'outbound' ? 'Você' : session.contact?.name || 'Cliente'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                {replyingTo.media_url && !replyingTo.content ? (
                                    <>
                                        {replyingTo.message_type === 'image' && '📷 Imagem'}
                                        {replyingTo.message_type === 'video' && '🎥 Vídeo'}
                                        {replyingTo.message_type === 'audio' && '🎵 Áudio'}
                                        {replyingTo.message_type === 'document' && '📄 Documento'}
                                        {!['image', 'video', 'audio', 'document'].includes(replyingTo.message_type || '') && '📎 Anexo'}
                                    </>
                                ) : (
                                    replyingTo.content
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => setReplyingTo(null)}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Mention Popover */}
                {mentionQuery !== null && participants.length > 0 && (
                    <div className="mx-4 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto z-50 animate-fade-in">
                        {participants
                            .filter(p => !mentionQuery || (p.id || '').toLowerCase().includes(mentionQuery.toLowerCase()) || (p.admin || '').includes(mentionQuery)) // Filtering by ID/Phone part for now since name isn't always available in participant list from Evolution v2 depending on fetch
                            // Actually Evolution returns { id, admin }. It might NOT return name unless contact saved.
                            // We might need to assume ID is the "name" to show if no name resolve.
                            // Let's rely on ID for now.
                            .map((participant) => {
                                const displayName = participant.id.split('@')[0];
                                return (
                                    <button
                                        key={participant.id}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between group"
                                        onClick={() => {
                                            const lastAtPos = newMessage.lastIndexOf('@');
                                            const prefix = newMessage.substring(0, lastAtPos);
                                            const suffix = newMessage.substring(lastAtPos + 1 + (mentionQuery || '').length);

                                            const insertName = displayName;

                                            setNewMessage(`${prefix}@${insertName} ${suffix}`);
                                            setTrackedMentions(prev => [...prev, { jid: participant.id, name: insertName }]);
                                            setMentionQuery(null);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">
                                            {displayName}
                                        </span>
                                        {participant.admin && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">
                                                {participant.admin}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                )}

                <div className="p-4">
                    {isRecording ? (
                        <AudioRecorder onAudioRecorded={handleAudioRecorded} onCancel={() => setIsRecording(false)} />
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Attachment Preview */}
                            {attachment && (
                                <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg animate-fade-in">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{attachment.name}</span>
                                    <button onClick={() => setAttachment(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                                        <X className="w-4 h-4 text-slate-500" />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-end space-x-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-3 rounded-xl transition-colors h-[44px] w-[44px] flex items-center justify-center ${attachment ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                <textarea
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNewMessage(val);

                                        // Simple Mention Trigger detection
                                        const lastAtPos = val.lastIndexOf('@');
                                        if (lastAtPos !== -1 && isGroup) {
                                            const textAfterAt = val.substring(lastAtPos + 1);
                                            // Check if there are spaces after @ (allow valid name search, but stop if newline or special chars?)
                                            if (!textAfterAt.includes('\n')) {
                                                setMentionQuery(textAfterAt);
                                            } else {
                                                setMentionQuery(null);
                                            }
                                        } else {
                                            setMentionQuery(null);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            if (mentionQuery !== null) {
                                                // Prevent send if selecting mention (optional, hard to coordinate with click)
                                                // For now, let's assume Enter sends message unless we have complex navigation
                                                e.preventDefault();
                                                // TODO: Implement arrow key nav for mentions if requested
                                                handleSend();
                                            } else {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }
                                    }}
                                    placeholder="Digite uma mensagem..."
                                    rows={1}
                                    className="flex-1 p-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 transition-all max-h-32 min-h-[44px] text-slate-900 dark:text-white placeholder-slate-500"
                                    style={{ minHeight: '44px' }}
                                />

                                {newMessage.trim() || attachment ? (
                                    <button
                                        onClick={handleSend}
                                        className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors h-[44px] w-[44px] flex items-center justify-center"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsRecording(true)}
                                        className="p-3 bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors h-[44px] w-[44px] flex items-center justify-center"
                                    >
                                        <Mic className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ForwardModal
                isOpen={!!forwardingMessage}
                onClose={() => setForwardingMessage(null)}
                onForward={handleForwardToSession}
            />
        </div>
    );
};
