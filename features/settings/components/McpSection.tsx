import React from 'react';
import { ServerCog, Copy, ExternalLink } from 'lucide-react';
import { useOptionalToast } from '@/context/ToastContext';
import { SettingsSection } from './SettingsSection';

/**
 * Seção de configurações para MCP (Model Context Protocol).
 * Expõe o CRM como MCP Server via `/api/mcp`.
 */
export const McpSection: React.FC = () => {
  const { addToast } = useOptionalToast();

  const endpoint = '/api/mcp';
  const infoUrl = '/api/mcp';

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} copiado.`, 'success');
    } catch {
      addToast(`Não foi possível copiar ${label.toLowerCase()}.`, 'error');
    }
  };

  return (
    <SettingsSection title="MCP" icon={ServerCog}>
      <div className="mt-4">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          O MCP (Model Context Protocol) permite conectar ferramentas/assistentes ao CRM como “server de tools”.
          <br />
          Autenticação: <span className="font-mono">Authorization: Bearer {'<API_KEY>'}</span> (ou <span className="font-mono">X-Api-Key</span>).
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-4">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Endpoint</div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-black/20 text-slate-800 dark:text-slate-100">
              POST {endpoint}
            </div>
            <button
              type="button"
              onClick={() => copy('Endpoint', endpoint)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copiar
            </button>
            <a
              href={infoUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir info
            </a>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};

