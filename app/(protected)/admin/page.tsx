'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Building2, Users, Contact, TrendingUp, Plus, X,
  Eye, AlertCircle, CheckCircle2, Loader2, RefreshCw
} from 'lucide-react';

interface OrgCount { count: number }
interface Organization {
  id: string;
  name: string;
  created_at: string;
  users_count: OrgCount[];
  contacts_count: OrgCount[];
  deals_count: OrgCount[];
}

interface NewTenantForm {
  orgName: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

const EMPTY_FORM: NewTenantForm = {
  orgName: '', adminEmail: '', adminName: '', adminPassword: ''
};

export default function AdminPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewTenantForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [impersonating, setImpersonating] = useState<string | null>(null);

  const handleImpersonate = async (orgId: string) => {
    setImpersonating(orgId);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alternar empresa');
      
      // Force a full location reload to reset contexts, caches, and RLS scopes completely
      window.location.href = '/dashboard';
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
      setImpersonating(null);
    }
  };

  // Guard: only admin/owner
  useEffect(() => {
    if (!authLoading && profile && !['admin', 'owner'].includes(profile.role)) {
      router.replace('/dashboard');
    }
  }, [authLoading, profile, router]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/organizations');
      if (!res.ok) throw new Error('Erro ao carregar organizações');
      const data = await res.json();
      setOrgs(data.organizations ?? []);
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/provision-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar cliente');
      setFeedback({ type: 'success', message: `Empresa "${form.orgName}" criada com sucesso! Admin: ${form.adminEmail}` });
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchOrgs();
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 size={24} className="text-primary-500" />
            Painel de Empresas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie e crie novas empresas cliente no sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrgs}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nova Empresa
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
          <span className="flex-1">{feedback.message}</span>
          <button onClick={() => setFeedback(null)}><X size={16} /></button>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">Nova Empresa Cliente</h2>
                <p className="text-xs text-slate-500 mt-0.5">Cria organização, funil e acesso admin</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Nome da Empresa *</label>
                <input
                  type="text"
                  value={form.orgName}
                  onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                  placeholder="Ex: Empresa ABC Ltda"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Nome do Admin *</label>
                  <input
                    type="text"
                    value={form.adminName}
                    onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))}
                    placeholder="João Silva"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Senha inicial *</label>
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    placeholder="Mín. 8 caracteres"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">E-mail do Admin *</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@empresa.com.br"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : 'Criar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organizations Table */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-primary-500" size={28} />
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Building2 size={36} className="mb-2 opacity-40" />
            <p className="text-sm">Nenhuma empresa cadastrada ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Users size={12} className="inline mr-1" />Usuários
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Contact size={12} className="inline mr-1" />Contatos
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <TrendingUp size={12} className="inline mr-1" />Negócios
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Criada em</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orgs.map((org) => {
                const users = org.users_count?.[0]?.count ?? 0;
                const contacts = org.contacts_count?.[0]?.count ?? 0;
                const deals = org.deals_count?.[0]?.count ?? 0;
                const isCurrentOrg = org.id === profile?.organization_id;
                return (
                  <tr key={org.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isCurrentOrg ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {org.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{org.name}</p>
                          {isCurrentOrg && (
                            <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">Sua empresa atual</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{users}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{contacts}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{deals}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(org.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isCurrentOrg && (
                          <button
                            onClick={() => handleImpersonate(org.id)}
                            disabled={impersonating === org.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Entrar no sistema desta empresa"
                          >
                            {impersonating === org.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Acessar
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/admin/organizations/${org.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye size={14} />
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
