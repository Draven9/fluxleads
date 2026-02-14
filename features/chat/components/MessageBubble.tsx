import React from 'react';
import Image from 'next/image';
import { Message, ChatSession } from '../types';
import { MessageMenu } from './MessageMenu';
import { X } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
    session: ChatSession;
    isOutbound: boolean;
    isAdmin: boolean;
    onReply: (msg: Message) => void;
    onForward: (msg: Message) => void;
    onDelete: (id: string) => void;
    quotedMessage?: Message | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    session,
    isOutbound,
    isAdmin,
    onReply,
    onForward,
    onDelete,
    quotedMessage
}) => {
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
        if (msg.media_url.startsWith('SUQz')) return `data:audio/mp3;base64,${msg.media_url}`;

        // Documents
        if (msg.media_url.startsWith('JVBER')) return `data:application/pdf;base64,${msg.media_url}`;

        // Fallback logic
        if (msg.message_type === 'image') return `data:image/jpeg;base64,${msg.media_url}`;
        if (msg.message_type === 'audio') return `data:audio/ogg;base64,${msg.media_url}`;
        if (msg.message_type === 'video') return `data:video/mp4;base64,${msg.media_url}`;

        return msg.media_url;
    };

    const mediaSrc = getMediaSrc(message);

    const getFileName = (url: string) => {
        try {
            const decodedUrl = decodeURIComponent(url);
            const parts = decodedUrl.split('/');
            const fullName = parts[parts.length - 1];

            // Pattern: 13 digits timestamp + underscore
            // e.g. 1771095420206_filename.pdf
            const timestampRegex = /^\d{13}_/;
            if (timestampRegex.test(fullName)) {
                return fullName.replace(timestampRegex, '');
            }

            return fullName;
        } catch (e) {
            return 'Documento';
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Tem certeza que deseja apagar esta mensagem? Esta ação não pode ser desfeita.')) {
            onDelete(message.id);
        }
    };

    return (
        <div className={`group flex items-end gap-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            {/* Menu Button (Left for Outbound) */}
            {isOutbound && (
                <div className="mb-2">
                    <MessageMenu
                        isOutbound={isOutbound}
                        isAdmin={isAdmin}
                        onReply={() => onReply(message)}
                        onForward={() => onForward(message)}
                        onDelete={handleDelete}
                    />
                </div>
            )}

            <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm ${isOutbound
                ? 'bg-primary-600 text-white rounded-tr-none'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                }`}>

                {/* Quoted Message */}
                {quotedMessage && (
                    <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 cursor-pointer opacity-90 ${isOutbound
                        ? 'bg-primary-700/50 border-white/50 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 border-primary-500 text-slate-600 dark:text-slate-300'
                        }`}>
                        <p className="font-semibold mb-0.5">{quotedMessage.direction === 'outbound' ? 'Você' : session.contact?.name || 'Cliente'}</p>
                        <p className="truncate">{quotedMessage.content || (quotedMessage.media_url ? '[Mídia]' : 'Mensagem sem texto')}</p>
                    </div>
                )}

                {/* Media Rendering */}
                {message.media_url && (
                    <div className="mb-2">
                        {(message.message_type === 'image' || message.message_type === 'imageMessage') && (
                            <Image
                                src={mediaSrc}
                                alt="Imagem"
                                width={300}
                                height={200}
                                className="rounded-lg max-h-64 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(mediaSrc, '_blank')}
                                unoptimized={mediaSrc.startsWith('data:')} // Data URLs are already optimized-ish and next/image hates them sometimes
                            />
                        )}
                        {(message.message_type === 'audio' || message.message_type === 'audioMessage') && (
                            <audio controls className="w-full min-w-[200px]" src={mediaSrc}>Seu navegador não suporta áudio.</audio>
                        )}
                        {(message.message_type === 'video' || message.message_type === 'videoMessage') && (
                            <video controls className="rounded-lg max-h-64 w-full"><source src={mediaSrc} /></video>
                        )}
                        {(message.message_type === 'document' || message.message_type === 'documentMessage') && (
                            <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-2 p-2 rounded-lg ${isOutbound ? 'bg-primary-700/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                <span className="underline truncate max-w-[200px]" title={getFileName(mediaSrc)}>
                                    {getFileName(mediaSrc)}
                                </span>
                            </a>
                        )}
                    </div>
                )}

                {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

                <div className={`text-[10px] mt-1 text-right ${isOutbound ? 'text-primary-200' : 'text-slate-400'}`}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isOutbound && (
                        <span className="ml-1 opacity-70">
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && '✓✓'}
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
                        onReply={() => onReply(message)}
                        onForward={() => onForward(message)}
                        onDelete={handleDelete}
                    />
                </div>
            )}
        </div>
    );
};
