/**
 * Audit Log Dashboard — 5.4
 * Refatorado para usar o hook useAuditLog (lógica de fetch removida do componente).
 */
import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  Info,
  AlertCircle,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog, type AuditSeverity } from '@/lib/query/hooks/useAuditLog';

// Performance: reuse Intl formatter
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDate = (dateStr: string) => DATE_FORMATTER.format(new Date(Date.parse(dateStr)));

const formatRelative = (dateStr: string, nowTs: number) => {
  const diffMs = nowTs - Date.parse(dateStr);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  return DATE_FORMATTER.format(new Date(Date.parse(dateStr)));
};

const SEVERITY_CONFIG: Record<AuditSeverity, {
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
  borderColor: string;
  label: string;
}> = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    label: 'Info',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-500/10',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-500/30',
    label: 'Alerta',
  },
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-500/10',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-500/30',
    label: 'Crítico',
  },
};

const ACTION_LABELS: Record<string, string> = {
  CROSS_TENANT_ATTEMPT: 'Tentativa Cross-Tenant',
  DATA_EXPORT: 'Exportação de Dados',
  DATA_DELETION: 'Exclusão de Dados',
  REVOKE_AI_CONSENT: 'Revogação Consentimento IA',
  REVOKE_ALL_CONSENT: 'Revogação Total de Consentimento',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PASSWORD_CHANGE: 'Alteração de Senha',
  USER_CREATED: 'Usuário Criado',
  USER_DELETED: 'Usuário Excluído',
  deal_created: 'Negócio Criado',
  deal_updated: 'Negócio Atualizado',
  deal_deleted: 'Negócio Excluído',
  deal_moved: 'Negócio Movido',
  contact_created: 'Contato Criado',
  contact_updated: 'Contato Atualizado',
  contact_deleted: 'Contato Excluído',
  message_sent: 'Mensagem Enviada',
  permission_changed: 'Permissão Alterada',
};

export const AuditLogDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { logs, stats, loading, error, filters, setFilters, refetch } = useAuditLog();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Shield className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Acesso Restrito
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Apenas administradores podem visualizar os logs de auditoria.
          </p>
        </div>
      </div>
    );
  }

  const nowTs = Date.now();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-500" />
            Logs de Auditoria
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitore atividades de segurança e tentativas de acesso não autorizado
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Activity, borderColor: 'border-slate-200 dark:border-white/10', iconBg: 'bg-slate-100 dark:bg-white/10', iconColor: 'text-slate-600 dark:text-slate-400', valueColor: 'text-slate-900 dark:text-white' },
          { label: 'Críticos', value: stats.critical, icon: AlertCircle, borderColor: 'border-red-200 dark:border-red-500/30', iconBg: 'bg-red-100 dark:bg-red-500/20', iconColor: 'text-red-600 dark:text-red-400', valueColor: 'text-red-600 dark:text-red-400' },
          { label: 'Alertas', value: stats.warning, icon: AlertTriangle, borderColor: 'border-yellow-200 dark:border-yellow-500/30', iconBg: 'bg-yellow-100 dark:bg-yellow-500/20', iconColor: 'text-yellow-600 dark:text-yellow-400', valueColor: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Informativos', value: stats.info, icon: Info, borderColor: 'border-blue-200 dark:border-blue-500/30', iconBg: 'bg-blue-100 dark:bg-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400', valueColor: 'text-blue-600 dark:text-blue-400' },
        ].map(({ label, value, icon: Icon, borderColor, iconBg, iconColor, valueColor }) => (
          <div key={label} className={`bg-white dark:bg-white/5 border ${borderColor} rounded-xl p-4`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 ${iconBg} rounded-lg`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Filtros:</span>
          </div>

          <select
            value={filters.severityFilter}
            onChange={(e) => setFilters({ severityFilter: e.target.value as AuditSeverity | 'all' })}
            className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todas Severidades</option>
            <option value="critical">Crítico</option>
            <option value="warning">Alerta</option>
            <option value="info">Info</option>
          </select>

          <select
            value={filters.actionFilter}
            onChange={(e) => setFilters({ actionFilter: e.target.value })}
            className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todas Ações</option>
            <option value="CROSS_TENANT_ATTEMPT">Cross-Tenant</option>
            <option value="DATA_EXPORT">Exportação</option>
            <option value="DATA_DELETION">Exclusão</option>
            <option value="deal_moved">Negócio Movido</option>
            <option value="permission_changed">Permissão Alterada</option>
            <option value="LOGIN">Login</option>
          </select>

          <select
            value={filters.timeFilter}
            onChange={(e) => setFilters({ timeFilter: e.target.value as '24h' | '7d' | '30d' | '90d' })}
            className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Logs List */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              Nenhum log encontrado para os filtros selecionados
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {logs.map((log) => {
              const severity = (log.severity ?? 'info') as AuditSeverity;
              const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
              const Icon = config.icon;
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                      <Icon className={`w-5 h-5 ${config.textColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                          {config.label}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {log.entity_type && (
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">
                            {log.entity_type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelative(log.created_at, nowTs)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {log.user_id.slice(0, 8)}...
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-black/20 rounded-lg text-sm space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Data/Hora:</span>
                              <p className="text-slate-700 dark:text-slate-300">{formatDate(log.created_at)}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">User ID:</span>
                              <p className="text-slate-700 dark:text-slate-300 font-mono text-xs">{log.user_id}</p>
                            </div>
                            {log.ip_address && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">IP:</span>
                                <p className="text-slate-700 dark:text-slate-300">{log.ip_address}</p>
                              </div>
                            )}
                          </div>

                          {log.changes && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                              <span className="text-slate-500 dark:text-slate-400">Mudanças:</span>
                              <pre className="mt-1 p-2 bg-slate-100 dark:bg-black/30 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          )}

                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                              <span className="text-slate-500 dark:text-slate-400">Detalhes:</span>
                              <pre className="mt-1 p-2 bg-slate-100 dark:bg-black/30 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogDashboard;
