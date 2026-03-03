import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFieldsService } from '@/lib/supabase/custom_fields';
import { ContactCustomField, ContactCustomValue } from '@/types';
import { useToast } from '@/context/ToastContext';

export const CONTACT_CUSTOM_FIELDS_QUERY_KEY = ['contact_custom_fields'];
export const CONTACT_CUSTOM_VALUES_QUERY_KEY = (contactId: string) => ['contact_custom_values', contactId];

export function useContactCustomFields() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const fieldsQuery = useQuery({
        queryKey: CONTACT_CUSTOM_FIELDS_QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await customFieldsService.getFields();
            if (error) throw error;
            return data;
        },
    });

    const createFieldMutation = useMutation({
        mutationFn: async (field: Omit<ContactCustomField, 'id' | 'createdAt' | 'organizationId'>) => {
            const { data, error } = await customFieldsService.createField(field);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CONTACT_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo de contato criado com sucesso!', 'success');
        },
        onError: (err) => {
            addToast(`Erro ao criar campo: ${(err as Error).message}`, 'error');
        },
    });

    const updateFieldMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContactCustomField> }) => {
            const { data, error } = await customFieldsService.updateField(id, updates);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CONTACT_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo de contato atualizado com sucesso!', 'success');
        },
        onError: (err) => {
            addToast(`Erro ao atualizar campo: ${(err as Error).message}`, 'error');
        },
    });

    const deleteFieldMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await customFieldsService.deleteField(id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CONTACT_CUSTOM_FIELDS_QUERY_KEY });
            addToast('Campo de contato excluído.', 'info');
        },
        onError: (err) => {
            addToast(`Erro ao remover campo: ${(err as Error).message}`, 'error');
        },
    });

    return {
        fields: fieldsQuery.data || [],
        isLoading: fieldsQuery.isLoading,
        isError: fieldsQuery.isError,
        createField: createFieldMutation.mutateAsync,
        updateField: updateFieldMutation.mutateAsync,
        deleteField: deleteFieldMutation.mutateAsync,
        isMutating: createFieldMutation.isPending || updateFieldMutation.isPending || deleteFieldMutation.isPending,
    };
}

export function useContactCustomValues(contactId: string) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const valuesQuery = useQuery({
        queryKey: CONTACT_CUSTOM_VALUES_QUERY_KEY(contactId),
        queryFn: async () => {
            const { data, error } = await customFieldsService.getValuesForContact(contactId);
            if (error) throw error;
            return data;
        },
        enabled: !!contactId,
    });

    const upsertValuesMutation = useMutation({
        mutationFn: async (values: Record<string, string | null>) => {
            const { error } = await customFieldsService.upsertValues(contactId, values);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CONTACT_CUSTOM_VALUES_QUERY_KEY(contactId) });
            addToast('Valores atualizados com sucesso.', 'success');
        },
        onError: (err) => {
            addToast(`Erro ao atualizar valores: ${(err as Error).message}`, 'error');
        },
    });

    return {
        values: valuesQuery.data || [],
        isLoading: valuesQuery.isLoading,
        isError: valuesQuery.isError,
        upsertValues: upsertValuesMutation.mutateAsync,
        isMutating: upsertValuesMutation.isPending,
    };
}
