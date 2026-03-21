"use client";

import React, { useState } from 'react';
import { useAutomations } from '@/lib/query/hooks/useAutomations';
import { Plus, Settings2, PlayCircle, Clock, Search, Copy, Trash2, SearchX, MousePointerClick, Zap, Loader2 } from 'lucide-react';
// import { useNavigate } from 'react-router-dom'; se houver rotas. 

export const AutomationsListPage: React.FC<{ onOpenBuilder: (id?: string) => void }> = ({ onOpenBuilder }) => {
    const { automations, loading, toggleStatus, deleteAutomation, duplicateAutomation } = useAutomations();
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = automations.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTriggerIcon = (type: string) => {
        switch (type) {
            case 'lead_created': return <Plus className="w-4 h-4" />;
            case 'stage_changed': return <MousePointerClick className="w-4 h-4" />;
            case 'message_received': return <Zap className="w-4 h-4" />;
            default: return <Settings2 className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                        Automações
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Crie fluxos automáticos para otimizar seus processos.
                    </p>
                </div>
                <button
                    onClick={() => onOpenBuilder()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-sm shadow-primary-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nova Automação
                </button>
            </div>

            {automations.length > 0 ? (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar automações..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        />
                    </div>

                    <div className="grid gap-3">
                        {filtered.map(automation => (
                            <div
                                key={automation.id}
                                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-primary-300 dark:hover:border-primary-800 transition-colors cursor-pointer"
                                onClick={() => onOpenBuilder(automation.id)}
                            >
                                <div className="flex items-center gap-4 flex-1 w-full">
                                    <div className={`p-3 rounded-xl flex-shrink-0 transition-colors ${automation.active
                                            ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {getTriggerIcon(automation.trigger_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                                                {automation.name}
                                            </h3>
                                            {!automation.active && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                                                    Inativo
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                                            {automation.description || 'Sem descrição'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-slate-100 dark:border-slate-800 sm:border-t-0">
                                    <div className="flex gap-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-1.5" title="Vezes executada">
                                            <PlayCircle className="w-4 h-4" />
                                            {automation.run_count}
                                        </div>
                                        <div className="flex items-center gap-1.5" title="Última execução">
                                            <Clock className="w-4 h-4" />
                                            {automation.last_run_at
                                                ? new Date(automation.last_run_at).toLocaleDateString()
                                                : 'Nunca'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => toggleStatus(automation.id, automation.active)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 ${automation.active ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            title={automation.active ? 'Desativar' : 'Ativar'}
                                        >
                                            <span className="sr-only">Toggle</span>
                                            <span aria-hidden="true" className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${automation.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); duplicateAutomation(automation.id); }}
                                            className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Duplicar automação"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteAutomation(automation.id); }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Excluir automação"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filtered.length === 0 && (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                <SearchX className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">Nenhuma automação encontrada.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-500/10 mb-4">
                        <Zap className="w-8 h-8 text-primary-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhuma automação ainda</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                        Crie sua primeira automação para enviar mensagens, atualizar etapas de negócios ou atribuir tags automaticamente.
                    </p>
                    <button
                        onClick={() => onOpenBuilder()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Criar Automação
                    </button>
                </div>
            )}
        </div>
    );
};

export default AutomationsListPage;
