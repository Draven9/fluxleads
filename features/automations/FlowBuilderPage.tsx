"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ReactFlow, Background, Controls, addEdge,
    BackgroundVariant, applyNodeChanges, applyEdgeChanges,
    NodeChange, EdgeChange, Connection, Edge, Node, NodeTypes,
    MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAutomations } from '@/lib/query/hooks/useAutomations';
import {
    ArrowLeft, Save, MessageSquare, Clock, Shuffle,
    ArrowRightCircle, UserCheck, Webhook, CalendarPlus,
    Play, StopCircle,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { TriggerNode, ActionNode, ConditionNode } from './components/CustomNodes';
import { NodeConfigPanel } from './components/NodeConfigPanel';

// ─────────────────────────────────────────────
// Trigger & Block definitions
// ─────────────────────────────────────────────

const TRIGGER_OPTIONS = [
    {
        group: '👤 Lead / Contato',
        items: [
            { value: 'lead_created', label: '🆕 Novo Lead Criado' },
            { value: 'lead_created_in_stage', label: '🆕 Lead Criado em Etapa Específica' },
            { value: 'tag_added', label: '🏷️ Tag Adicionada ao Lead' },
            { value: 'tag_removed', label: '🏷️ Tag Removida do Lead' },
            { value: 'owner_changed', label: '👤 Responsável Alterado' },
            { value: 'custom_field_updated', label: '📋 Campo Personalizado Atualizado' },
        ],
    },
    {
        group: '💼 Negócios (Deals)',
        items: [
            { value: 'stage_changed', label: '🔄 Negócio Movido de Etapa' },
            { value: 'deal_won', label: '🏆 Negócio Ganho (Venda)' },
            { value: 'deal_lost', label: '❌ Negócio Perdido' },
        ],
    },
    {
        group: '💬 Comunicação',
        items: [
            { value: 'message_received', label: '💬 Mensagem Recebida' },
            { value: 'message_sent', label: '📤 Mensagem Enviada' },
            { value: 'chat_initiated', label: '🟢 Chat Iniciado' },
            { value: 'form_submitted', label: '📝 Formulário Preenchido' },
        ],
    },
    {
        group: '⏰ Tempo',
        items: [
            { value: 'deal_stale', label: '⏳ Negócio Parado (Inativo)' },
            { value: 'hours_since_last_message', label: '🕐 Horas Após Última Mensagem' },
            { value: 'scheduled', label: '📅 Agendado (Recorrente)' },
        ],
    },
];

interface BlockDef {
    label: string;
    typeLabel: string;
    nodeType: string;
    icon: string;
    color: string;
    defaultText: string;
    actionType?: string;
}

const BLOCKS: BlockDef[] = [
    {
        label: 'Enviar Mensagem',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'message',
        color: 'emerald',
        defaultText: 'Enviar Mensagem',
        actionType: 'send_message',
    },
    {
        label: 'Mover Negócio de Etapa',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'move',
        color: 'amber',
        defaultText: 'Mover Negócio',
        actionType: 'move_stage',
    },
    {
        label: 'Atribuir a Vendedor',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'action',
        color: 'blue',
        defaultText: 'Atribuir Vendedor',
        actionType: 'assign_owner',
    },
    {
        label: 'Criar Atividade / Follow-up',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'action',
        color: 'green',
        defaultText: 'Criar Follow-up',
        actionType: 'create_task',
    },
    {
        label: 'Enviar Webhook',
        typeLabel: 'Integração',
        nodeType: 'action',
        icon: 'action',
        color: 'slate',
        defaultText: 'Disparar Webhook',
        actionType: 'send_webhook',
    },
    {
        label: 'Aguardar (Delay)',
        typeLabel: 'Tempo',
        nodeType: 'action',
        icon: 'delay',
        color: 'blue',
        defaultText: 'Aguardar 1 Dia',
        actionType: 'delay',
    },
    {
        label: 'Condição SE',
        typeLabel: 'Lógica',
        nodeType: 'condition',
        icon: 'condition',
        color: 'amber',
        defaultText: 'Se Condição…',
    },
    {
        label: 'Adicionar Tag',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'tag',
        color: 'violet',
        defaultText: 'Adicionar Tag',
        actionType: 'add_tag',
    },
    {
        label: 'Remover Tag',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'tag',
        color: 'rose',
        defaultText: 'Remover Tag',
        actionType: 'remove_tag',
    },
    {
        label: 'Notificar Responsável',
        typeLabel: 'Ação',
        nodeType: 'action',
        icon: 'action',
        color: 'orange',
        defaultText: 'Notificar Responsável',
        actionType: 'notify_owner',
    },
    {
        label: 'Encerrar Fluxo',
        typeLabel: 'Fim',
        nodeType: 'action',
        icon: 'stop',
        color: 'slate',
        defaultText: 'Fim do Fluxo',
        actionType: 'end',
    },
];


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function triggerLabel(value: string) {
    for (const group of TRIGGER_OPTIONS) {
        const found = group.items.find(i => i.value === value);
        if (found) return found.label;
    }
    return 'Gatilho';
}

const buildInitialNodes = (tType: string): Node[] => [
    {
        id: 'trigger-1',
        type: 'trigger',
        data: { label: triggerLabel(tType) },
        position: { x: 100, y: 60 },
    },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface FlowBuilderPageProps {
    automationId?: string;
    onClose: () => void;
}

const nodeTypes: NodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    condition: ConditionNode,
};

export const FlowBuilderPage: React.FC<FlowBuilderPageProps> = ({ automationId, onClose }) => {
    const { automations, createAutomation, updateAutomation } = useAutomations();
    const { addToast } = useToast();

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [name, setName] = useState('Nova Automação');
    const [triggerType, setTriggerType] = useState('lead_created');
    const [loading, setLoading] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const automation = useMemo(
        () => automationId ? automations.find(a => a.id === automationId) : null,
        [automationId, automations],
    );

    const [isInitialized, setIsInitialized] = useState(false);

    // Load automation state — runs ONCE when automation object changes identity
    useEffect(() => {
        if (automation) {
            setName(automation.name);
            setTriggerType(automation.trigger_type);
            setNodes((automation.nodes as Node[]) || buildInitialNodes(automation.trigger_type));
            setEdges((automation.edges as Edge[]) || []);
        } else {
            setNodes(buildInitialNodes('lead_created'));
            setEdges([]);
        }
        setIsInitialized(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [automationId]); // intentionally depends only on automationId to avoid resetting on every re-render

    // When user changes triggerType, ONLY update the trigger node label — do NOT reset all nodes
    useEffect(() => {
        if (!isInitialized) return;

        setNodes(prev => {
            const exists = prev.find(n => n.id === 'trigger-1');
            if (exists) {
                // Only update label of the existing trigger node
                return prev.map(n =>
                    n.id === 'trigger-1'
                        ? { ...n, data: { ...n.data, label: triggerLabel(triggerType) } }
                        : n,
                );
            }
            // First paint if somehow empty
            return buildInitialNodes(triggerType);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [triggerType]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes(nds => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges(eds => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect = useCallback(
        (connection: Connection) => setEdges(eds => addEdge({ ...connection, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)),
        [],
    );

    const handleSave = async () => {
        setLoading(true);
        try {
            if (automationId) {
                await updateAutomation(automationId, {
                    name,
                    trigger_type: triggerType,
                    nodes: nodes as any,
                    edges: edges as any,
                });
                addToast('Automação atualizada', 'success');
            } else {
                const result = await createAutomation(name, triggerType, nodes as any, edges as any);
                if (result) {
                    addToast('Automação criada com sucesso!', 'success');
                    onClose();
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const addBlock = (block: BlockDef) => {
        const y = 80 + nodes.length * 120;
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: block.nodeType,
            position: { x: 100, y },
            data: {
                label: block.defaultText,
                typeLabel: block.typeLabel,
                icon: block.icon,
                actionType: block.actionType,
                config: {},
            },
        };
        setNodes(nds => [...nds, newNode]);
    };

    const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onNodeConfigChange = useCallback((nodeId: string, newData: Record<string, any>) => {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
        setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev);
    }, []);

    return (
        <div className="flex flex-col h-[820px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/80 dark:bg-slate-950">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="text-base font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 min-w-[200px]"
                        placeholder="Nome da automação"
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando…' : 'Salvar'}
                </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Left Sidebar ── */}
                <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shrink-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">

                        {/* Trigger selector */}
                        <section>
                            <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                                🎯 Gatilho Principal
                            </h3>
                            <select
                                value={triggerType}
                                onChange={e => setTriggerType(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                            >
                                {TRIGGER_OPTIONS.map(group => (
                                    <optgroup key={group.group} label={group.group}>
                                        {group.items.map(item => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </section>

                        {/* Block palette */}
                        <section>
                            <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                                ➕ Adicionar Bloco
                            </h3>
                            <div className="space-y-1.5">
                                {BLOCKS.map(block => (
                                    <button
                                        key={block.label}
                                        onClick={() => addBlock(block)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all text-left group"
                                    >
                                        <BlockIcon icon={block.icon} />
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none mb-0.5">{block.typeLabel}</div>
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors leading-tight">{block.label}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Tip */}
                    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                            Arraste a bolinha de um bloco para o próximo para criar conexões.
                        </p>
                    </div>
                </aside>

                {/* ── Canvas ── */}
                <div className="flex-1 h-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.35 }}
                        minZoom={0.3}
                        maxZoom={2}
                        deleteKeyCode="Delete"
                        className="!bg-slate-50 dark:!bg-slate-950"
                        onNodeClick={onNodeClick}
                        onPaneClick={() => setSelectedNode(null)}
                    >
                        <Background
                            color="#94a3b8"
                            gap={20}
                            size={1}
                            variant={BackgroundVariant.Dots}
                            className="dark:!text-slate-700"
                        />
                        <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-sm [&>button]:!text-slate-600 dark:[&>button]:!text-slate-300" />
                        <MiniMap
                            nodeStrokeColor="#6366f1"
                            nodeBorderRadius={12}
                            className="!bg-white dark:!bg-slate-800 !border !border-slate-200 dark:!border-slate-700 !rounded-xl !shadow-sm"
                        />
                    </ReactFlow>
                </div>

                {/* ── Node Config Panel ── */}
                {selectedNode && (
                    <NodeConfigPanel
                        node={selectedNode}
                        onChange={onNodeConfigChange}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Icon helper
// ─────────────────────────────────────────────

function BlockIcon({ icon }: { icon: string }) {
    const base = "w-4 h-4 flex-shrink-0";
    switch (icon) {
        case 'message': return <MessageSquare className={`${base} text-emerald-500`} />;
        case 'move': return <ArrowRightCircle className={`${base} text-amber-500`} />;
        case 'action': return <UserCheck className={`${base} text-blue-500`} />;
        case 'delay': return <Clock className={`${base} text-sky-500`} />;
        case 'condition': return <Shuffle className={`${base} text-amber-500`} />;
        case 'stop': return <StopCircle className={`${base} text-slate-400`} />;
        default: return <Play className={`${base} text-primary-500`} />;
    }
}

export default FlowBuilderPage;
