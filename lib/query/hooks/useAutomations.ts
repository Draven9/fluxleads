"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export interface AutomationNode {
    id: string;
    type: string; // 'trigger' | 'action'
    position: { x: number; y: number };
    data: Record<string, any>;
}

export interface AutomationEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
}

export interface Automation {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    active: boolean;
    trigger_type: string;
    trigger_config: Record<string, any>;
    nodes: AutomationNode[];
    edges: AutomationEdge[];
    run_count: number;
    last_run_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export function useAutomations() {
    const { profile } = useAuth();
    const { addToast } = useToast();

    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAutomations = useCallback(async () => {
        if (!profile?.organization_id) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('automations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAutomations(data || []);
        } catch (err: any) {
            console.error('[useAutomations] Erro ao buscar:', err);
            addToast('Erro ao carregar automações', 'error');
        } finally {
            setLoading(false);
        }
    }, [profile?.organization_id, addToast]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    const createAutomation = async (
        name: string,
        triggerType: string,
        nodes: AutomationNode[] = [],
        edges: AutomationEdge[] = [],
        description?: string
    ) => {
        try {
            const { data, error } = await supabase
                .from('automations')
                .insert({
                    organization_id: profile?.organization_id,
                    name,
                    trigger_type: triggerType,
                    nodes,
                    edges,
                    description,
                    created_by: profile?.id
                })
                .select()
                .single();

            if (error) throw error;

            setAutomations(prev => [data, ...prev]);
            addToast('Automação criada com sucesso', 'success');
            return data;
        } catch (err: any) {
            console.error('[useAutomations] Erro ao criar:', err);
            addToast('Erro ao criar automação', 'error');
            return null;
        }
    };

    const updateAutomation = async (id: string, updates: Partial<Automation>) => {
        try {
            const { data, error } = await supabase
                .from('automations')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
            addToast('Automação atualizada', 'success');
            return data;
        } catch (err: any) {
            console.error('[useAutomations] Erro ao atualizar:', err);
            addToast('Erro ao atualizar automação', 'error');
            return null;
        }
    };

    const deleteAutomation = async (id: string) => {
        try {
            const { error } = await supabase
                .from('automations')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setAutomations(prev => prev.filter(a => a.id !== id));
            addToast('Automação removida', 'success');
            return true;
        } catch (err: any) {
            console.error('[useAutomations] Erro ao remover:', err);
            addToast('Erro ao remover automação', 'error');
            return false;
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        return updateAutomation(id, { active: !currentStatus });
    };

    return {
        automations,
        loading,
        refetch: fetchAutomations,
        createAutomation,
        updateAutomation,
        deleteAutomation,
        toggleStatus
    };
}
