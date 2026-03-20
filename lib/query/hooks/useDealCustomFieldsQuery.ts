import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealCustomFieldsService } from '@/lib/supabase/deal_custom_fields';
import { CustomFieldDefinition } from '@/types';
import { useToast } from '@/context/ToastContext';

export const DEAL_CUSTOM_FIELDS_QUERY_KEY = ['deal_custom_fields'];

export function useDealCustomFields() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const fieldsQuery = useQuery({
        queryKey: DEAL_CUSTOM_FIELDS_QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await dealCustomFieldsService.getFields();
            if (error) throw error;
            return data ?? [];
        },
    });

    const createMutation = useMutation({
        mutationFn: async (field: Omit<CustomFieldDefinition, 'id'>) => {
            const { data, error } = await dealCustomFieldsService.createField(field);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEAL_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo personalizado criado!', 'success');
        },
        onError: (err: Error) => {
            const msg = (err as any)?.code === '23505'
                ? 'Já existe um campo com este identificador.'
                : `Erro ao criar campo: ${err.message}`;
            addToast(msg, 'error');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<CustomFieldDefinition> }) => {
            const { data, error } = await dealCustomFieldsService.updateField(id, updates);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEAL_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo atualizado!', 'success');
        },
        onError: (err: Error) => {
            addToast(`Erro ao atualizar campo: ${err.message}`, 'error');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await dealCustomFieldsService.deleteField(id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEAL_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo removido.', 'info');
        },
        onError: (err: Error) => {
            addToast(`Erro ao remover campo: ${err.message}`, 'error');
        },
    });

    return {
        fields: fieldsQuery.data ?? [],
        isLoading: fieldsQuery.isLoading,
        isError: fieldsQuery.isError,
        createField: createMutation.mutateAsync,
        updateField: updateMutation.mutateAsync,
        deleteField: deleteMutation.mutateAsync,
        isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    };
}
