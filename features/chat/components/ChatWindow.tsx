'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, User, Paperclip, Mic, X, Trash2 } from 'lucide-react';
import { ChatSession } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';
import { useAuth } from '@/context/AuthContext';
import { AudioRecorder } from './AudioRecorder';

interface ChatWindowProps {
    session: ChatSession;
    onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, onBack }) => {
    const { messages, loading, sendMessage, deleteMessage } = useChatMessages(session.id);
    const { profile } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!newMessage.trim() && !attachment) return;

        const msgContent = newMessage;
        const msgAttachment = attachment;

        setNewMessage('');
        setAttachment(null);

        try {
            if (msgAttachment) {
                let type: 'image' | 'video' | 'document' | 'audio' = 'document';
                if (msgAttachment.type.startsWith('image/')) type = 'image';
                else if (msgAttachment.type.startsWith('video/')) type = 'video';
                else if (msgAttachment.type.startsWith('audio/')) type = 'audio';

                await sendMessage(msgContent, { file: msgAttachment, type });
            } else {
                await sendMessage(msgContent);
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

    return (
        <div className="flex flex-col h-full">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-black/20 scroll-smooth">
                {loading && messages.length === 0 && (
                    <div className="flex justify-center p-4">
                        <span className="text-slate-400 text-sm">Carregando mensagens...</span>
                    </div>
                )}

                {messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';

                    const getMediaSrc = (msg: typeof messages[0]) => { // Using typeof messages[0] to infer Message type
                        if (!msg.media_url) return '';
                        if (msg.media_url.startsWith('http') || msg.media_url.startsWith('data:')) return msg.media_url;

                        // Detect common Base64 magic bytes
                        const isOgg = msg.media_url.startsWith('T2dnUw');
                        const isJpeg = msg.media_url.startsWith('/9j/');
                        const isPng = msg.media_url.startsWith('iVBORw0');

                        if (msg.message_type === 'audio' || msg.message_type === 'audioMessage') {
                            // WhatsApp voice notes are often OGG (Opus)
                            const mime = isOgg ? 'audio/ogg' : 'audio/mp4';
                            return `data:${mime};base64,${msg.media_url}`;
                        }

                        if (msg.message_type === 'image' || msg.message_type === 'imageMessage') {
                            const mime = isPng ? 'image/png' : 'image/jpeg';
                            return `data:${mime};base64,${msg.media_url}`;
                        }

                        return msg.media_url;
                    };

                    const mediaSrc = getMediaSrc(msg);

                    return (
                        <div key={msg.id} className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                            {/* Delete Button (Left for Outbound) */}
                            {isOutbound && isAdmin && (
                                <div className="flex items-center px-2">
                                    <button
                                        onClick={() => handleDelete(msg.id)}
                                        className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                        title="Apagar mensagem"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm ${isOutbound
                                ? 'bg-primary-600 text-white rounded-tr-none'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                                }`}>

                                {/* Media Rendering */}
                                {msg.media_url && (
                                    <div className="mb-2">
                                        {(msg.message_type === 'image' || msg.message_type === 'imageMessage') && (
                                            <img
                                                src={mediaSrc}
                                                alt="Imagem"
                                                className="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => window.open(mediaSrc, '_blank')}
                                            />
                                        )}
                                        {(msg.message_type === 'audio' || msg.message_type === 'audioMessage') && (
                                            <audio controls className="w-full min-w-[200px]" src={mediaSrc}>
                                                Seu navegador não suporta áudio.
                                            </audio>
                                        )}
                                        {(msg.message_type === 'video' || msg.message_type === 'videoMessage') && (
                                            <video controls className="rounded-lg max-h-64 w-full">
                                                <source src={mediaSrc} />
                                                Seu navegador não suporta vídeo.
                                            </video>
                                        )}
                                        {(msg.message_type === 'document' || msg.message_type === 'documentMessage') && (
                                            <a
                                                href={mediaSrc}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`flex items-center space-x-2 p-2 rounded-lg ${isOutbound ? 'bg-primary-700/50' : 'bg-slate-100 dark:bg-slate-700'}`}
                                            >
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

                            {/* Delete Button (Right for Inbound) */}
                            {!isOutbound && isAdmin && (
                                <div className="flex items-center px-2">
                                    <button
                                        onClick={() => handleDelete(msg.id)}
                                        className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                        title="Apagar mensagem"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 shrink-0">
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
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
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
    );
};
