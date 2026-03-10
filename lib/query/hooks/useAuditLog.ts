/**
 * Hook de Auditoria — 5.4
 *
 * Encapsula toda a lógica de leitura e escrita na tabela `audit_logs`.
 * O componente AuditLogDashboard consume este hook em vez de fazer fetches inline.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
    id: string;
    organization_id: string;
    user_id: string;
    entity_type: string;
    entity_id: string | null;
    action: string;
    changes: Record<string, unknown> | null;
    source: string | null;
    severity: AuditSeverity;
    resource_type: string | null;
    resource_id: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export interface AuditStats {
    total: number;
    critical: number;
    warning: number;
    info: number;
}

export interface UseAuditLogFilters {
    severityFilter: AuditSeverity | 'all';
    actionFilter: string;
    timeFilter: '24h' | '7d' | '30d' | '90d';
}

interface UseAuditLogReturn {
    logs: AuditLogEntry[];
    stats: AuditStats;
    loading: boolean;
    error: string | null;
    filters: UseAuditLogFilters;
    setFilters: (filters: Partial<UseAuditLogFilters>) => void;
    refetch: () => void;
    logAction: (params: LogActionParams) => Promise<void>;
}

export interface LogActionParams {
    action: string;
    entityType: string;
    entityId?: string;
    details?: Record<string, unknown>;
    severity?: AuditSeverity;
    changes?: { before?: unknown; after?: unknown };
}

const TIME_OFFSETS_MS: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
};

const DEFAULT_FILTERS: UseAuditLogFilters = {
    severityFilter: 'all',
    actionFilter: 'all',
    timeFilter: '7d',
};

export function useAuditLog(): UseAuditLogReturn {
    const { profile, organizationId } = useAuth();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [stats, setStats] = useState<AuditStats>({ total: 0, critical: 0, warning: 0, info: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFiltersState] = useState<UseAuditLogFilters>(DEFAULT_FILTERS);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

    const setFilters = useCallback((partial: Partial<UseAuditLogFilters>) => {
        setFiltersState((prev) => ({ ...prev, ...partial }));
    }, []);

    const fetchLogs = useCallback(async () => {
        if (!isAdmin || !supabase) {
            setLogs([]);
            setStats({ total: 0, critical: 0, warning: 0, info: 0 });
            if (!supabase) setError('Supabase não configurado.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const fromTs = Date.now() - TIME_OFFSETS_MS[filters.timeFilter];

            let query = supabase
                .from('audit_logs')
                .select('*')
                .gte('created_at', new Date(fromTs).toISOString())
                .order('created_at', { ascending: false })
                .limit(200);

            if (filters.severityFilter !== 'all') {
                query = query.eq('severity', filters.severityFilter);
            }
            if (filters.actionFilter !== 'all') {
                query = query.eq('action', filters.actionFilter);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            const rows = (data as AuditLogEntry[]) || [];
            setLogs(rows);

            // Compute stats in a single O(n) pass
            let critical = 0, warning = 0, info = 0;
            for (const log of rows) {
                if (log.severity === 'critical') critical++;
                else if (log.severity === 'warning') warning++;
                else info++;
            }
            setStats({ total: rows.length, critical, warning, info });
        } catch (err) {
            console.error('[useAuditLog] fetch error:', err);
            setError('Erro ao carregar logs de auditoria.');
        } finally {
            setLoading(false);
        }
    }, [isAdmin, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    /**
     * Registra uma ação de auditoria.
     * Pode ser chamado de qualquer parte do app para rastrear eventos importantes.
     */
    const logAction = useCallback(async ({
        action,
        entityType,
        entityId,
        details,
        severity = 'info',
        changes,
    }: LogActionParams): Promise<void> => {
        if (!supabase || !profile || !organizationId) return;

        try {
            await supabase.from('audit_logs').insert({
                organization_id: organizationId,
                user_id: profile.id,
                entity_type: entityType,
                entity_id: entityId ?? null,
                action,
                details: details ?? null,
                severity,
                changes: changes ?? null,
                source: 'app',
            });
        } catch (err) {
            console.error('[useAuditLog] logAction error:', err);
        }
    }, [profile, organizationId]);

    return {
        logs,
        stats,
        loading,
        error,
        filters,
        setFilters,
        refetch: fetchLogs,
        logAction,
    };
}
