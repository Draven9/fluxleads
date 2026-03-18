'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Smartphone, Wifi, WifiOff, Loader2, Trash2, Copy, Check, RefreshCw, ChevronDown } from 'lucide-react';
import { whatsappService, WhatsAppSource } from '@/lib/supabase/whatsapp';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ─── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ connected }: { connected: boolean }) => (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${connected
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
        {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {connected ? 'Conectado' : 'Desconectado'}
    </span>
);

// ─── Provider Type Label ───────────────────────────────────────────────────────

const providerLabel = (type: string) => {
    if (type === 'uazapi') return 'uazapi';
    if (type === 'evolution') return 'Evolution API';
    if (type === 'meta') return 'Meta Cloud API';
    return type;
};

const providerColor = (type: string) => {
    if (type === 'uazapi') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    if (type === 'evolution') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
};

// ─── Add Instance Form ─────────────────────────────────────────────────────────

interface AddFormProps {
    organizationId: string;
    onSaved: () => void;
    onCancel: () => void;
}

const AddInstanceForm: React.FC<AddFormProps> = ({ organizationId, onSaved, onCancel }) => {
    const [form, setForm] = useState({
        name: '',
        display_name: '',
        phone_number: '',
        provider_type: 'uazapi' as 'uazapi' | 'evolution',
        // uazapi
        token: '',
        baseUrl: 'https://api.uazapi.com',
        // evolution
        apiKey: '',
        instanceName: '',
        evolutionUrl: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!form.name) return setError('Nome da instância é obrigatório');
        setSaving(true);
        setError('');

        const configuration: Record<string, string> = {};
        if (form.provider_type === 'uazapi') {
            if (!form.token) { setError('Token é obrigatório para uazapi'); setSaving(false); return; }
            configuration.token = form.token;
            configuration.baseUrl = form.baseUrl || 'https://api.uazapi.com';
        } else {
            if (!form.apiKey || !form.instanceName || !form.evolutionUrl) {
                setError('API Key, URL base e Nome da instância são obrigatórios para Evolution API');
                setSaving(false); return;
            }
            configuration.apiKey = form.apiKey;
            configuration.instanceName = form.instanceName;
            configuration.baseUrl = form.evolutionUrl;
        }

        // Need entry_board_id and entry_stage_id (required). Get first board+stage from org.
        const { data: board } = await supabase
            .from('boards').select('id').eq('organization_id', organizationId).limit(1).maybeSingle();
        const { data: stage } = board
            ? await supabase.from('board_stages').select('id').eq('board_id', board.id).limit(1).maybeSingle()
            : { data: null };

        const { error: dbErr } = await supabase.from('integration_inbound_sources').insert({
            organization_id: organizationId,
            name: form.name,
            display_name: form.display_name || null,
            phone_number: form.phone_number || null,
            provider_type: form.provider_type,
            configuration,
            secret: crypto.randomUUID(),
            entry_board_id: board?.id,
            entry_stage_id: stage?.id,
            active: true,
        });

        setSaving(false);
        if (dbErr) { setError(dbErr.message); return; }
        onSaved();
    };

    const input = 'w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white text-sm border border-transparent focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 placeholder-slate-400';

    return (
        <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-slate-50 dark:bg-white/2 space-y-3">
            <h4 className="font-semibold text-slate-800 dark:text-white text-sm">Nova instância WhatsApp</h4>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Nome interno *</label>
                    <input className={input} placeholder="Ex: Comercial" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Nome de exibição</label>
                    <input className={input} placeholder="Ex: Vendas" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Número (+5511...)</label>
                    <input className={input} placeholder="+5511999999999" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Provider *</label>
                    <select className={input} value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value as any }))}>
                        <option value="uazapi">uazapi</option>
                        <option value="evolution">Evolution API</option>
                    </select>
                </div>
            </div>

            {form.provider_type === 'uazapi' ? (
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Token da instância *</label>
                        <input type="password" className={input} placeholder="Token copiado do painel uazapi" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">URL Base</label>
                        <input className={input} value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">URL da Evolution API *</label>
                        <input className={input} placeholder="https://evolution.seuserver.com" value={form.evolutionUrl} onChange={e => setForm(f => ({ ...f, evolutionUrl: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">API Key *</label>
                            <input type="password" className={input} placeholder="apikey do painel" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Nome da Instância *</label>
                            <input className={input} placeholder="MinhaInstancia" value={form.instanceName} onChange={e => setForm(f => ({ ...f, instanceName: e.target.value }))} />
                        </div>
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Salvar instância
                </button>
            </div>
        </div>
    );
};

// ─── CopyButton ────────────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={copy} title="Copiar URL do webhook" className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export const WhatsAppInstancesManager: React.FC = () => {
    const { profile } = useAuth();
    const [sources, setSources] = useState<WhatsAppSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [statuses, setStatuses] = useState<Record<string, boolean>>({});
    const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});

    const orgId = profile?.organization_id ?? '';

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await whatsappService.listSources();
        setSources(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const checkStatus = async (source: WhatsAppSource) => {
        setCheckingStatus(s => ({ ...s, [source.id]: true }));
        try {
            const { data } = await whatsappService.instanceStatus(source.id);
            // Se o retorno for erro 404 ou erro genérico do proxy mas é Uazapi
            if (source.provider_type === 'uazapi' && data?.error) {
                // Falso positivo: a API de envio funciona mas a de status não existe
                setStatuses(s => ({ ...s, [source.id]: true }));
            } else {
                const connected = !!(data && !data.error &&
                    (data.connected === true || data.status === 'open' || data.instanceStatus?.status === 'open' || data.state === 'open'));
                setStatuses(s => ({ ...s, [source.id]: connected }));
            }
        } catch (e) {
            setStatuses(s => ({ ...s, [source.id]: false }));
        } finally {
            setCheckingStatus(s => ({ ...s, [source.id]: false }));
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Remover essa instância? As conversas existentes serão mantidas.')) return;
        await supabase.from('integration_inbound_sources').delete().eq('id', id);
        setSources(s => s.filter(x => x.id !== id));
    };

    const webhookUrl = (id: string) =>
        `${SUPABASE_URL.trim()}/functions/v1/whatsapp-inbound?source=${id}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-white">Instâncias WhatsApp</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cada instância representa um número conectado. Configure a URL do webhook no painel da uazapi ou Evolution.
                    </p>
                </div>
                {!showAdd && (
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar número
                    </button>
                )}
            </div>

            {showAdd && orgId && (
                <AddInstanceForm
                    organizationId={orgId}
                    onSaved={() => { setShowAdd(false); load(); }}
                    onCancel={() => setShowAdd(false)}
                />
            )}

            {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                </div>
            ) : sources.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    <Smartphone className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum número configurado ainda.</p>
                    <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-primary-600 hover:underline">
                        + Adicionar primeiro número
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sources.map(source => {
                        const webhook = webhookUrl(source.id);
                        const isConnected = statuses[source.id];
                        const isChecking = checkingStatus[source.id];

                        return (
                            <div key={source.id} className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-white/2 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800 dark:text-white text-sm">
                                                {source.display_name || source.name}
                                            </span>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${providerColor(source.provider_type)}`}>
                                                {providerLabel(source.provider_type)}
                                            </span>
                                            {source.id in statuses && <StatusBadge connected={isConnected} />}
                                        </div>

                                        {source.phone_number && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{source.phone_number}</p>
                                        )}

                                        {/* Webhook URL */}
                                        <div className="mt-2 flex items-center gap-1 bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-1.5">
                                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate flex-1">
                                                {webhook}
                                            </span>
                                            <CopyButton text={webhook} />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => checkStatus(source)}
                                            title="Testar conexão"
                                            disabled={isChecking}
                                            className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
                                        >
                                            {isChecking
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <RefreshCw className="w-4 h-4" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => handleDelete(source.id)}
                                            title="Remover instância"
                                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
