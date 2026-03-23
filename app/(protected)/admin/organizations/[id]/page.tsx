'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, Building2, Mail, User, KeyRound,
  Loader2, CheckCircle2, AlertCircle, Pencil, Save, X
} from 'lucide-react';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface OrgDetail {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  vendedor: 'Vendedor',
  user: 'Usuário',
};

export default function OrgDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { profile, loading: authLoading } = useAuth();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Org edit state
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', email: '' });
  const [savingOrg, setSavingOrg] = useState(false);

  // User edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
  const [savingUser, setSavingUser] = useState(false);

  // Guard: only admin/owner
  useEffect(() => {
    if (!authLoading && profile && !['admin', 'owner'].includes(profile.role)) {
      router.replace('/dashboard');
    }
  }, [authLoading, profile, router]);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${params.id}`);
      if (!res.ok) throw new Error('Erro ao carregar organização');
      const data = await res.json();
      setOrg(data.org);
      setUsers(data.users);
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!authLoading && profile) fetchOrg();
  }, [authLoading, profile, fetchOrg]);

  const startEditOrg = () => {
    setOrgForm({ name: org?.name ?? '', email: org?.email ?? '' });
    setEditingOrg(true);
  };

  const saveOrg = async () => {
    setSavingOrg(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/organizations/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setOrg(prev => prev ? { ...prev, ...orgForm } : prev);
      setEditingOrg(false);
      setFeedback({ type: 'success', message: 'Organização atualizada.' });
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setSavingOrg(false);
    }
  };

  const startEditUser = (u: OrgUser) => {
    setEditingUserId(u.id);
    setUserForm({ name: u.name ?? '', email: u.email ?? '', password: '' });
  };

  const saveUser = async () => {
    if (!editingUserId) return;
    setSavingUser(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar usuário');
      setUsers(prev => prev.map(u =>
        u.id === editingUserId ? { ...u, name: userForm.name, email: userForm.email } : u
      ));
      setEditingUserId(null);
      setFeedback({ type: 'success', message: 'Usuário atualizado.' });
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setSavingUser(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <AlertCircle size={32} className="mb-2" />
        <p>Organização não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {org.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{org.name}</h1>
            <p className="text-xs text-slate-500">
              Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Org Info */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
            <Building2 size={16} />
            Dados da Organização
          </div>
          {!editingOrg && (
            <button
              onClick={startEditOrg}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <Pencil size={13} /> Editar
            </button>
          )}
        </div>

        {editingOrg ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nome da organização</label>
              <input
                value={orgForm.name}
                onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                className={INPUT_CLASS}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">E-mail de contato</label>
              <input
                type="email"
                value={orgForm.email}
                onChange={e => setOrgForm(f => ({ ...f, email: e.target.value }))}
                className={INPUT_CLASS}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingOrg(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveOrg}
                disabled={savingOrg}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {savingOrg ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Building2 size={14} className="text-slate-400" />
              {org.name}
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Mail size={14} className="text-slate-400" />
              {org.email || <span className="text-slate-400 italic">Sem e-mail cadastrado</span>}
            </div>
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-sm">
          <User size={16} />
          Usuários ({users.length})
        </div>

        {users.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
            Nenhum usuário vinculado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <div key={u.id} className="px-6 py-4">
                {editingUserId === u.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                        <input
                          value={userForm.name}
                          onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                          className={INPUT_CLASS}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                          className={INPUT_CLASS}
                          placeholder="email@empresa.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        <KeyRound size={11} className="inline mr-1" />
                        Nova senha <span className="text-slate-400 font-normal">(deixe em branco para não alterar)</span>
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                        className={INPUT_CLASS}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveUser}
                        disabled={savingUser}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                      >
                        {savingUser ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-semibold text-xs shrink-0">
                        {(u.name || u.email).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{u.name || '—'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <button
                        onClick={() => startEditUser(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
