import React, { useMemo } from 'react';
import { Activity } from '@/types';
import { Profile } from '@/lib/supabase/profiles';
import { User, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ActivitiesTeamViewProps {
    activities: Activity[];
    profiles: Profile[];
    onSelectAssignee: (id: string | null) => void;
    selectedAssigneeId: string | null;
}

export const ActivitiesTeamView: React.FC<ActivitiesTeamViewProps> = ({
    activities,
    profiles,
    onSelectAssignee,
    selectedAssigneeId,
}) => {
    // Compute stats per user
    const stats = useMemo(() => {
        const map = new Map<string, { total: number; overdue: number; completed: number; highPriority: number }>();

        // Initialize for all profiles
        profiles.forEach(p => {
            map.set(p.id, { total: 0, overdue: 0, completed: 0, highPriority: 0 });
        });
        // Add "Unassigned" bucket
        map.set('unassigned', { total: 0, overdue: 0, completed: 0, highPriority: 0 });

        const now = new Date();

        activities.forEach(a => {
            const assigneeId = a.assigneeId || 'unassigned';
            const current = map.get(assigneeId);

            // If assignee not in profiles list (e.g. deleted user), map to unassigned or ignore? 
            // Let's map to unassigned for visibility.
            const target = current || map.get('unassigned')!;

            target.total++;
            if (a.completed) {
                target.completed++;
            } else {
                if (new Date(a.date) < now) target.overdue++;
                if (a.priority === 'high') target.highPriority++;
            }
        });

        return map;
    }, [activities, profiles]);

    // Sort profiles by pending tasks (descending)
    const sortedProfiles = useMemo(() => {
        return [...profiles].sort((a, b) => {
            const statsA = stats.get(a.id)!;
            const statsB = stats.get(b.id)!;
            const pendingA = statsA.total - statsA.completed;
            const pendingB = statsB.total - statsB.completed;
            return pendingB - pendingA;
        });
    }, [profiles, stats]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {/* Card for Unassigned (if any) */}
            {stats.get('unassigned')!.total > 0 && (
                <div
                    onClick={() => onSelectAssignee('unassigned')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${selectedAssigneeId === 'unassigned'
                        ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500 dark:bg-primary-900/20 dark:border-primary-500'
                        : 'bg-white border-slate-200 hover:border-primary-300 dark:bg-dark-card dark:border-white/5'
                        }`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <User size={20} className="text-slate-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Não Atribuídos</h3>
                            <p className="text-xs text-slate-400">Sem responsável</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg">
                            <span className="block text-lg font-bold text-slate-700 dark:text-slate-200">{stats.get('unassigned')!.total - stats.get('unassigned')!.completed}</span>
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Pendentes</span>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                            <span className="block text-lg font-bold text-red-600 dark:text-red-400">{stats.get('unassigned')!.overdue}</span>
                            <span className="text-[10px] uppercase text-red-400 font-bold">Atrasadas</span>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                            <span className="block text-lg font-bold text-green-600 dark:text-green-400">{stats.get('unassigned')!.completed}</span>
                            <span className="text-[10px] uppercase text-green-400 font-bold">Feitas</span>
                        </div>
                    </div>
                </div>
            )}

            {sortedProfiles.map(profile => {
                const s = stats.get(profile.id)!;
                const pending = s.total - s.completed;
                const isSelected = selectedAssigneeId === profile.id;

                return (
                    <div
                        key={profile.id}
                        onClick={() => onSelectAssignee(isSelected ? null : profile.id)}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${isSelected
                            ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500 dark:bg-primary-900/20 dark:border-primary-500'
                            : 'bg-white border-slate-200 hover:border-primary-300 dark:bg-dark-card dark:border-white/5'
                            }`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                    {profile.name?.charAt(0) || profile.email.charAt(0)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 truncate">{profile.name || profile.email}</h3>
                                <p className="text-xs text-slate-400 truncate">{profile.email}</p>
                            </div>
                            {s.highPriority > 0 && !s.completed && (
                                <div className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Tem prioridade alta" />
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg">
                                <span className="block text-lg font-bold text-slate-700 dark:text-slate-200">{pending}</span>
                                <span className="text-[10px] uppercase text-slate-400 font-bold">Pendentes</span>
                            </div>
                            <div className={`${s.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-white/5'} p-2 rounded-lg transition-colors`}>
                                <span className={`block text-lg font-bold ${s.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{s.overdue}</span>
                                <span className={`text-[10px] uppercase font-bold ${s.overdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>Atrasadas</span>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                                <span className="block text-lg font-bold text-green-600 dark:text-green-400">{s.completed}</span>
                                <span className="text-[10px] uppercase text-green-400 font-bold">Feitas</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
