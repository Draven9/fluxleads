import { createClient } from '@/lib/supabase/client';
import { DbScheduledMessage, ScheduledMessage, ScheduledMessageStatus, CreateScheduledMessagePayload, UpdateScheduledMessagePayload } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const supabase = createClient()!;


function mapDb(row: DbScheduledMessage): ScheduledMessage {
    return {
        id: row.id,
        organizationId: row.organization_id,
        sessionId: row.session_id,
        dealId: row.deal_id,
        contactId: row.contact_id,
        createdBy: row.created_by,
        content: row.content,
        hasVariables: row.has_variables,
        scheduledAt: row.scheduled_at,
        status: row.status,
        sentAt: row.sent_at,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const scheduledMessagesService = {
    /** Lista todas as mensagens agendadas (todas as sessões da organização). */
    async list() {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .order('scheduled_at', { ascending: true });

        return {
            data: (data as DbScheduledMessage[] | null)?.map(mapDb) ?? [],
            error,
        };
    },

    /** Lista mensagens agendadas de uma sessão específica. */
    async listForSession(sessionId: string) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('scheduled_at', { ascending: true });

        return {
            data: (data as DbScheduledMessage[] | null)?.map(mapDb) ?? [],
            error,
        };
    },

    /** Lista mensagens agendadas de um contato (inclui agendamentos sem sessão). */
    async listForContact(contactId: string) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq('contact_id', contactId)
            .order('scheduled_at', { ascending: true });

        return {
            data: (data as DbScheduledMessage[] | null)?.map(mapDb) ?? [],
            error,
        };
    },

    /** Cria um novo agendamento. */
    async create(payload: CreateScheduledMessagePayload) {
        const { data: { user } } = await supabase.auth.getUser();

        // Busca organization_id do profile (necessário para RLS)
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user?.id ?? '')
            .single();

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert({
                session_id: payload.sessionId ?? null,
                deal_id: payload.dealId ?? null,
                contact_id: payload.contactId ?? null,
                organization_id: profile?.organization_id ?? null,
                created_by: user?.id ?? null,
                content: payload.content,
                has_variables: payload.content.includes('{{'),
                scheduled_at: new Date(payload.scheduledAt).toISOString(),
                status: 'pending',
            })
            .select()
            .single();

        return { data: data ? mapDb(data as DbScheduledMessage) : null, error };
    },

    /** Cancela um agendamento (muda status para cancelled). */
    async cancel(id: string) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .update({ status: 'cancelled' as ScheduledMessageStatus })
            .eq('id', id)
            .select()
            .single();

        return { data: data ? mapDb(data as DbScheduledMessage) : null, error };
    },

    /** Edita conteúdo e/ou horário de um agendamento pendente. */
    async update(id: string, payload: UpdateScheduledMessagePayload) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .update({
                ...(payload.content !== undefined && {
                    content: payload.content,
                    has_variables: payload.content.includes('{{'),
                }),
                ...(payload.scheduledAt !== undefined && { scheduled_at: new Date(payload.scheduledAt).toISOString() }),
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select()
            .single();

        return { data: data ? mapDb(data as DbScheduledMessage) : null, error };
    },

    /** Fecha um agendamento como enviado (chamado pela Edge Function). */
    async markAsSent(id: string) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .update({ status: 'sent' as ScheduledMessageStatus, sent_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        return { data: data ? mapDb(data as DbScheduledMessage) : null, error };
    },

    /** Marca como falhou. */
    async markAsFailed(id: string, errorMessage: string) {
        const { data, error } = await supabase
            .from('scheduled_messages')
            .update({ status: 'failed' as ScheduledMessageStatus, error_message: errorMessage })
            .eq('id', id)
            .select()
            .single();

        return { data: data ? mapDb(data as DbScheduledMessage) : null, error };
    },
};
