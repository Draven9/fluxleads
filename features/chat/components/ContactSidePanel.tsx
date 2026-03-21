'use client';

import React, { useState } from 'react';
import { User, X, Briefcase, Phone, Mail, Tag, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { ChatSession } from '../types';
import { useCRM } from '@/context/CRMContext';
import { toast } from 'react-hot-toast';
import { ConversationSentiment } from './ConversationSentiment';

interface ContactSidePanelProps {
    session: ChatSession;
    isOpen: boolean;
    onClose: () => void;
}

export const ContactSidePanel: React.FC<ContactSidePanelProps> = ({ session, isOpen, onClose }) => {
    const { contact, deal_id } = session;
    const { deals, boards, updateDeal } = useCRM();
    const [isUpdating, setIsUpdating] = useState(false);

    if (!isOpen) return null;

    // Se temos deal_id na sessão, buscamos o deal na store
    const currentDeal = deals.find(d => d.id === deal_id);
    // Mas a sessão pode não ter deal_id atrelado (ainda), então tentamos buscar pelo contato se não tiver
    const deal = currentDeal || deals.find(d => d.contactId === contact?.id && !d.isWon && !d.isLost);

    const activeBoard = deal ? boards.find(b => b.id === deal.boardId) : null;
    const currentStage = activeBoard?.stages.find(s => s.id === deal?.status);

    const handleStageChange = async (newStageId: string) => {
        if (!deal || newStageId === deal.status) return;

        setIsUpdating(true);
        try {
            await updateDeal(deal.id, { status: newStageId });
            toast.success('Etapa atualizada com sucesso!');
        } catch (error) {
            toast.error('Erro ao atualizar etapa.');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="w-80 h-full border-l border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col shrink-0 custom-scrollbar z-20">
            {/* Header */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-slate-800 dark:text-white">Detalhes do Contato</h3>
                <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Profile Overview */}
                <div className="flex flex-col items-center text-center space-y-3">
                    {contact?.avatar ? (
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-slate-50 dark:border-slate-800 shadow-sm">
                            <Image
                                src={contact.avatar}
                                alt={contact.name || "Avatar"}
                                fill
                                className="object-cover"
                                sizes="96px"
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 border-4 border-white dark:border-slate-900 shadow-sm">
                            <User className="w-10 h-10" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                            {contact?.name || session.provider_id}
                        </h2>
                        {contact?.role && (
                            <p className="text-sm text-slate-500">{contact.role}</p>
                        )}
                    </div>
                </div>

                {/* Quick Info */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center space-x-3 text-sm text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{contact?.phone || session.provider_id}</span>
                    </div>
                    {contact?.email && (
                        <div className="flex items-center space-x-3 text-sm text-slate-600 dark:text-slate-300">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{contact.email}</span>
                        </div>
                    )}
                </div>

                {/* Deal Info */}
                {deal && activeBoard ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <Briefcase className="w-4 h-4 text-blue-500" />
                                <span>Negócio Ativo</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}
                            </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-900 dark:text-white mb-2 truncate" title={deal.title}>
                                {deal.title}
                            </p>

                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Etapa do Funil</label>
                                <div className="relative">
                                    <select
                                        disabled={isUpdating}
                                        value={deal.status}
                                        onChange={(e) => handleStageChange(e.target.value)}
                                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                        {(activeBoard.stages ?? []).map((stage) => (
                                            <option key={stage.id} value={stage.id}>
                                                {stage.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Tags */}
                        {deal.tags && deal.tags.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                    <Tag className="w-4 h-4 text-pink-500" />
                                    <span>Tags</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {deal.tags.map((tag, i) => (
                                        <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4 text-center space-y-2">
                        <Briefcase className="w-6 h-6 text-amber-500 mx-auto" />
                        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Nenhum negócio ativo</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400/80">Este contato ainda não possui um negócio em aberto no funil.</p>
                    </div>
                )}

                {/* 4.3 — Análise de Sentimento */}
                <ConversationSentiment
                    sessionId={session.id}
                    messageCount={0}
                />
            </div>
        </div>
    );
};
