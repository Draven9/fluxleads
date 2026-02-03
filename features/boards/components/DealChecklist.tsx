'use client';

import React, { useEffect, useState } from 'react';
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import { PlaybookItem, DealChecklistProgress } from '@/types/types';
import { playbookService } from '../services/playbookService';
import { cn } from '@/lib/utils/cn';
import toast from 'react-hot-toast';

interface DealChecklistProps {
    dealId: string;
    boardId: string;
    stageId: string;
    compact?: boolean; // If true, shows a summarized view (e.g. for Card footer)
}

export const DealChecklist: React.FC<DealChecklistProps> = ({ dealId, boardId, stageId, compact = false }) => {
    const [items, setItems] = useState<PlaybookItem[]>([]);
    const [progress, setProgress] = useState<DealChecklistProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedItems, fetchedProgress] = await Promise.all([
                    playbookService.getItemsByStage(boardId, stageId),
                    playbookService.getProgress(dealId)
                ]);
                setItems(fetchedItems);
                setProgress(fetchedProgress);
            } catch (error) {
                console.error('Error fetching playbook:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [boardId, stageId, dealId]);

    const handleToggle = async (itemId: string, currentStatus: boolean, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click

        // Optimistic update
        const newStatus = !currentStatus;
        setProgress(prev => {
            const existing = prev.find(p => p.playbookItemId === itemId);
            if (existing) {
                return prev.map(p => p.playbookItemId === itemId ? { ...p, completed: newStatus } : p);
            } else {
                return [...prev, { dealId, playbookItemId: itemId, completed: newStatus }];
            }
        });

        try {
            await playbookService.toggleItem(dealId, itemId, newStatus);
        } catch (error) {
            console.error('Error toggling item:', error);
            toast.error('Erro ao salvar item');
            // Revert
            setProgress(prev => prev.map(p => p.playbookItemId === itemId ? { ...p, completed: currentStatus } : p));
        }
    };

    if (loading) {
        return compact ? null : <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={16} /></div>;
    }

    if (items.length === 0) return null;

    // Compact View (e.g. "2/5 tasks")
    if (compact) {
        const completedCount = items.filter(item =>
            progress.find(p => p.playbookItemId === item.id)?.completed
        ).length;

        return (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium" title="Playbook da etapa">
                <CheckSquare size={12} className={completedCount === items.length ? "text-green-500" : ""} />
                <span>{completedCount}/{items.length}</span>
            </div>
        );
    }

    // Full View
    return (
        <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3 border border-slate-100 dark:border-white/5 space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                <CheckSquare size={14} />
                Playbook desta etapa
            </h4>
            <div className="space-y-1">
                {items.map(item => {
                    const isCompleted = progress.find(p => p.playbookItemId === item.id)?.completed || false;
                    return (
                        <div
                            key={item.id}
                            onClick={(e) => handleToggle(item.id, isCompleted, e)}
                            className={cn(
                                "flex items-start gap-2 p-2 rounded cursor-pointer transition-colors group",
                                isCompleted ? "bg-green-50/50 dark:bg-green-900/10" : "hover:bg-slate-100 dark:hover:bg-white/5"
                            )}
                        >
                            <div className={cn(
                                "mt-0.5 shrink-0 transition-colors",
                                isCompleted ? "text-green-500" : "text-slate-300 group-hover:text-slate-400"
                            )}>
                                {isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>
                            <span className={cn(
                                "text-sm transition-all",
                                isCompleted ? "text-slate-500 line-through decoration-slate-300" : "text-slate-700 dark:text-slate-200"
                            )}>
                                {item.text}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
