import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Mail, MailOpen } from 'lucide-react';

interface SessionMenuProps {
    isAdmin: boolean;
    isUnread: boolean;
    onToggleUnread: () => void;
    onDelete: () => void;
}

export const SessionMenu: React.FC<SessionMenuProps> = ({ isAdmin, isUnread, onToggleUnread, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="p-1 px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            >
                <MoreVertical className="w-4 h-4" />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-50 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => { onToggleUnread(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                        {isUnread ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                        {isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                    </button>
                    {isAdmin && (
                        <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                            <Trash2 className="w-4 h-4" /> Apagar conversa
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
