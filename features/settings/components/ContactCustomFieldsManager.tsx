import React, { useState } from 'react';
import { PenTool, Pencil, Check, Plus, List, Tag, Trash2 } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { ContactCustomField, ContactCustomFieldType } from '@/types';
import { useContactCustomFields } from '@/lib/query/hooks/useContactCustomFields';
import { useAuth } from '@/context/AuthContext';

export const ContactCustomFieldsManager: React.FC = () => {
    const { fields, isLoading, createField, updateField, deleteField, isMutating } = useContactCustomFields();
    const { profile } = useAuth();

    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldType, setNewFieldType] = useState<ContactCustomFieldType>('text');
    const [newFieldOptions, setNewFieldOptions] = useState('');
    const [newFieldWebhook, setNewFieldWebhook] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const onStartEditing = (field: ContactCustomField) => {
        setEditingId(field.id);
        setNewFieldLabel(field.name);
        setNewFieldType(field.fieldType);
        setNewFieldOptions(field.options ? field.options.join(', ') : '');
        setNewFieldWebhook(field.triggerAction || '');
    };

    const onCancelEditing = () => {
        setEditingId(null);
        setNewFieldLabel('');
        setNewFieldType('text');
        setNewFieldOptions('');
        setNewFieldWebhook('');
    };

    const onSaveField = async () => {
        if (!newFieldLabel.trim()) return;

        const optionsArray =
            newFieldType === 'select'
                ? newFieldOptions
                    .split(',')
                    .map(opt => opt.trim())
                    .filter(opt => opt !== '')
                : undefined;

        const triggerAction = newFieldWebhook.trim() || null;

        if (editingId) {
            // Editar
            await updateField({
                id: editingId,
                updates: {
                    name: newFieldLabel,
                    fieldType: newFieldType,
                    options: optionsArray,
                    triggerAction
                }
            });
        } else {
            // Criar
            await createField({
                name: newFieldLabel,
                fieldType: newFieldType,
                options: optionsArray,
                triggerAction
            });
        }

        onCancelEditing(); // reset form
    };

    if (profile?.role !== 'admin') {
        return null; // Apenas admins podem configurar campos customizados
    }

    return (
        <SettingsSection title="Campos de Contato" icon={PenTool}>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Crie campos específicos para os seus Contatos (ex: Comparecimento, Data de Aniversário). Eles aparecerão no Painel do Cliente e podem acionar webhooks!
            </p>

            <div className={`p-4 rounded-xl border transition-all mb-6 ${editingId ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5'}`}>
                {editingId && (
                    <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <Pencil size={12} /> Editando Campo
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-3 items-end mb-3">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Campo</label>
                        <input
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            placeholder="Ex: Comparecimento"
                            className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as ContactCustomFieldType)}
                            className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        >
                            <option value="text">Texto</option>
                            <option value="boolean">Checkbox Sim/Não</option>
                            <option value="date">Data</option>
                            <option value="select">Seleção</option>
                        </select>
                    </div>
                </div>

                {newFieldType === 'select' && (
                    <div className="animate-in slide-in-from-top-2 fade-in duration-200 mb-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                            <List size={12} /> Opções (Separadas por vírgula)
                        </label>
                        <input
                            type="text"
                            value={newFieldOptions}
                            onChange={(e) => setNewFieldOptions(e.target.value)}
                            placeholder="Ex: Opção A, Opção B"
                            className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        />
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Gatilho de Automação (Webhook n8n) - Opcional
                    </label>
                    <input
                        type="url"
                        value={newFieldWebhook}
                        onChange={(e) => setNewFieldWebhook(e.target.value)}
                        placeholder="https://sua-url-n8n.com/webhook/123..."
                        className="w-full bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Sempre que este campo for alterado em um contato, o sistema enviará um POST para esta URL (Feature da TASK-09).</p>
                </div>

                <div className="flex gap-2 justify-end mt-4">
                    {editingId && (
                        <button
                            onClick={onCancelEditing}
                            className="bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 px-3 py-2 rounded-lg text-sm font-bold transition-colors h-[38px] border border-slate-200 dark:border-white/10"
                            disabled={isMutating}
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={onSaveField}
                        disabled={!newFieldLabel.trim() || isMutating}
                        className={`${editingId ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/20'} text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors h-[38px] shadow-lg disabled:opacity-50`}
                    >
                        {editingId ? <Check size={16} /> : <Plus size={16} />}
                        {editingId ? 'Salvar' : 'Criar'}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <div className="animate-pulse h-12 bg-slate-100 dark:bg-white/5 rounded-lg w-full"></div>
                ) : fields.map(field => (
                    <div key={field.id} className={`flex items-center justify-between p-3 bg-white dark:bg-white/5 border rounded-lg group transition-colors ${editingId === field.id ? 'border-amber-400 dark:border-amber-500/50 ring-1 ring-amber-400/30' : 'border-slate-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/50'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                <Tag size={14} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{field.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                                    <span className="uppercase font-semibold text-primary-500">{field.fieldType}</span>
                                    {field.options && (
                                        <>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="text-slate-400">{field.options.length} opções</span>
                                        </>
                                    )}
                                    {field.triggerAction && (
                                        <>
                                            <span className="w-1 h-1 bg-amber-300 rounded-full"></span>
                                            <span className="text-amber-500">Webhook ✅</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onStartEditing(field)}
                                className="text-slate-400 hover:text-amber-500 p-2 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                title="Editar campo"
                                disabled={isMutating}
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Tem certeza? Removerá o campo de todos os contatos.')) deleteField(field.id)
                                }}
                                className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Remover campo"
                                disabled={isMutating}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {!isLoading && fields.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-4 italic">Nenhum campo personalizado criado para contatos.</p>
                )}
            </div>
        </SettingsSection>
    );
};
