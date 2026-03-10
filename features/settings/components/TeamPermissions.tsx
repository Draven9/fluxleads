/**
 * TeamPermissions — 5.3
 * Gerenciamento visual de permissões granulares por membro da equipe.
 * Admin/owner têm todas as permissões automaticamente (bloqueado para edição).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Check, Loader2, RefreshCw, Crown, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth, type UserPermission } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface TeamMember {
    id: string;
    email: string;
    role: string;
    first_name?: string | null;
    last_name?: string | null;
    permissions?: Partial<Record<UserPermission, boolean>>;
}

const PERMISSION_DEFINITIONS: Array<{
    key: UserPermission;
    label: string;
    description: string;
}> = [
        {
            key: 'can_view_all_deals',
            label: 'Ver todos os negócios',
            description: 'Acessa negócios de qualquer vendedor da equipe',
        },
        {
            key: 'can_delete_deals',
            label: 'Excluir negócios',
            description: 'Permite excluir negócios permanentemente',
        },
        {
            key: 'can_export_data',
            label: 'Exportar dados',
            description: 'Exportar leads, contatos e histórico (CSV/XLSX)',
        },
        {
            key: 'can_view_reports',
            label: 'Ver relatórios',
            description: 'Acessa o módulo de relatórios e métricas',
        },
        {
            key: 'can_manage_automations',
            label: 'Gerenciar automações',
            description: 'Criar e editar fluxos de automação',
        },
        {
            key: 'can_manage_tags',
            label: 'Gerenciar tags',
            description: 'Criar, editar e excluir tags do sistema',
        },
        {
            key: 'can_manage_products',
            label: 'Gerenciar produtos',
            description: 'Acessa o catálogo de produtos e serviços',
        },
    ];

const DEFAULT_PERMISSIONS: Record<UserPermission, boolean> = {
    can_view_all_deals: false,
    can_delete_deals: false,
    can_export_data: false,
    can_view_reports: true,
    can_manage_automations: false,
    can_manage_tags: false,
    can_manage_products: false,
};

const getAvatarGradient = (email: string) => {
    const colors = [
        'from-blue-500 to-cyan-500',
        'from-emerald-500 to-teal-500',
        'from-orange-500 to-amber-500',
        'from-pink-500 to-rose-500',
        'from-indigo-500 to-blue-500',
    ];
    const idx = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[idx];
};

export const TeamPermissions: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const { addToast } = useToast();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [localPerms, setLocalPerms] = useState<Record<string, Record<UserPermission, boolean>>>({});

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

    const fetchMembers = useCallback(async () => {
        if (!supabase || !isAdmin) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, role, first_name, last_name, permissions')
                .order('created_at');
            if (error) throw error;

            const rows = (data || []) as TeamMember[];
            setMembers(rows);

            // Initialize local permission state
            const permsMap: Record<string, Record<UserPermission, boolean>> = {};
            for (const m of rows) {
                permsMap[m.id] = { ...DEFAULT_PERMISSIONS, ...(m.permissions ?? {}) };
            }
            setLocalPerms(permsMap);
        } catch (err) {
            console.error('[TeamPermissions] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const togglePermission = (memberId: string, perm: UserPermission) => {
        setLocalPerms((prev) => ({
            ...prev,
            [memberId]: {
                ...prev[memberId],
                [perm]: !prev[memberId]?.[perm],
            },
        }));
    };

    const savePermissions = async (memberId: string) => {
        if (!supabase) return;
        setSavingId(memberId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: localPerms[memberId] })
                .eq('id', memberId);
            if (error) throw error;
            addToast('Permissões salvas com sucesso!', 'success');
        } catch (err) {
            console.error('[TeamPermissions] save error:', err);
            addToast('Erro ao salvar permissões', 'error');
        } finally {
            setSavingId(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Acesso Restrito</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Apenas administradores podem gerenciar permissões.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    // Filter out current user (they're always admin)
    const editableMembers = members.filter((m) => m.id !== currentUser?.id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary-500" />
                        Permissões da Equipe
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Configure o que cada membro pode fazer no sistema
                    </p>
                </div>
                <button
                    onClick={fetchMembers}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Permission Legend */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Admin e Owner</strong> têm todas as permissões automaticamente e não podem ser editadas aqui.
                    Use esta tela para configurar permissões de vendedores e outros papéis.
                </p>
            </div>

            {/* Members */}
            <div className="space-y-4">
                {editableMembers.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                        <p className="text-slate-500 dark:text-slate-400">Nenhum membro para gerenciar permissões</p>
                    </div>
                )}

                {editableMembers.map((member) => {
                    const isAdminRole = member.role === 'admin' || member.role === 'owner';
                    const gradient = getAvatarGradient(member.email);
                    const initials = member.email.slice(0, 2).toUpperCase();
                    const displayName = member.first_name
                        ? `${member.first_name} ${member.last_name ?? ''}`.trim()
                        : member.email;

                    return (
                        <div
                            key={member.id}
                            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6"
                        >
                            {/* Member Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm`}
                                    >
                                        {initials}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{displayName}</p>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                            {isAdminRole ? (
                                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                            ) : (
                                                <Briefcase className="w-3.5 h-3.5" />
                                            )}
                                            <span className="capitalize">{member.role}</span>
                                        </div>
                                    </div>
                                </div>

                                {!isAdminRole && (
                                    <button
                                        onClick={() => savePermissions(member.id)}
                                        disabled={savingId === member.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {savingId === member.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        Salvar
                                    </button>
                                )}
                            </div>

                            {/* Permissions Grid */}
                            {isAdminRole ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {PERMISSION_DEFINITIONS.map(({ key, label }) => (
                                        <div
                                            key={key}
                                            className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"
                                        >
                                            <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            <span className="text-sm text-amber-700 dark:text-amber-300">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-white/5">
                                    {PERMISSION_DEFINITIONS.map(({ key, label, description }) => {
                                        const enabled = localPerms[member.id]?.[key] ?? false;
                                        return (
                                            <div key={key} className="flex items-center justify-between py-3">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => togglePermission(member.id, key)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-slate-200 dark:bg-white/10'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TeamPermissions;
