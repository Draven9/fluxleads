"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, addEdge, BackgroundVariant, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAutomations } from '@/lib/query/hooks/useAutomations';
import { ArrowLeft, Play, Save, Settings2, Trash2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

// Tailwind custom styled node types could be imported here
// For this v1 we'll use default nodes and simple custom nodes

const initialNodes: Node[] = [
    {
        id: 'trigger-1',
        type: 'input',
        data: { label: 'Gatilho: Lead Criado' },
        position: { x: 250, y: 50 },
    },
];

interface FlowBuilderPageProps {
    automationId?: string;
    onClose: () => void;
}

export const FlowBuilderPage: React.FC<FlowBuilderPageProps> = ({ automationId, onClose }) => {
    const { automations, createAutomation, updateAutomation, deleteAutomation } = useAutomations();
    const { addToast } = useToast();

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [name, setName] = useState('Nova Automação');
    const [triggerType, setTriggerType] = useState('lead_created');
    const [loading, setLoading] = useState(false);

    const automation = automationId ? automations.find(a => a.id === automationId) : null;

    useEffect(() => {
        if (automation) {
            setName(automation.name);
            setTriggerType(automation.trigger_type);
            setNodes(automation.nodes as any || initialNodes);
            setEdges(automation.edges as any || []);
        } else {
            setNodes(initialNodes);
            setEdges([]);
        }
    }, [automation]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect = useCallback(
        (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
        []
    );

    const handleSave = async () => {
        setLoading(true);
        try {
            if (automationId) {
                await updateAutomation(automationId, {
                    name,
                    trigger_type: triggerType,
                    nodes: nodes as any,
                    edges: edges as any
                });
            } else {
                const result = await createAutomation(name, triggerType, nodes as any, edges as any);
                if (result) {
                    // close builder on new creation success
                    addToast('Salvo com sucesso', 'success');
                    onClose();
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const addNode = (type: 'default' | 'output', label: string) => {
        const newNode = {
            id: `node-${Date.now()}`,
            type,
            position: { x: 250, y: nodes.length * 100 + 150 },
            data: { label },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="flex flex-col h-[800px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400"
                        placeholder="Nome da automação"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
                <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-6 overflow-y-auto z-10">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                            Gatilho Principal
                        </h3>
                        <select
                            value={triggerType}
                            onChange={(e) => setTriggerType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="lead_created">Novo Lead Criado</option>
                            <option value="stage_changed">Etapa de Negócio Alterada</option>
                            <option value="message_received">Mensagem Recebida</option>
                            <option value="tag_added">Tag Adicionada</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                            Adicionar Blocos
                        </h3>
                        <button
                            onClick={() => addNode('default', 'Enviar Mensagem')}
                            className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                <Play className="w-4 h-4 text-emerald-500" />
                                Ação Simples
                            </div>
                        </button>
                        <button
                            onClick={() => addNode('default', 'Esperar 1 Dia')}
                            className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                <Settings2 className="w-4 h-4 text-amber-500" />
                                Atraso / Condição
                            </div>
                        </button>
                        <button
                            onClick={() => addNode('output', 'Fim do Fluxo')}
                            className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                <Trash2 className="w-4 h-4 text-slate-400" />
                                Ponto de Parada
                            </div>
                        </button>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-500 text-center">
                            Dica: Arraste os conectores de um bloco para outro para ligá-los.
                        </p>
                    </div>
                </div>

                {/* Builder Canvas */}
                <div className="flex-1 w-full h-full">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        minZoom={0.5}
                        maxZoom={2}
                    >
                        <Background color="#ccc" variant={BackgroundVariant.Dots} />
                        <Controls />
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};

export default FlowBuilderPage;
