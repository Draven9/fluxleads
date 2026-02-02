'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, User } from 'lucide-react';
import { ChatSession } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';

interface ChatWindowProps {
    session: ChatSession;
    onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ session, onBack }) => {
    const { messages, loading, sendMessage } = useChatMessages(session.id);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        const msg = newMessage;
        setNewMessage(''); // Optimistic clear
        try {
            await sendMessage(msg);
        } catch (error) {
            console.error('Failed to send', error);
            setNewMessage(msg); // Restore on failure
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-16 px-4 border-b border-slate-200 bg-white flex items-center space-x-3 shadow-sm z-10 shrink-0">
                <button onClick={onBack} className="md:hidden p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>

                {/* Contact Info */}
                <div className="relative">
                    {session.contact?.avatar ? (
                        <img src={session.contact.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                            <User className="w-5 h-5" />
                        </div>
                    )}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${session.provider === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                </div>

                <div>
                    <h3 className="font-semibold text-slate-800">{session.contact?.name || session.provider_id}</h3>
                    <span className="text-xs text-slate-500 capitalize">{session.provider} • {session.contact?.phone || session.provider_id}</span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
                {loading && messages.length === 0 && (
                    <div className="flex justify-center p-4">
                        <span className="text-slate-400 text-sm">Carregando mensagens...</span>
                    </div>
                )}

                {messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                        <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm ${isOutbound
                                    ? 'bg-primary-600 text-white rounded-tr-none'
                                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                }`}>
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex items-end space-x-2">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite uma mensagem..."
                        rows={1}
                        className="flex-1 p-3 bg-slate-100 border-none rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all max-h-32 min-h-[44px]"
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        className="p-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors h-[44px] w-[44px] flex items-center justify-center"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
