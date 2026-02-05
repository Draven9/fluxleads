import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleSettingsService, RoleSettings } from '@/lib/supabase/roles';
import { Shield, Save, CheckCircle2, AlertCircle } from 'lucide-react';

const PERMISSION_LABELS: Record<string, string> = {
    view_all_deals: 'Ver todos os negócios (Visão Global)',
    can_export_contacts: 'Exportar contatos (CSV/Excel)',
    view_revenue: 'Ver valores financeiros (Dashboards)',
    manage_products: 'Gerenciar Produtos/Serviços',
    manage_tags: 'Gerenciar Etiquetas'
};

const ROLES = [
    { id: 'vendedor', label: 'Vendedores', description: 'Focados em vendas e pipeline.' },
    { id: 'colaborador', label: 'Colaboradores', description: 'Focados em tarefas e atendimento.' }
] as const;

export const OrganizationRoleSettings: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeRole, setActiveRole] = useState<'vendedor' | 'colaborador'>('vendedor');
    const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Fetch settings
    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ['roleSettings'],
        queryFn: async () => {
            const { data, error } = await roleSettingsService.getAll();
            if (error) throw error;
            return data || [];
        }
    });

    // Init local state when data loads
    useEffect(() => {
        if (settings) {
            const roleSetting = settings.find(s => s.role === activeRole);
            setLocalPermissions(roleSetting?.permissions || {});
            setIsDirty(false);
        }
    }, [settings, activeRole]);

    // Mutation to save
    const mutation = useMutation({
        mutationFn: async () => {
            const { error } = await roleSettingsService.updatePermissions(activeRole, localPermissions);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roleSettings'] });
            setIsDirty(false);
        }
    });

    const handleToggle = (key: string) => {
        setLocalPermissions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setIsDirty(true);
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando permissões...</div>;
    if (isError) return <div className="p-8 text-center text-red-500 flex items-center justify-center gap-2"><AlertCircle size={20} /> Erro ao carregar permissões.</div>;

    return (
        <div className="space-y-8 pb-10">

            {/* Header */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Controle de Acesso</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Defina o que cada papel pode ver ou fazer no sistema.
                        </p>
                    </div>
                </div>
            </div>

            {/* Role Switcher */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Papéis</h4>
                    {ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => setActiveRole(role.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeRole === role.id
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-500/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                }`}
                        >
                            <div className="font-medium">{role.label}</div>
                            <div className="text-xs opacity-70 mt-0.5">{role.description}</div>
                        </button>
                    ))}
                </div>

                {/* Permissions Form */}
                <div className="flex-1">
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">

                        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50/50 dark:bg-black/20">
                            <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                Permissões: <span className="text-blue-600 dark:text-blue-400">{ROLES.find(r => r.id === activeRole)?.label}</span>
                            </h4>

                            {isDirty && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Alterações não salvas
                                </span>
                            )}
                        </div>

                        <div className="p-6 space-y-4">
                            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                                <label
                                    key={key}
                                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer group transition-colors"
                                >
                                    <div className="relative flex items-center mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={localPermissions[key] || false}
                                            onChange={() => handleToggle(key)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {label}
                                        </span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {localPermissions[key]
                                                ? 'Habilitado: O usuário tem acesso a este recurso.'
                                                : 'Desabilitado: Acesso bloqueado para este papel.'}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-black/20 border-t border-slate-200 dark:border-white/10 flex justify-end">
                            <button
                                onClick={() => mutation.mutate()}
                                disabled={!isDirty || mutation.isPending}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all shadow-sm ${!isDirty
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-white/5 dark:text-white/30'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-95'
                                    }`}
                            >
                                {mutation.isPending ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : mutation.isSuccess && !isDirty ? (
                                    <CheckCircle2 size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                {mutation.isSuccess && !isDirty ? 'Salvo!' : 'Salvar Alterações'}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
