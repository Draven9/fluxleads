import React from 'react';
import { Contact } from '@/types';

interface ContactsFiltersProps {
    dateRange: { start: string; end: string };
    setDateRange: (range: { start: string; end: string }) => void;
    sourceFilter: Contact['source'] | 'ALL';
    setSourceFilter: (source: Contact['source'] | 'ALL') => void;
}

/**
 * Componente React `ContactsFilters`.
 */
export const ContactsFilters: React.FC<ContactsFiltersProps> = ({
    dateRange,
    setDateRange,
    sourceFilter,
    setSourceFilter
}) => {
    return (
        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 animate-in slide-in-from-top-2">
            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origem</label>
                    <select
                        className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        value={sourceFilter || 'ALL'}
                        onChange={(e) => setSourceFilter(e.target.value as Contact['source'] | 'ALL')}
                    >
                        <option value="ALL">Todas</option>
                        <option value="WEBSITE">Site</option>
                        <option value="LINKEDIN">LinkedIn</option>
                        <option value="REFERRAL">Indicação</option>
                        <option value="whatsapp_group">Grupo WhatsApp</option>
                        <option value="MANUAL">Manual</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Criação (Início)</label>
                    <input
                        type="date"
                        className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Criação (Fim)</label>
                    <input
                        type="date"
                        className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    />
                </div>
                {(dateRange.start || dateRange.end || sourceFilter !== 'ALL') && (
                    <button
                        onClick={() => {
                            setDateRange({ start: '', end: '' });
                            setSourceFilter('ALL');
                        }}
                        className="text-sm text-red-500 hover:text-red-600 font-medium px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                        Limpar Filtros
                    </button>
                )}
            </div>
        </div>
    );
};
