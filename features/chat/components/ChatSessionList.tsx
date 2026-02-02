'use client';

import React from 'react';
import { Search, User } from 'lucide-react';
import { ChatSession } from '../types';
import { useChatSessions } from '../hooks/useChatSessions';

interface ChatSessionListProps {
    selectedSessionId: string | null;
    onSelectSession: (session: ChatSession) => void;
}

export const ChatSessionList: React.FC<ChatSessionListProps> = ({ selectedSessionId, onSelectSession }) => {
    const { sessions, loading } = useChatSessions();

    // Format date utility
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header / Search */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Conversas</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">Carregando...</div>
                ) : sessions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                        Nenhuma conversa encontrada.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-white/5">
                        {sessions.map((session) => (
                            <button
                                key={session.id}
                                onClick={() => onSelectSession(session)}
                                className={`w-full p-4 flex items-center space-x-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left ${selectedSessionId === session.id ? 'bg-primary-50 dark:bg-primary-900/10 border-l-4 border-primary-500' : 'border-l-4 border-transparent'
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="relative">
                                    {session.contact?.avatar ? (
                                        <img
                                            src={session.contact.avatar}
                                            alt=""
                                            className="w-12 h-12 rounded-full object-cover bg-slate-200"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                            <User className="w-6 h-6" />
                                        </div>
                                    )}
                                    {/* Provider Icon (small badge) */}
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                                        {/* Simplified WhatsApp icon or generic */}
                                        <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-semibold text-slate-800 dark:text-white text-sm truncate">
                                            {session.contact?.name || session.provider_id || 'Desconhecido'}
                                        </h4>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap ml-2">
                                            {formatTime(session.last_message_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate pr-2">
                                            {/* We don't have snippet in session yet, would require joining updated trigger. For now just generic text or provider id */}
                                            {session.contact?.phone || session.provider_id}
                                        </p>
                                        {session.unread_count > 0 && (
                                            <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                                                {session.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
