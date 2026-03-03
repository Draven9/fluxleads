import { createClient } from '@/lib/supabase/client';
import { DbScheduledMessage, ScheduledMessage, ScheduledMessageStatus, CreateScheduledMessagePayload } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const supabase = createClient()!;


function mapDb(row: DbScheduledMessage): ScheduledMessage {
    return {
        id: row.id,
        organizationId: row.organization_id,
        sessionId: row.session_id,
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

    /** Cria um novo agendamento. */
    async create(payload: CreateScheduledMessagePayload) {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('scheduled_messages')
            .insert({
                session_id: payload.sessionId,
                contact_id: payload.contactId ?? null,
                created_by: user?.id ?? null,
                content: payload.content,
                has_variables: payload.content.includes('{{'),
                scheduled_at: payload.scheduledAt,
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
