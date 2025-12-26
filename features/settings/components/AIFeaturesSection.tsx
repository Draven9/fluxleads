'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCRM } from '@/context/CRMContext';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

type FeatureItem = {
  key: string;
  title: string;
  description: string;
};

const FEATURES: FeatureItem[] = [
  { key: 'ai_chat_agent', title: 'Chat do agente (Pilot)', description: 'Chat principal com ferramentas do CRM.' },
  { key: 'ai_sales_script', title: 'Script de vendas', description: 'Geração de script (Inbox / ações).' },
  { key: 'ai_daily_briefing', title: 'Briefing diário', description: 'Resumo diário de prioridades.' },
  { key: 'ai_deal_analyze', title: 'Análise de deal (coach)', description: 'Sugere próxima ação e urgência.' },
  { key: 'ai_email_draft', title: 'Rascunho de e-mail', description: 'Gera email profissional para o deal.' },
  { key: 'ai_objection_responses', title: 'Objeções (3 respostas)', description: 'Gera alternativas para contornar objeções.' },
  { key: 'ai_board_generate_structure', title: 'Boards: gerar estrutura', description: 'Cria estágios e automações sugeridas.' },
  { key: 'ai_board_generate_strategy', title: 'Boards: gerar estratégia', description: 'Define meta/KPI/persona do board.' },
  { key: 'ai_board_refine', title: 'Boards: refinar com IA', description: 'Refina o board via chat/instruções.' },
];

export const AIFeaturesSection: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { aiFeatureFlags, setAIFeatureFlag } = useCRM();
  const { showToast } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const items = useMemo(() => FEATURES, []);

  const getEnabled = (key: string) => {
    const v = aiFeatureFlags?.[key];
    return v !== false; // default: enabled
  };

  const toggle = async (key: string, enabled: boolean) => {
    if (!isAdmin) return;
    setSavingKey(key);
    try {
      await setAIFeatureFlag(key, enabled);
      showToast(enabled ? 'Função ativada' : 'Função desativada', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Falha ao salvar', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div id="ai-features" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl p-4 shadow-sm scroll-mt-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-700 dark:text-slate-200">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Funções de IA</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Controle granular do que a IA pode fazer (por organização).
            </p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Apenas administradores podem configurar as funções de IA.
        </div>
      )}

      <div className="mt-3 divide-y divide-slate-200/70 dark:divide-white/10">
        {items.map((f) => {
          const enabled = getEnabled(f.key);
          const saving = savingKey === f.key;
          return (
            <div key={f.key} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 dark:text-white">{f.title}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{f.description}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                <label className={`relative inline-flex items-center ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={enabled}
                    disabled={!isAdmin || saving}
                    onChange={(e) => toggle(f.key, e.target.checked)}
                    aria-label={`Ativar ${f.title}`}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

