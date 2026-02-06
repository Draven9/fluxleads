import React, { useState } from 'react';
import { X, Search, Send, User } from 'lucide-react';
import { useChatSessions } from '../hooks/useChatSessions';
import { ChatSession } from '../types';

interface ForwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onForward: (targetSessionId: string) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, onClose, onForward }) => {
    const { sessions, loading } = useChatSessions();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    if (!isOpen) return null;

    const filteredSessions = sessions.filter(s =>
        (s.contact?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (s.contact?.phone || '').includes(searchTerm) ||
        s.provider_id.includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Encaminhar para...</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar conversa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <p className="text-center text-slate-500 py-4">Carregando...</p>
                    ) : filteredSessions.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">Nenhuma conversa encontrada.</p>
                    ) : (
                        filteredSessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => setSelectedSessionId(session.id)}
                                className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors text-left ${selectedSessionId === session.id
                                        ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {session.contact?.avatar ? (
                                    <img src={session.contact.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                        <User className="w-5 h-5" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 dark:text-white truncate">
                                        {session.contact?.name || session.provider_id}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {session.contact?.phone}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button
                        disabled={!selectedSessionId}
                        onClick={() => selectedSessionId && onForward(selectedSessionId)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        <Send className="w-4 h-4" /> Enviar
                    </button>
                </div>
            </div>
        </div>
    );
};
