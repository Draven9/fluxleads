"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play, Settings2, Trash2, Zap, MessageSquare, Clock, Shuffle, ArrowRightCircle } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
    trigger: <Zap className="w-5 h-5 text-indigo-500" />,
    action: <Play className="w-5 h-5 text-primary-500" />,
    condition: <Shuffle className="w-5 h-5 text-amber-500" />,
    delay: <Clock className="w-5 h-5 text-blue-500" />,
    message: <MessageSquare className="w-5 h-5 text-emerald-500" />,
    move: <ArrowRightCircle className="w-5 h-5 text-amber-600" />,
    stop: <Trash2 className="w-5 h-5 text-slate-400" />
};

export const TriggerNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-indigo-500/20 dark:border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/5 min-w-[220px]">
            <div className="flex-shrink-0 p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5">Gatilho Principal</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{data.label as string}</div>
            </div>
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-800" />
        </div>
    );
});

export const ActionNode = memo(({ data, isConnectable }: NodeProps) => {
    const icon = data.icon ? iconMap[data.icon as string] : iconMap.action;
    const typeLabel = (data.typeLabel as string) || 'Ação';

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700/80 rounded-xl shadow-sm min-w-[220px]">
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800" />
            <div className="flex-shrink-0 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">{typeLabel}</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{data.label as string}</div>
            </div>
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800" />
        </div>
    );
});

export const ConditionNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-amber-500/20 dark:border-amber-500/30 rounded-xl shadow-lg shadow-amber-500/5 min-w-[220px]">
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-800" />
            <div className="flex-shrink-0 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <Shuffle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Condição (Se)</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{data.label as string}</div>
            </div>
            <Handle type="source" position={Position.Left} id="true" isConnectable={isConnectable} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-800" />
            <Handle type="source" position={Position.Right} id="false" isConnectable={isConnectable} className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-slate-800" />
        </div>
    );
});
