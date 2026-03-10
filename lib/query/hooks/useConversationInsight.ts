import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface ConversationInsight {
    id: string;
    session_id: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;
    summary: string | null;
    suggested_action: string | null;
    messages_analyzed: number;
    analyzed_at: string;
    expires_at: string;
}

const QUERY_KEY = (sessionId: string) => ['conversation_insight', sessionId];

export function useConversationInsight(sessionId: string) {
    const { organizationId } = useAuth();
    const queryClient = useQueryClient();

    const insightQuery = useQuery<ConversationInsight | null>({
        queryKey: QUERY_KEY(sessionId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('conversation_insights')
                .select('*')
                .eq('session_id', sessionId)
                .maybeSingle();

            if (error) throw error;

            // Se expirado, retornar null para forçar re-análise
            if (data && new Date(data.expires_at) < new Date()) return null;

            return data as ConversationInsight | null;
        },
        enabled: !!sessionId,
        staleTime: 10 * 60 * 1000, // 10 min
    });

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            if (!organizationId) throw new Error('Organization ID not found');

            const { error } = await supabase.functions.invoke('analyze-conversation-sentiment', {
                body: { session_id: sessionId, organization_id: organizationId },
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY(sessionId) });
        },
    });

    return {
        insight: insightQuery.data ?? null,
        isLoading: insightQuery.isLoading,
        analyze: analyzeMutation.mutate,
        isAnalyzing: analyzeMutation.isPending,
        error: analyzeMutation.error,
    };
}
