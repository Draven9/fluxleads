import React, { useMemo, useState } from 'react';
import { Webhook, ArrowRight, Copy, Check, Link as LinkIcon, Pencil, Power, Trash2, KeyRound, HelpCircle } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { Modal } from '@/components/ui/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import { useBoards } from '@/context/boards/BoardsContext';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

type InboundSourceRow = {
  id: string;
  name: string;
  entry_board_id: string;
  entry_stage_id: string;
  secret: string;
  active: boolean;
};

type OutboundEndpointRow = {
  id: string;
  name: string;
  url: string;
  secret: string;
  active: boolean;
};

function generateSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  const b64 = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return b64;
}

function buildWebhookUrl(sourceId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/functions/v1/webhook-in/${sourceId}`;
}

function buildCurlExample(url: string, secret: string) {
  return `curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Webhook-Secret: ${secret}' \\
  -d '{
    "external_event_id": "teste-123",
    "name": "Lead Teste",
    "email": "teste@exemplo.com",
    "phone": "+55...",
    "source": "webhook"
  }'`;
}

/**
 * Componente React `WebhooksSection`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const WebhooksSection: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const { boards, loading: boardsLoading } = useBoards();

  const [sources, setSources] = useState<InboundSourceRow[]>([]);
  const [endpoint, setEndpoint] = useState<OutboundEndpointRow | null>(null);
  const [loading, setLoading] = useState(false);

  // Wizard/Edit inbound (1 passo)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const defaultBoard = useMemo(() => boards.find(b => b.isDefault) || boards[0] || null, [boards]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const selectedBoard = useMemo(
    () => boards.find(b => b.id === selectedBoardId) || defaultBoard,
    [boards, selectedBoardId, defaultBoard]
  );
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const stages = selectedBoard?.stages || [];

  const [createTestLead, setCreateTestLead] = useState(false);

  // Final screen
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [createdSecret, setCreatedSecret] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Follow-up modal
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [followUpUrl, setFollowUpUrl] = useState('');

  // Help / documentation (in-product)
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Confirm modals
  const [confirmDeleteInboundOpen, setConfirmDeleteInboundOpen] = useState(false);
  const [confirmDeleteOutboundOpen, setConfirmDeleteOutboundOpen] = useState(false);

  const canUse = profile?.role === 'admin' && !!profile?.organization_id;

  const activeInbound = useMemo(() => sources.find((s) => s.active) || sources[0] || null, [sources]);
  const hasInbound = !!activeInbound && !!activeInbound.active;

  const inboundBoardName = useMemo(() => {
    if (!activeInbound) return null;
    const b = boards.find((x) => x.id === activeInbound.entry_board_id);
    return b?.name || null;
  }, [activeInbound, boards]);

  const inboundStageLabel = useMemo(() => {
    if (!activeInbound) return null;
    const b = boards.find((x) => x.id === activeInbound.entry_board_id);
    const s = b?.stages?.find((x) => x.id === activeInbound.entry_stage_id);
    return s?.label || null;
  }, [activeInbound, boards]);

  async function loadWebhooks() {
    if (!canUse) return;
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: srcData } = await supabase
        .from('integration_inbound_sources')
        .select('id,name,entry_board_id,entry_stage_id,secret,active')
        .order('created_at', { ascending: false });
      setSources((srcData as any) || []);

      const { data: epData } = await supabase
        .from('integration_outbound_endpoints')
        .select('id,name,url,secret,active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setEndpoint((epData as any) || null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!canUse) return;
    if (!supabase) return;

    loadWebhooks();
  }, [canUse]);

  React.useEffect(() => {
    if (!selectedBoardId && defaultBoard?.id) setSelectedBoardId(defaultBoard.id);
  }, [defaultBoard?.id, selectedBoardId]);

  React.useEffect(() => {
    if (!selectedStageId && stages.length > 0) {
      // Heurística: preferir um estágio com label "Novo" se existir, senão o primeiro
      const preferred =
        stages.find(s => (s.label || '').toLowerCase().includes('novo')) || stages[0];
      setSelectedStageId(preferred.id);
    }
  }, [stages, selectedStageId]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1200);
  }

  function CodeBlock({ label, text, copyKey }: { label: string; text: string; copyKey: string }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</div>
          <button
            onClick={() => copy(text, copyKey)}
            className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {copiedKey === copyKey ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            Copiar
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-xs p-3 rounded-lg bg-slate-900 text-slate-100 border border-slate-800">
          {text}
        </pre>
      </div>
    );
  }

  async function handleActivateInbound() {
    if (!canUse) return;
    if (!selectedBoard?.id || !selectedStageId) return;

    const secret = generateSecret();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integration_inbound_sources')
        .insert({
          organization_id: profile!.organization_id,
          name: 'Entrada de Leads',
          entry_board_id: selectedBoard.id,
          entry_stage_id: selectedStageId,
          secret,
          active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      const sourceId = (data as any)?.id as string;
      const url = buildWebhookUrl(sourceId);
      setCreatedUrl(url);
      setCreatedSecret(secret);
      setIsWizardOpen(false);
      setIsDoneOpen(true);

      // refresh list
      setSources((prev) => [{ id: sourceId, name: 'Entrada de Leads', entry_board_id: selectedBoard.id, entry_stage_id: selectedStageId, secret, active: true }, ...prev]);

      if (createTestLead) {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': secret,
          },
          body: JSON.stringify({
            external_event_id: `teste-${Date.now()}`,
            name: 'Lead Teste',
            email: `teste+${Date.now()}@exemplo.com`,
            phone: '+55...',
            source: 'webhook',
          }),
        });
        addToast('Lead de teste enviado! Verifique o funil.', 'success');
      } else {
        addToast('Entrada de leads ativada!', 'success');
      }
    } catch (e: any) {
      addToast(e?.message || 'Erro ao ativar entrada de leads', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFollowUp() {
    if (!canUse) return;
    if (!followUpUrl.trim()) return;

    setLoading(true);
    try {
      if (endpoint?.id) {
        const { data, error } = await supabase
          .from('integration_outbound_endpoints')
          .update({
            url: followUpUrl.trim(),
          })
          .eq('id', endpoint.id)
          .select('id,name,url,secret,active')
          .single();
        if (error) throw error;
        setEndpoint(data as any);
        addToast('Follow-up atualizado!', 'success');
      } else {
        const secret = generateSecret();
        const { data, error } = await supabase
          .from('integration_outbound_endpoints')
          .insert({
            organization_id: profile!.organization_id,
            name: 'Follow-up (Webhook)',
            url: followUpUrl.trim(),
            secret,
            events: ['deal.stage_changed'],
            active: true,
          })
          .select('id,name,url,secret,active')
          .single();

        if (error) throw error;
        setEndpoint(data as any);
        addToast('Follow-up conectado!', 'success');
      }
      setIsFollowUpOpen(false);
      setFollowUpUrl('');
    } catch (e: any) {
      addToast(e?.message || 'Erro ao salvar follow-up', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEditInbound() {
    if (!activeInbound) return;
    setWizardMode('edit');
    setEditingSourceId(activeInbound.id);
    setSelectedBoardId(activeInbound.entry_board_id);
    setSelectedStageId(activeInbound.entry_stage_id);
    setCreateTestLead(false);
    setIsWizardOpen(true);
  }

  async function handleSaveInboundEdit() {
    if (!canUse) return;
    if (!editingSourceId) return;
    if (!selectedBoard?.id || !selectedStageId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('integration_inbound_sources')
        .update({
          entry_board_id: selectedBoard.id,
          entry_stage_id: selectedStageId,
        })
        .eq('id', editingSourceId);
      if (error) throw error;
      addToast('Entrada de leads atualizada!', 'success');
      await loadWebhooks();
      setIsWizardOpen(false);
    } catch (e: any) {
      addToast(e?.message || 'Erro ao atualizar entrada de leads', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleInboundActive(nextActive: boolean) {
    if (!canUse) return;
    if (!activeInbound) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integration_inbound_sources')
        .update({ active: nextActive })
        .eq('id', activeInbound.id);
      if (error) throw error;
      addToast(nextActive ? 'Entrada de leads ativada!' : 'Entrada de leads desativada.', 'success');
      await loadWebhooks();
    } catch (e: any) {
      addToast(e?.message || 'Erro ao atualizar status do webhook', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteInbound() {
    if (!canUse) return;
    if (!activeInbound) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integration_inbound_sources')
        .delete()
        .eq('id', activeInbound.id);
      if (error) throw error;
      addToast('Configuração de entrada removida.', 'success');
      await loadWebhooks();
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir webhook', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleOutboundActive(nextActive: boolean) {
    if (!canUse) return;
    if (!endpoint?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integration_outbound_endpoints')
        .update({ active: nextActive })
        .eq('id', endpoint.id);
      if (error) throw error;
      addToast(nextActive ? 'Follow-up ativado!' : 'Follow-up desativado.', 'success');
      await loadWebhooks();
    } catch (e: any) {
      addToast(e?.message || 'Erro ao atualizar follow-up', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateOutboundSecret() {
    if (!canUse) return;
    if (!endpoint?.id) return;
    const nextSecret = generateSecret();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integration_outbound_endpoints')
        .update({ secret: nextSecret })
        .eq('id', endpoint.id)
        .select('id,name,url,secret,active')
        .single();
      if (error) throw error;
      setEndpoint(data as any);
      addToast('Secret do follow-up regenerado. Atualize no seu n8n/Make/WhatsApp.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Erro ao regenerar secret', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOutbound() {
    if (!canUse) return;
    if (!endpoint?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integration_outbound_endpoints')
        .delete()
        .eq('id', endpoint.id);
      if (error) throw error;
      setEndpoint(null);
      addToast('Follow-up removido.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Erro ao excluir follow-up', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsSection title="Webhooks" icon={Webhook}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
        Ative automações sem técnico: escolha onde os leads entram e (opcionalmente) conecte um endpoint
        para follow-up quando um lead mudar de etapa.
      </p>

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Dica: se você está integrando com Hotmart/n8n/Make, use o guia rápido.
        </div>
        <button
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          Como usar
        </button>
      </div>

      {!canUse ? (
        <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-600 dark:text-slate-300">
          Disponível apenas para administradores.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Entrada */}
          <div className="p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Entrada de Leads (Webhook)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Receba leads de Hotmart, formulários, n8n/Make e crie automaticamente um negócio no funil.
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${hasInbound ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>
                {hasInbound ? 'Ativo' : 'Desativado'}
              </span>
            </div>

            {activeInbound ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Fonte: <span className="font-medium text-slate-700 dark:text-slate-200">{activeInbound.name}</span>
                  {inboundBoardName && inboundStageLabel ? (
                    <>
                      {' '}· <span className="text-slate-600 dark:text-slate-300">{inboundBoardName}</span>
                      {' '}→ <span className="text-slate-600 dark:text-slate-300">{inboundStageLabel}</span>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copy(buildWebhookUrl(activeInbound.id), 'url')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar URL
                    {copiedKey === 'url' && <Check className="h-4 w-4 text-green-600" />}
                  </button>
                  <button
                    onClick={() => copy(activeInbound.secret, 'inboundSecret')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <KeyRound className="h-4 w-4" />
                    Copiar secret
                    {copiedKey === 'inboundSecret' && <Check className="h-4 w-4 text-green-600" />}
                  </button>
                  <button
                    onClick={handleEditInbound}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleInboundActive(!activeInbound.active)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    <Power className="h-4 w-4" />
                    {activeInbound.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteInboundOpen(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => { setWizardMode('create'); setEditingSourceId(null); setIsWizardOpen(true); }}
                  disabled={loading || boardsLoading || boards.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Ativar entrada de leads
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Saída */}
          <div className="p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Follow-up (Webhook de saída)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Quando um lead mudar de etapa, enviamos um aviso para seu WhatsApp/n8n/Make.
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${endpoint?.active ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>
                {endpoint?.active ? 'Ativo' : 'Desativado'}
              </span>
            </div>

            {endpoint ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  <span className="font-mono truncate max-w-[520px]">{endpoint.url}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copy(endpoint.url, 'outboundUrl')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar URL
                    {copiedKey === 'outboundUrl' && <Check className="h-4 w-4 text-green-600" />}
                  </button>
                  <button
                    onClick={() => copy(endpoint.secret, 'outboundSecret')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <KeyRound className="h-4 w-4" />
                    Copiar secret
                    {copiedKey === 'outboundSecret' && <Check className="h-4 w-4 text-green-600" />}
                  </button>
                  <button
                    onClick={() => { setFollowUpUrl(endpoint.url); setIsFollowUpOpen(true); }}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleOutboundActive(!endpoint.active)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    <Power className="h-4 w-4" />
                    {endpoint.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={handleRegenerateOutboundSecret}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    <KeyRound className="h-4 w-4" />
                    Regenerar secret
                  </button>
                  <button
                    onClick={() => setConfirmDeleteOutboundOpen(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => setIsFollowUpOpen(true)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                >
                  Conectar follow-up (opcional)
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wizard modal (1 passo) */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title={wizardMode === 'edit' ? 'Editar entrada de leads' : 'Ativar entrada de leads'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Onde você quer que novos leads entrem no CRM?
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Board (funil)</label>
            <select
              value={selectedBoard?.id || ''}
              onChange={(e) => {
                setSelectedBoardId(e.target.value);
                setSelectedStageId('');
              }}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
            >
              {boards.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.isDefault ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Estágio de entrada</label>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
              disabled={!selectedBoard || stages.length === 0}
            >
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {wizardMode === 'create' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={createTestLead}
                onChange={(e) => setCreateTestLead(e.target.checked)}
              />
              Criar um lead de teste ao finalizar
            </label>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setIsWizardOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={wizardMode === 'edit' ? handleSaveInboundEdit : handleActivateInbound}
              disabled={loading || !selectedBoard?.id || !selectedStageId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {wizardMode === 'edit' ? 'Salvar' : 'Ativar agora'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* Done modal */}
      <Modal
        isOpen={isDoneOpen}
        onClose={() => setIsDoneOpen(false)}
        title="Pronto! Sua entrada de leads está ativa"
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">URL do webhook</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                {createdUrl}
              </div>
              <button
                onClick={() => copy(createdUrl, 'createdUrl')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10"
                aria-label="Copiar URL"
              >
                {copiedKey === 'createdUrl' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Secret</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                {createdSecret}
              </div>
              <button
                onClick={() => copy(createdSecret, 'createdSecret')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10"
                aria-label="Copiar secret"
              >
                {copiedKey === 'createdSecret' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Dica: copie e cole este secret no seu Hotmart/n8n/Make. Ele funciona como senha do webhook.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Exemplo (cURL)</div>
            <div className="relative">
              <pre className="whitespace-pre-wrap text-xs p-3 rounded-lg bg-slate-900 text-slate-100 border border-slate-800">
                {buildCurlExample(createdUrl, createdSecret)}
              </pre>
              <button
                onClick={() => copy(buildCurlExample(createdUrl, createdSecret), 'curl')}
                className="absolute top-2 right-2 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 inline-flex items-center gap-1"
              >
                {copiedKey === 'curl' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copiar
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => { setIsDoneOpen(false); setIsFollowUpOpen(true); }}
              className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Conectar follow-up agora (opcional)
            </button>
            <button
              onClick={() => setIsDoneOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      {/* Follow-up modal */}
      <Modal
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        title={endpoint?.id ? 'Editar follow-up' : 'Conectar follow-up'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Cole a URL do seu WhatsApp/n8n/Make. Quando um lead mudar de etapa, enviaremos um aviso.
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">URL do destino</label>
            <input
              value={followUpUrl}
              onChange={(e) => setFollowUpUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setIsFollowUpOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              Agora não
            </button>
            <button
              onClick={handleSaveFollowUp}
              disabled={loading || !followUpUrl.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {endpoint?.id ? 'Salvar' : 'Conectar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDeleteInboundOpen}
        onClose={() => setConfirmDeleteInboundOpen(false)}
        onConfirm={handleDeleteInbound}
        title="Excluir webhook de entrada?"
        message={
          <div>
            Isso remove apenas a <b>configuração</b> do webhook (URL/secret param de entrada). Leads já criados no CRM não serão apagados.
          </div>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={confirmDeleteOutboundOpen}
        onClose={() => setConfirmDeleteOutboundOpen(false)}
        onConfirm={handleDeleteOutbound}
        title="Excluir follow-up (webhook de saída)?"
        message={
          <div>
            Isso remove apenas a <b>configuração</b> do follow-up. O CRM não enviará mais notificações quando o lead mudar de etapa.
          </div>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
      />

      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Como usar Webhooks (guia rápido)"
        size="xl"
        bodyClassName="max-h-[70vh] overflow-auto"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10">
            <div className="text-sm font-bold text-slate-900 dark:text-white">Resumo</div>
            <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                <b>Inbound</b>: você envia um <code>POST</code> para a URL do CRM + header <code>X-Webhook-Secret</code> e o CRM cria contato + negócio.
              </li>
              <li>
                <b>Outbound</b>: quando o negócio muda de etapa, o CRM envia um <code>POST</code> para sua URL (n8n/Make/etc) com o mesmo header <code>X-Webhook-Secret</code>.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">1) Entrada de Leads (Inbound)</div>
            <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Clique em <b>Ativar entrada de leads</b> e escolha o <b>Board</b> e o <b>Estágio</b> de entrada.</li>
              <li>Copie a <b>URL</b> e o <b>Secret</b> e cole no seu provedor (Hotmart/n8n/Make/form).</li>
              <li>No provedor, envie o JSON (abaixo) e sempre que possível envie um <code>external_event_id</code> para idempotência.</li>
            </ol>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Headers obrigatórios</div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <code>Content-Type: application/json</code>
                  <br />
                  <code>X-Webhook-Secret: {'<secret>'}</code>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Payload (exemplo)</div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <code>{`{ "external_event_id": "...", "name": "...", "email": "...", "phone": "...", "source": "hotmart" }`}</code>
                </div>
              </div>
            </div>

            {(() => {
              const inboundUrl = activeInbound ? buildWebhookUrl(activeInbound.id) : `https://SEU-PROJETO.supabase.co/functions/v1/webhook-in/<source_id>`;
              const inboundSecret = activeInbound ? activeInbound.secret : '<secret>';
              const curl = buildCurlExample(inboundUrl, inboundSecret);
              return <CodeBlock label="Teste rápido (cURL)" text={curl} copyKey="helpCurlInbound" />;
            })()}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">2) Follow-up (Outbound)</div>
            <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Clique em <b>Conectar follow-up</b> e cole a URL do seu endpoint (n8n/Make/etc).</li>
              <li>O CRM dispara quando um negócio <b>muda de etapa</b> (stage change).</li>
              <li>No seu endpoint, valide o header <code>X-Webhook-Secret</code>.</li>
            </ol>

            {endpoint?.url ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Sua URL (destino)</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 font-mono break-all">{endpoint.url}</div>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Secret (header)</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 font-mono break-all">{endpoint.secret}</div>
                </div>
              </div>
            ) : null}

            <CodeBlock
              label="Payload enviado (exemplo)"
              copyKey="helpOutboundPayload"
              text={`{
  "event_type": "deal.stage_changed",
  "occurred_at": "2025-12-26T00:00:00.000Z",
  "deal": {
    "id": "...",
    "title": "...",
    "value": 0,
    "board_id": "...",
    "board_name": "...",
    "from_stage_id": "...",
    "from_stage_label": "...",
    "to_stage_id": "...",
    "to_stage_label": "...",
    "contact_id": "..."
  },
  "contact": { "name": "...", "phone": "...", "email": "..." }
}`}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">3) Troubleshooting (onde ver se chegou)</div>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                <b>Inbound</b>: tabela <code>webhook_events_in</code> (eventos recebidos e status).
              </li>
              <li>
                <b>Outbound</b>: tabelas <code>webhook_events_out</code> (eventos gerados) e <code>webhook_deliveries</code> (tentativas de entrega).
              </li>
              <li>
                Se você estiver em n8n/Make, também olhe o histórico do workflow para ver o request e a validação do secret.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={() => setIsHelpOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      </Modal>
    </SettingsSection>
  );
};
