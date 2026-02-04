
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Phone, Users, Mail, CheckSquare } from 'lucide-react';
import { Activity, Deal } from '@/types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivitiesMonthViewProps {
    activities: Activity[];
    deals: Deal[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    onUpdateActivityDate: (activityId: string, newDate: Date) => Promise<void>;
}

export const ActivitiesMonthView: React.FC<ActivitiesMonthViewProps> = ({
    activities,
    deals,
    currentDate,
    setCurrentDate,
    onUpdateActivityDate
}) => {
    // Generate calendar grid
    const days = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        return eachDayOfInterval({
            start: startDate,
            end: endDate
        });
    }, [currentDate]);

    // Index activities by date string (YYYY-MM-DD) for O(1) access
    const activitiesByDate = useMemo(() => {
        const map = new Map<string, Activity[]>();
        activities.forEach(activity => {
            const dateStr = new Date(activity.date).toISOString().split('T')[0];
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)?.push(activity);
        });
        return map;
    }, [activities]);

    const dealTitleById = useMemo(() => {
        return new Map(deals.map(d => [d.id, d.title]));
    }, [deals]);

    // Navigation
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    // Icons
    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'CALL': return <Phone size={12} />;
            case 'MEETING': return <Users size={12} />;
            case 'EMAIL': return <Mail size={12} />;
            case 'TASK': return <CheckSquare size={12} />;
        }
    };

    const getTypeColor = (type: Activity['type']) => {
        switch (type) {
            case 'CALL': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            case 'MEETING': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            case 'EMAIL': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800';
            case 'TASK': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
        }
    };

    // Drag & Drop Handlers (HTML5 Native)
    const handleDragStart = (e: React.DragEvent, activityId: string) => {
        e.dataTransfer.setData('application/react-dnd-id', activityId);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Custom drag image if desired
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetDate: Date) => {
        e.preventDefault();
        const activityId = e.dataTransfer.getData('application/react-dnd-id');
        if (activityId) {
            onUpdateActivityDate(activityId, targetDate);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-dark-bg/50">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize w-32 text-center">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
                <button
                    onClick={goToToday}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                    Hoje
                </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-dark-card/50">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-5 overflow-hidden">
                {days.map((day, idx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayActivities = activitiesByDate.get(dateStr) || [];
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);

                    // Limit display to preventing overflow
                    const maxDisplay = 4;
                    const displayedActivities = dayActivities.slice(0, maxDisplay);
                    const remaining = dayActivities.length - maxDisplay;

                    return (
                        <div
                            key={day.toISOString()}
                            className={`
                                border-r border-b border-slate-200 dark:border-white/5 p-1 relative transition-colors duration-200
                                ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-black/20 text-slate-400' : 'bg-white dark:bg-dark-card'}
                                hover:bg-slate-50 dark:hover:bg-white/5
                            `}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                        >
                            {/* Day Number */}
                            <div className={`
                                text-xs font-semibold mb-1 flex items-center justify-center w-6 h-6 rounded-full mx-auto
                                ${isTodayDate
                                    ? 'bg-primary-500 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400'}
                            `}>
                                {format(day, 'd')}
                            </div>

                            {/* Activities Stack */}
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100%-2rem)] scrollbar-thin">
                                {displayedActivities.map(activity => (
                                    <div
                                        key={activity.id}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, activity.id)}
                                        className={`
                                            group text-[10px] px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing truncate
                                            flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all
                                            ${getTypeColor(activity.type)}
                                            ${activity.completed ? 'opacity-50 line-through' : ''}
                                        `}
                                        title={`${activity.title} (${format(new Date(activity.date), 'HH:mm')})`}
                                    >
                                        <span className="opacity-75 shrink-0">
                                            {getActivityIcon(activity.type)}
                                        </span>
                                        <span className="truncate font-medium">
                                            {activity.title}
                                        </span>
                                    </div>
                                ))}
                                {remaining > 0 && (
                                    <div className="text-[10px] text-slate-400 text-center font-medium hover:text-slate-600 cursor-pointer">
                                        +{remaining} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
