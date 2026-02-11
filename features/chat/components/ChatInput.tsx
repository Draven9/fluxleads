'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Send, Paperclip, Mic, X } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { Message, ChatSession } from '../types';

interface ChatInputProps {
    onSend: (content: string, attachment?: File | null, mentions?: string[]) => Promise<void>;
    replyingTo: Message | null;
    onCancelReply: () => void;
    session: ChatSession;
    isGroup: boolean;
    participants: { id: string, admin?: string | null }[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    replyingTo,
    onCancelReply,
    session,
    isGroup,
    participants,
}) => {
    const [newMessage, setNewMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [trackedMentions, setTrackedMentions] = useState<{ jid: string, name: string }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Focus input when replying
    useEffect(() => {
        if (replyingTo) {
            inputRef.current?.focus();
        }
    }, [replyingTo]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleSendAction = async () => {
        if (!newMessage.trim() && !attachment) return;

        // Filter mentions
        const activeMentions = trackedMentions
            .filter(m => newMessage.includes(`@${m.name}`))
            .map(m => m.jid);
        const uniqueMentions = [...new Set(activeMentions)];

        try {
            await onSend(newMessage, attachment, uniqueMentions.length > 0 ? uniqueMentions : undefined);

            setNewMessage('');
            setAttachment(null);
            setMentionQuery(null);
        } catch (error) {
            console.error('Error sending message:', error);
            // Input is NOT cleared, so user can try again
        }
    };

    const handleAudioRecorded = async (audioBlob: Blob) => {
        setIsRecording(false);
        // Create a File from Blob to reuse onSend if possible, or we might need to change onSend signature.
        // The original ChatWindow handled audio separately. 
        // Let's create a file object properly:
        const audioFile = new File([audioBlob], "audio.webm", { type: "audio/webm" });
        await onSend('', audioFile);
    };

    return (
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
                        onClick={onCancelReply}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Mention Popover */}
            {mentionQuery !== null && participants.length > 0 && (
                <div className="mx-4 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto z-50 animate-fade-in absolute bottom-16 w-[90%] md:w-[60%] lg:w-[40%]">
                    {participants
                        .filter(p => !mentionQuery || (p.id || '').toLowerCase().includes(mentionQuery.toLowerCase()) || (p.admin || '').includes(mentionQuery))
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

            <div className="p-4 relative">
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
                                            e.preventDefault();
                                            // Ideally commit mention, but here triggers send is safe enough for MVP
                                            handleSendAction();
                                        } else {
                                            e.preventDefault();
                                            handleSendAction();
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
                                    onClick={handleSendAction}
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
    );
};
