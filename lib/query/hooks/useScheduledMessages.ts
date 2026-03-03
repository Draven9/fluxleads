import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduledMessagesService } from '@/lib/supabase/scheduled_messages';
import { CreateScheduledMessagePayload } from '@/types';
import { useToast } from '@/context/ToastContext';

export const SCHEDULED_MESSAGES_QUERY_KEY = (sessionId: string) => ['scheduled_messages', sessionId];

export function useScheduledMessages(sessionId: string) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const messagesQuery = useQuery({
        queryKey: SCHEDULED_MESSAGES_QUERY_KEY(sessionId),
        queryFn: async () => {
            const { data, error } = await scheduledMessagesService.listForSession(sessionId);
            if (error) throw error;
            return data;
        },
        enabled: !!sessionId,
    });

    const createMutation = useMutation({
        mutationFn: async (payload: CreateScheduledMessagePayload) => {
            const { data, error } = await scheduledMessagesService.create(payload);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULED_MESSAGES_QUERY_KEY(sessionId) });
            addToast('Mensagem agendada com sucesso! ⏱️', 'success');
        },
        onError: (err) => {
            addToast(`Erro ao agendar mensagem: ${(err as Error).message}`, 'error');
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await scheduledMessagesService.cancel(id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULED_MESSAGES_QUERY_KEY(sessionId) });
            addToast('Agendamento cancelado.', 'info');
        },
        onError: (err) => {
            addToast(`Erro ao cancelar: ${(err as Error).message}`, 'error');
        },
    });

    return {
        scheduledMessages: messagesQuery.data || [],
        isLoading: messagesQuery.isLoading,
        createScheduledMessage: createMutation.mutateAsync,
        cancelScheduledMessage: cancelMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isCancelling: cancelMutation.isPending,
    };
}
