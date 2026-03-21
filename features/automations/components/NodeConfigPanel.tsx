"use client";

import React from 'react';
import { Node } from '@xyflow/react';
import { X } from 'lucide-react';

interface NodeConfigPanelProps {
    node: Node;
    onChange: (nodeId: string, newData: Record<string, any>) => void;
    onClose: () => void;
}

const CONDITION_FIELDS = [
    { value: 'stage_id', label: 'Etapa' },
    { value: 'tags', label: 'Tags' },
    { value: 'channel', label: 'Canal' },
    { value: 'owner_id', label: 'Responsável' },
    { value: 'is_won', label: 'Ganho?' },
    { value: 'is_lost', label: 'Perdido?' },
];

const CONDITION_OPERATORS = [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'é diferente de' },
    { value: 'contains', label: 'contém' },
    { value: 'not_contains', label: 'não contém' },
    { value: 'is_set', label: 'está preenchido' },
    { value: 'is_empty', label: 'está vazio' },
];

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, onChange, onClose }) => {
    const data = node.data as Record<string, any>;
    const config = (data.config || {}) as Record<string, any>;
    const condition = (data.condition || {}) as Record<string, any>;
    const actionType = data.actionType as string | undefined;

    const setConfig = (patch: Record<string, any>) =>
        onChange(node.id, { config: { ...config, ...patch } });

    const setCondition = (patch: Record<string, any>) =>
        onChange(node.id, { condition: { ...condition, ...patch } });

    const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";
    const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1";

    const renderForm = () => {
        if (node.type === 'condition') {
            return (
                <>
                    <div>
                        <label className={labelCls}>Campo</label>
                        <select className={inputCls} value={condition.field || ''} onChange={e => setCondition({ field: e.target.value })}>
                            <option value="">Selecione…</option>
                            {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Operador</label>
                        <select className={inputCls} value={condition.operator || ''} onChange={e => setCondition({ operator: e.target.value })}>
                            <option value="">Selecione…</option>
                            {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    {condition.operator && !['is_set', 'is_empty'].includes(condition.operator) && (
                        <div>
                            <label className={labelCls}>Valor</label>
                            <input className={inputCls} value={condition.value || ''} onChange={e => setCondition({ value: e.target.value })} placeholder="Ex: Qualificado" />
                        </div>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Saída <span className="text-emerald-500 font-semibold">verde (esq)</span> = Sim · <span className="text-rose-500 font-semibold">vermelha (dir)</span> = Não
                    </p>
                </>
            );
        }

        switch (actionType) {
            case 'send_message':
                return (
                    <>
                        <div>
                            <label className={labelCls}>Mensagem</label>
                            <textarea
                                className={inputCls}
                                rows={5}
                                value={config.message || ''}
                                onChange={e => setConfig({ message: e.target.value })}
                                placeholder="Olá {{nome}}, tudo bem?"
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Variáveis: <code>{'{{nome}}'}</code> <code>{'{{empresa}}'}</code> <code>{'{{data}}'}</code> <code>{'{{hora}}'}</code>
                        </p>
                    </>
                );

            case 'move_stage':
                return (
                    <div>
                        <label className={labelCls}>ID da Etapa</label>
                        <input className={inputCls} value={config.stage_id || ''} onChange={e => setConfig({ stage_id: e.target.value })} placeholder="UUID da etapa" />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Cole o UUID da etapa de destino.</p>
                    </div>
                );

            case 'add_tag':
            case 'remove_tag':
                return (
                    <div>
                        <label className={labelCls}>{actionType === 'add_tag' ? 'Tag a Adicionar' : 'Tag a Remover'}</label>
                        <input className={inputCls} value={config.tag || ''} onChange={e => setConfig({ tag: e.target.value })} placeholder="Ex: cliente-vip" />
                    </div>
                );

            case 'assign_owner':
                return (
                    <div>
                        <label className={labelCls}>ID do Responsável</label>
                        <input className={inputCls} value={config.user_id || ''} onChange={e => setConfig({ user_id: e.target.value })} placeholder="UUID do usuário" />
                    </div>
                );

            case 'create_task':
                return (
                    <>
                        <div>
                            <label className={labelCls}>Título da Tarefa</label>
                            <input className={inputCls} value={config.title || ''} onChange={e => setConfig({ title: e.target.value })} placeholder="Ligar para o cliente" />
                        </div>
                        <div>
                            <label className={labelCls}>Prazo (dias a partir de agora)</label>
                            <input type="number" min={0} className={inputCls} value={config.due_days ?? ''} onChange={e => setConfig({ due_days: Number(e.target.value) })} placeholder="1" />
                        </div>
                    </>
                );

            case 'notify_owner':
                return (
                    <div>
                        <label className={labelCls}>Mensagem para o Responsável</label>
                        <textarea className={inputCls} rows={4} value={config.message || ''} onChange={e => setConfig({ message: e.target.value })} placeholder="Novo lead chegou: {{nome}}" />
                    </div>
                );

            case 'send_webhook':
                return (
                    <div>
                        <label className={labelCls}>URL do Webhook</label>
                        <input className={inputCls} value={config.url || ''} onChange={e => setConfig({ url: e.target.value })} placeholder="https://…" />
                    </div>
                );

            case 'delay':
                return (
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className={labelCls}>Quantidade</label>
                            <input type="number" min={1} className={inputCls} value={config.amount ?? ''} onChange={e => setConfig({ amount: Number(e.target.value) })} placeholder="1" />
                        </div>
                        <div className="flex-1">
                            <label className={labelCls}>Unidade</label>
                            <select className={inputCls} value={config.unit || 'hours'} onChange={e => setConfig({ unit: e.target.value })}>
                                <option value="minutes">Minutos</option>
                                <option value="hours">Horas</option>
                                <option value="days">Dias</option>
                            </select>
                        </div>
                    </div>
                );

            case 'end':
                return <p className="text-sm text-slate-400 dark:text-slate-500">Este nó encerra o fluxo. Sem configuração necessária.</p>;

            default:
                return <p className="text-sm text-slate-400 dark:text-slate-500">Selecione um nó de ação para configurar.</p>;
        }
    };

    return (
        <aside className="w-72 h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shrink-0 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configurar Nó</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[180px]">{data.label as string}</div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Form */}
            <div className="flex-1 px-4 py-4 space-y-4">
                {renderForm()}
            </div>
        </aside>
    );
};
