'use client';

import React, { useState } from 'react';
import { X, Clock, Calendar, Send, Trash2, AlertCircle } from 'lucide-react';
import { ScheduledMessage } from '@/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    contactName?: string;
    initialMessage?: string;
    scheduledMessages: ScheduledMessage[];
    onSchedule: (content: string, scheduledAt: string) => Promise<void>;
    onCancel: (id: string) => Promise<void>;
    isCreating: boolean;
}

const DYNAMIC_VARS = [
    { variable: '{{nome}}', description: 'Nome do contato' },
    { variable: '{{data}}', description: 'Data atual (dd/mm/aaaa)' },
    { variable: '{{hora}}', description: 'Hora atual (hh:mm)' },
];

export const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    contactName,
    initialMessage = '',
    scheduledMessages,
    onSchedule,
    onCancel,
    isCreating,
}) => {
    const [message, setMessage] = useState(initialMessage);
    const [scheduledAt, setScheduledAt] = useState('');
    const [tab, setTab] = useState<'new' | 'list'>('new');

    if (!isOpen) return null;

    const handleInsertVar = (variable: string) => {
        setMessage(prev => prev + variable);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !scheduledAt) return;
        await onSchedule(message, scheduledAt);
        setMessage('');
        setScheduledAt('');
        setTab('list');
    };

    // Min datetime must be 5 minutes from now
    const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

    const pendingMessages = scheduledMessages.filter(m => m.status === 'pending');
    const pastMessages = scheduledMessages.filter(m => m.status !== 'pending');

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-x-4 bottom-20 md:inset-auto md:bottom-24 md:right-6 md:w-[480px] z-50">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Agendar Mensagem</h3>
                                {contactName && (
                                    <p className="text-xs text-slate-500">Para: {contactName}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 dark:border-white/10">
                        {[
                            { id: 'new', label: 'Novo Agendamento', icon: Calendar },
                            { id: 'list', label: `Agendados (${pendingMessages.length})`, icon: Clock },
                        ].map(t => {
                            const Icon = t.icon;
                            const isActive = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id as 'new' | 'list')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${isActive
                                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    <Icon size={15} />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {tab === 'new' && (
                            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                                {/* Variables */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Variáveis Dinâmicas</p>
                                    <div className="flex flex-wrap gap-2">
                                        {DYNAMIC_VARS.map(v => (
                                            <button
                                                key={v.variable}
                                                type="button"
                                                onClick={() => handleInsertVar(v.variable)}
                                                title={v.description}
                                                className="px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700/50 rounded-lg text-xs font-mono hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                                            >
                                                {v.variable}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mensagem</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder={`Ex: Olá {{nome}}, sua consulta está marcada para {{data}} às {{hora}}!`}
                                        rows={4}
                                        required
                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-500 dark:text-white placeholder-slate-400"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        As variáveis <code className="font-mono">{'{{nome}}'}</code>, <code className="font-mono">{'{{data}}'}</code> e <code className="font-mono">{'{{hora}}'}</code> serão substituídas automaticamente no envio.
                                    </p>
                                </div>

                                {/* Date/Time */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data e Hora do Envio</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={e => setScheduledAt(e.target.value)}
                                        min={minDateTime}
                                        required
                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isCreating || !message.trim() || !scheduledAt}
                                    className="mt-2 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Clock size={16} />
                                    {isCreating ? 'Agendando...' : 'Agendar Mensagem'}
                                </button>
                            </form>
                        )}

                        {tab === 'list' && (
                            <div className="p-4 flex flex-col gap-3">
                                {pendingMessages.length === 0 && pastMessages.length === 0 && (
                                    <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-3">
                                        <Clock size={36} className="opacity-20" />
                                        <p className="text-sm">Nenhuma mensagem agendada para esta conversa.</p>
                                        <button
                                            onClick={() => setTab('new')}
                                            className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                                        >
                                            Criar primeiro agendamento
                                        </button>
                                    </div>
                                )}

                                {pendingMessages.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Pendentes</p>
                                        <div className="flex flex-col gap-2">
                                            {pendingMessages.map(m => (
                                                <div key={m.id} className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-700/30 rounded-xl">
                                                    <Clock size={16} className="text-primary-500 mt-0.5 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-800 dark:text-white font-medium line-clamp-2">{m.content}</p>
                                                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 flex items-center gap-1">
                                                            <Calendar size={11} />
                                                            {format(parseISO(m.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => onCancel(m.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                                        title="Cancelar agendamento"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {pastMessages.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Histórico</p>
                                        <div className="flex flex-col gap-2">
                                            {pastMessages.map(m => (
                                                <div key={m.id} className={`flex items-start gap-3 p-3 rounded-xl border ${m.status === 'sent'
                                                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30'
                                                        : m.status === 'failed'
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-700/30'
                                                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                                                    }`}>
                                                    {m.status === 'sent' ? (
                                                        <Send size={16} className="text-green-500 mt-0.5 shrink-0" />
                                                    ) : m.status === 'failed' ? (
                                                        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                                    ) : (
                                                        <X size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{m.content}</p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {format(parseISO(m.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                            {' — '}
                                                            <span className={m.status === 'sent' ? 'text-green-600' : m.status === 'failed' ? 'text-red-600' : 'text-slate-400'}>
                                                                {m.status === 'sent' ? 'Enviada' : m.status === 'failed' ? 'Falhou' : 'Cancelada'}
                                                            </span>
                                                        </p>
                                                        {m.errorMessage && (
                                                            <p className="text-[10px] text-red-500 mt-0.5">{m.errorMessage}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
