import React from 'react';
import { Plus, Search, LayoutGrid, Table as TableIcon, User, Settings, Lightbulb, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Board, CustomFieldDefinition } from '@/types';
import { BoardSelector } from '../BoardSelector';
import { FilterBar, FilterDefinition, ActiveFilter } from '@/components/ui/FilterBar';
import { useOrganizationTags } from '@/lib/query/hooks';
interface KanbanHeaderProps {
    // Boards
    boards: Board[];
    activeBoard: Board;
    onSelectBoard: (id: string) => void;
    onCreateBoard: () => void;
    onEditBoard?: (board: Board) => void;
    onDeleteBoard?: (id: string) => void;
    onExportTemplates?: () => void;
    // View
    viewMode: 'kanban' | 'list';
    setViewMode: (mode: 'kanban' | 'list') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    ownerFilter: 'all' | 'mine';
    setOwnerFilter: (filter: 'all' | 'mine') => void;
    statusFilter: 'open' | 'won' | 'lost' | 'all';
    setStatusFilter: (filter: 'open' | 'won' | 'lost' | 'all') => void;
    tagFilter: string;
    setTagFilter: (tag: string) => void;
    channelFilter: string;
    setChannelFilter: (channel: string) => void;
    customFieldDefinitions?: CustomFieldDefinition[];
    customFieldFilters?: Record<string, string>;
    setCustomFieldFilter?: (key: string, value: string) => void;
    clearCustomFieldFilters?: () => void;
    onNewDeal: () => void;
    onExportDeals?: () => void;
}

/**
 * Componente React `KanbanHeader`.
 *
 * @param {KanbanHeaderProps} {
    boards,
    activeBoard,
    onSelectBoard,
    onCreateBoard,
    onEditBoard,
    onDeleteBoard,
    onExportTemplates,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    ownerFilter, setOwnerFilter,
    statusFilter, setStatusFilter,
    onNewDeal
} - Parâmetro `{
    boards,
    activeBoard,
    onSelectBoard,
    onCreateBoard,
    onEditBoard,
    onDeleteBoard,
    onExportTemplates,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    ownerFilter, setOwnerFilter,
    statusFilter, setStatusFilter,
    onNewDeal
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const KanbanHeader: React.FC<KanbanHeaderProps> = ({
    boards,
    activeBoard,
    onSelectBoard,
    onCreateBoard,
    onEditBoard,
    onDeleteBoard,
    onExportTemplates,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    ownerFilter, setOwnerFilter,
    statusFilter, setStatusFilter,
    tagFilter, setTagFilter,
    channelFilter, setChannelFilter,
    customFieldDefinitions = [],
    customFieldFilters = {},
    setCustomFieldFilter,
    clearCustomFieldFilters,
    onNewDeal,
    onExportDeals
}) => {
    const { data: orgTags = [] } = useOrganizationTags();

    // Custom field filter definitions — only select and boolean types render as chips
    const customFieldFilterDefs: FilterDefinition[] = customFieldDefinitions
        .filter(f => f.type === 'select' || f.type === 'boolean')
        .map(f => ({
            id: `cf_${f.key}`,
            label: f.label,
            type: 'select' as const,
            options: f.type === 'boolean'
                ? [{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }]
                : (f.options || []).map(o => ({ label: o, value: o })),
        }));

    const filterDefinitions: FilterDefinition[] = [
        {
            id: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { label: 'Em Aberto', value: 'open' },
                { label: 'Ganhos', value: 'won' },
                { label: 'Perdidos', value: 'lost' },
                { label: 'Todos', value: 'all' },
            ]
        },
        {
            id: 'owner',
            label: 'Dono',
            type: 'select',
            options: [
                { label: 'Todos', value: 'all' },
                { label: 'Meus Negócios', value: 'mine' },
            ]
        },
        {
            id: 'tag',
            label: 'Tag',
            type: 'select',
            options: orgTags.map(t => ({ label: t.name, value: t.name })),
        },
        {
            id: 'channel',
            label: 'Canal',
            type: 'select',
            options: [
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'E-mail', value: 'email' },
                { label: 'Telefone', value: 'telefone' },
                { label: 'Presencial', value: 'presencial' },
                { label: 'Outro', value: 'outro' },
            ]
        },
        ...customFieldFilterDefs,
    ];

    const activeFilters: ActiveFilter[] = [];
    if (statusFilter && statusFilter !== 'open') {
        const label = filterDefinitions[0].options?.find(o => o.value === statusFilter)?.label;
        activeFilters.push({ id: 'status', value: statusFilter, labelDisplay: label });
    }
    if (ownerFilter && ownerFilter !== 'all') {
        const label = filterDefinitions[1].options?.find(o => o.value === ownerFilter)?.label;
        activeFilters.push({ id: 'owner', value: ownerFilter, labelDisplay: label });
    }
    if (tagFilter) {
        activeFilters.push({ id: 'tag', value: tagFilter, labelDisplay: `Tag: ${tagFilter}` });
    }
    if (channelFilter) {
        const chanDef = filterDefinitions.find(d => d.id === 'channel');
        const label = chanDef?.options?.find(o => o.value === channelFilter)?.label;
        activeFilters.push({ id: 'channel', value: channelFilter, labelDisplay: label ? `Canal: ${label}` : channelFilter });
    }
    // Active custom field filters
    Object.entries(customFieldFilters).forEach(([key, val]) => {
        if (!val) return;
        const def = customFieldFilterDefs.find(d => d.id === `cf_${key}`);
        const fieldLabel = def?.label || key;
        const optionLabel = def?.options?.find(o => o.value === val)?.label || val;
        activeFilters.push({ id: `cf_${key}`, value: val, labelDisplay: `${fieldLabel}: ${optionLabel}` });
    });

    const handleAddFilter = (f: ActiveFilter) => {
        if (f.id === 'status') setStatusFilter(f.value);
        else if (f.id === 'owner') setOwnerFilter(f.value);
        else if (f.id === 'tag') setTagFilter(f.value);
        else if (f.id === 'channel') setChannelFilter(f.value);
        else if (f.id.startsWith('cf_') && setCustomFieldFilter) {
            setCustomFieldFilter(f.id.slice(3), f.value);
        }
    };

    const handleRemoveFilter = (id: string) => {
        if (id === 'status') setStatusFilter('open');
        else if (id === 'owner') setOwnerFilter('all');
        else if (id === 'tag') setTagFilter('');
        else if (id === 'channel') setChannelFilter('');
        else if (id.startsWith('cf_') && setCustomFieldFilter) {
            setCustomFieldFilter(id.slice(3), '');
        }
    };

    const handleClearFilters = () => {
        setStatusFilter('open');
        setOwnerFilter('all');
        setTagFilter('');
        setChannelFilter('');
        setSearchTerm('');
        if (clearCustomFieldFilters) clearCustomFieldFilters();
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto flex-wrap">
                {/* Board Selector */}
                <BoardSelector
                    boards={boards}
                    activeBoard={activeBoard}
                    onSelectBoard={onSelectBoard}
                    onCreateBoard={onCreateBoard}
                    onEditBoard={onEditBoard}
                    onDeleteBoard={onDeleteBoard}
                />

                {/* Edit Board Button */}
                {onEditBoard && (
                    <button
                        onClick={() => onEditBoard(activeBoard)}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        title="Configurações do Board"
                    >
                        <Settings size={20} />
                    </button>
                )}

                {/* Export Template Button */}
                {onExportTemplates && (
                    <button
                        onClick={onExportTemplates}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        title="Exportar template (comunidade)"
                    >
                        <Download size={20} />
                    </button>
                )}

                {/* Automation Guide Button */}
                {activeBoard.automationSuggestions && activeBoard.automationSuggestions.length > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors relative group"
                                title="Automações Sugeridas"
                            >
                                <Lightbulb size={20} className="fill-current" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                            <div className="p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Lightbulb size={16} className="text-yellow-500" />
                                    Automações Sugeridas
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Dicas da IA para otimizar este processo.
                                </p>
                            </div>
                            <div className="p-2">
                                <ul className="space-y-1">
                                    {activeBoard.automationSuggestions.map((suggestion, idx) => (
                                        <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-md flex gap-2 items-start">
                                            <span className="text-slate-400 mt-0.5">•</span>
                                            <span>{suggestion}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                {/* VIEW TOGGLE */}
                <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setViewMode('kanban')}
                        aria-label="Visualização em quadro Kanban"
                        aria-pressed={viewMode === 'kanban'}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <LayoutGrid size={16} aria-hidden="true" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        aria-label="Visualização em lista"
                        aria-pressed={viewMode === 'list'}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <TableIcon size={16} aria-hidden="true" />
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block"></div>

                <div className="flex-1 w-full min-w-[280px]">
                    <FilterBar
                        definitions={filterDefinitions}
                        activeFilters={activeFilters}
                        onAddFilter={handleAddFilter}
                        onRemoveFilter={handleRemoveFilter}
                        onClearFilters={handleClearFilters}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        searchPlaceholder="Filtrar negócios ou empresas..."
                    />
                </div>
            </div>

            <div className="flex gap-3">
                {onExportDeals && (
                    <button
                        type="button"
                        onClick={onExportDeals}
                        title="Exportar negócios visíveis"
                        className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                        <Download size={20} aria-hidden="true" />
                    </button>
                )}
                <button
                    onClick={onNewDeal}
                    className="bg-primary-700 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-primary-700/20"
                >
                    <Plus size={18} aria-hidden="true" /> Novo Negócio
                </button>
            </div>
        </div>
    );
};
