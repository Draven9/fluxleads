import React, { useState } from 'react';
import { Filter, X, Plus, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FilterOption {
    label: string;
    value: string;
}

export interface FilterDefinition {
    id: string;
    label: string;
    type: 'select' | 'date-range' | 'text';
    options?: FilterOption[];
}

export interface ActiveFilter {
    id: string;
    value: any;
    labelDisplay?: string; // Texto formatado para o chip
}

export interface FilterBarProps {
    definitions: FilterDefinition[];
    activeFilters: ActiveFilter[];
    onAddFilter: (filter: ActiveFilter) => void;
    onRemoveFilter: (filterId: string) => void;
    onClearFilters: () => void;

    // Opcional: Busca embutida na barra de filtros
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    searchPlaceholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    definitions,
    activeFilters,
    onAddFilter,
    onRemoveFilter,
    onClearFilters,
    searchTerm,
    onSearchChange,
    searchPlaceholder = 'Buscar...',
}) => {
    const [openSelector, setOpenSelector] = useState(false);
    const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

    // States for generating a new filter value
    const [tempSelectValue, setTempSelectValue] = useState<string>('');
    const [tempDateStart, setTempDateStart] = useState<string>('');
    const [tempDateEnd, setTempDateEnd] = useState<string>('');

    const availableDefinitions = definitions.filter(
        (def) => !activeFilters.find((af) => af.id === def.id && def.type !== 'text')
    );

    const handleApplyFilter = (def: FilterDefinition) => {
        let value: any;
        let labelDisplay = '';

        if (def.type === 'select') {
            if (!tempSelectValue) return;
            value = tempSelectValue;
            labelDisplay = def.options?.find(o => o.value === tempSelectValue)?.label || tempSelectValue;
        } else if (def.type === 'date-range') {
            if (!tempDateStart && !tempDateEnd) return;
            value = { start: tempDateStart, end: tempDateEnd };
            const startStr = tempDateStart ? new Date(tempDateStart).toLocaleDateString() : 'Início';
            const endStr = tempDateEnd ? new Date(tempDateEnd).toLocaleDateString() : 'Fim';
            labelDisplay = `${startStr} até ${endStr}`;
        }

        onAddFilter({
            id: def.id,
            value,
            labelDisplay,
        });

        setTempSelectValue('');
        setTempDateStart('');
        setTempDateEnd('');
        setSelectedDefId(null);
        setOpenSelector(false);
    };

    const renderFilterValueInput = (def: FilterDefinition) => {
        if (def.type === 'select') {
            return (
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase">{def.label}</label>
                    <select
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                        value={tempSelectValue}
                        onChange={(e) => setTempSelectValue(e.target.value)}
                    >
                        <option value="" disabled>Selecione...</option>
                        {def.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => handleApplyFilter(def)}
                        disabled={!tempSelectValue}
                        className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Aplicar Filtro
                    </button>
                </div>
            );
        }

        if (def.type === 'date-range') {
            return (
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase">{def.label}</label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={tempDateStart}
                            onChange={(e) => setTempDateStart(e.target.value)}
                        />
                        <input
                            type="date"
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={tempDateEnd}
                            onChange={(e) => setTempDateEnd(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleApplyFilter(def)}
                        disabled={!tempDateStart && !tempDateEnd}
                        className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Aplicar Filtro
                    </button>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
            {/* Search Input (optional) */}
            {onSearchChange && (
                <div className="relative flex-1 sm:max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchTerm || ''}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white backdrop-blur-sm"
                    />
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 flex-1">

                {/* Active Filters Chips */}
                {activeFilters.map((af) => {
                    const def = definitions.find(d => d.id === af.id);
                    if (!def) return null;

                    return (
                        <div
                            key={af.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-full text-sm font-medium animate-in zoom-in-95 duration-200"
                        >
                            <span className="text-slate-500 font-normal">{def.label}:</span>
                            <span>{af.labelDisplay}</span>
                            <button
                                onClick={() => onRemoveFilter(af.id)}
                                className="p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full transition-colors ml-1"
                                aria-label="Remover filtro"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}

                {/* Add Filter Button */}
                {availableDefinitions.length > 0 && (
                    <Popover open={openSelector} onOpenChange={setOpenSelector}>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 rounded-full text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                                <Plus size={16} />
                                Filtro
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="start">
                            {!selectedDefId ? (
                                <div className="space-y-1">
                                    <h4 className="text-xs font-semibold text-slate-500 mb-2 px-2 uppercase">Adicionar Filtro</h4>
                                    {availableDefinitions.map(def => (
                                        <button
                                            key={def.id}
                                            onClick={() => setSelectedDefId(def.id)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"
                                        >
                                            {def.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <button
                                            onClick={() => setSelectedDefId(null)}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-500"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 9L3.5 5L7.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </button>
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                                            {definitions.find(d => d.id === selectedDefId)?.label}
                                        </h4>
                                    </div>
                                    {renderFilterValueInput(definitions.find(d => d.id === selectedDefId)!)}
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                )}

                {/* Clear All Button */}
                {activeFilters.length > 0 && (
                    <button
                        onClick={onClearFilters}
                        className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium px-2 py-1.5 transition-colors ml-1"
                    >
                        Limpar Tudo
                    </button>
                )}

            </div>
        </div>
    );
};
