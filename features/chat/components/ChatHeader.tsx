import React from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { ChatSession } from '../types';

interface ChatHeaderProps {
    session: ChatSession;
    onBack: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ session, onBack }) => {
    return (
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
    );
};
