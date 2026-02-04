
import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { Activity, Deal } from '@/types';
import { ActivitiesCalendar } from './ActivitiesCalendar';
import { ActivitiesMonthView } from './ActivitiesMonthView';
import { useAuth } from '@/context/AuthContext';
import { useCRM } from '@/context/CRMContext';

interface ActivitiesCalendarContainerProps {
    activities: Activity[];
    deals: Deal[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    onUpdateActivityDate: (activityId: string, newDate: Date) => Promise<void>;
    onEditActivity: (activity: Activity) => void;
}

export const ActivitiesCalendarContainer: React.FC<ActivitiesCalendarContainerProps> = ({
    activities,
    deals,
    currentDate,
    setCurrentDate,
    onUpdateActivityDate,
    onEditActivity
}) => {
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    return (
        <div className="flex flex-col h-full bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 font-display flex items-center gap-2">
                        <CalendarIcon size={20} className="text-primary-500" />
                        {viewMode === 'week' ? 'Visão Semanal' : 'Visão Mensal'}
                    </h2>

                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'week'
                                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'month'
                                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            Mês
                        </button>
                    </div>
                </div>

                {/* Date Navigation is handled inside the views OR we could lift it here depending on design preference. 
                    For now, assuming views handle their own specific navigation or we pass standard controls. 
                    Let's keep controls inside views if they diverge too much, OR lift them if uniform.
                    The current `ActivitiesCalendar` has navigation buttons. We should likely lift them here to avoid duplication
                    but `ActivitiesCalendar` expects `setCurrentDate`. Let's assume standard behavior.
                */}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'week' ? (
                    <ActivitiesCalendar
                        activities={activities}
                        deals={deals}
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        onUpdateActivityDate={onUpdateActivityDate}
                        onEditActivity={onEditActivity}
                    />
                ) : (
                    <ActivitiesMonthView
                        activities={activities}
                        deals={deals}
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        onUpdateActivityDate={onUpdateActivityDate}
                        onEditActivity={onEditActivity}
                    />
                )}
            </div>
        </div>
    );
};
