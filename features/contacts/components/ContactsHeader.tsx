import React from 'react';
import { Plus, Download } from 'lucide-react';

interface ContactsHeaderProps {
  viewMode: 'people' | 'companies';
  openCreateModal: () => void;
  openImportExportModal?: () => void;
}

export const ContactsHeader: React.FC<ContactsHeaderProps> = ({
  viewMode,
  openCreateModal,
  openImportExportModal,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
          {viewMode === 'people' ? 'Contatos (Pessoas)' : 'Empresas (Contas)'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {viewMode === 'people'
            ? 'Pessoas com quem você negocia.'
            : 'Organizações onde seus contatos trabalham.'}
        </p>
      </div>
      <div className="flex gap-3 w-full sm:w-auto">
        {viewMode === 'people' && (
          <button
            type="button"
            onClick={openImportExportModal}
            aria-label="Importar/Exportar contatos"
            className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <Download size={20} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={openCreateModal}
          className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-primary-600/20"
        >
          <Plus size={18} /> {viewMode === 'people' ? 'Novo Contato' : 'Nova Empresa'}
        </button>
      </div>
    </div>
  );
};
