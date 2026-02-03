'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, CheckSquare } from 'lucide-react';
import { PlaybookItem } from '@/types/types';
import { playbookService } from '../services/playbookService';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { InputField, SubmitButton } from '@/components/ui/FormField';

interface PlaybookEditorProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    stageId: string;
    stageLabel: string;
}

export const PlaybookEditor: React.FC<PlaybookEditorProps> = ({
    isOpen,
    onClose,
    boardId,
    stageId,
    stageLabel
}) => {
    const { addToast } = useToast();
    const [items, setItems] = useState<PlaybookItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItemText, setNewItemText] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Fetch items when modal opens
    useEffect(() => {
        if (isOpen && boardId && stageId) {
            loadItems();
        }
    }, [isOpen, boardId, stageId]);

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await playbookService.getItemsByStage(boardId, stageId);
            setItems(data);
        } catch (error) {
            console.error(error);
            addToast('Erro ao carregar playbook', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemText.trim()) return;

        setIsAdding(true);
        try {
            const newItem = await playbookService.createItem({
                boardId,
                stageId,
                text: newItemText.trim(),
                orderIndex: items.length
            });
            setItems([...items, newItem]);
            setNewItemText('');
        } catch (error) {
            console.error(error);
            addToast('Erro ao adicionar item', 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        try {
            await playbookService.deleteItem(id);
            setItems(items.filter(i => i.id !== id));
        } catch (error) {
            console.error(error);
            addToast('Erro ao remover item', 'error');
        }
    };

    // Note: Reordering is not implemented yet in UI for simplicity, 
    // but the backend supports order_index.

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Playbook: ${stageLabel}`}
            size="md"
        >
            <div className="p-6 space-y-6">
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-lg border border-slate-100 dark:border-white/10 text-sm text-slate-600 dark:text-slate-300">
                    Defina o checklist obrigatório ou recomendado para esta etapa.
                    Isso aparecerá em todos os cards que entrarem aqui.
                </div>

                <form onSubmit={handleAddItem} className="flex gap-2">
                    <InputField
                        label=""
                        placeholder="Ex: Ligar para prospecção..."
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        containerClassName="flex-1"
                        autoFocus
                    />
                    <SubmitButton
                        isLoading={isAdding}
                        className="w-auto px-4 mt-0 bg-primary-600 self-start"
                        style={{ marginTop: 0, height: '42px' }} // Quick fix alignment
                    >
                        <Plus size={20} />
                    </SubmitButton>
                </form>

                <div className="space-y-2 mt-4">
                    {items.length === 0 && !loading && (
                        <p className="text-center text-slate-400 text-sm py-4 italic">
                            Nenhum item definido para esta etapa.
                        </p>
                    )}

                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg group"
                        >
                            <span className="text-slate-400 text-xs font-mono w-4">{index + 1}.</span>
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{item.text}</span>
                            <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end p-6 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 rounded-b-xl">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                >
                    Fechar
                </button>
            </div>
        </Modal>
    );
};
