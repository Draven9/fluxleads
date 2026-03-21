import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduledMessagesService } from '@/lib/supabase/scheduled_messages';
import { CreateScheduledMessagePayload, UpdateScheduledMessagePayload } from '@/types';
import { useToast } from '@/context/ToastContext';

export const SCHEDULED_MESSAGES_QUERY_KEY = (id: string) => ['scheduled_messages', id];

interface UseScheduledMessagesParams {
    sessionId?: string;
    contactId?: string;
}

export function useScheduledMessages({ sessionId, contactId }: UseScheduledMessagesParams) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    // Prefer sessionId for the query key; fall back to contactId
    const queryId = sessionId || contactId || '';

    const messagesQuery = useQuery({
        queryKey: SCHEDULED_MESSAGES_QUERY_KEY(queryId),
        queryFn: async () => {
            if (sessionId) {
                const { data, error } = await scheduledMessagesService.listForSession(sessionId);
                if (error) throw error;
                return data;
            }
            if (contactId) {
                const { data, error } = await scheduledMessagesService.listForContact(contactId);
                if (error) throw error;
                return data;
            }
            return [];
        },
        enabled: !!(sessionId || contactId),
    });

    const createMutation = useMutation({
        mutationFn: async (payload: CreateScheduledMessagePayload) => {
            const { data, error } = await scheduledMessagesService.create(payload);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULED_MESSAGES_QUERY_KEY(queryId) });
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
            queryClient.invalidateQueries({ queryKey: SCHEDULED_MESSAGES_QUERY_KEY(queryId) });
            addToast('Agendamento cancelado.', 'info');
        },
        onError: (err) => {
            addToast(`Erro ao cancelar: ${(err as Error).message}`, 'error');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateScheduledMessagePayload }) => {
            const { data, error } = await scheduledMessagesService.update(id, payload);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SCHEDULED_MESSAGES_QUERY_KEY(queryId) });
            addToast('Agendamento atualizado com sucesso!', 'success');
        },
        onError: (err) => {
            addToast(`Erro ao atualizar agendamento: ${(err as Error).message}`, 'error');
        },
    });

    return {
        scheduledMessages: messagesQuery.data || [],
        isLoading: messagesQuery.isLoading,
        createScheduledMessage: createMutation.mutateAsync,
        cancelScheduledMessage: cancelMutation.mutateAsync,
        updateScheduledMessage: (id: string, payload: UpdateScheduledMessagePayload) =>
            updateMutation.mutateAsync({ id, payload }),
        isCreating: createMutation.isPending,
        isCancelling: cancelMutation.isPending,
        isUpdating: updateMutation.isPending,
    };
}
