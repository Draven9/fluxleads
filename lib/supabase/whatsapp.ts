import { supabase } from './client';

export interface WhatsAppGroup {
    id: string;
    subject: string;
    creation?: number;
    owner?: string;
    size?: number;
    desc?: string;
    restrict?: boolean;
    announce?: boolean;
}

export interface WhatsAppSource {
    id: string;
    name: string;
    display_name: string | null;
    phone_number: string | null;
    provider_type: 'uazapi' | 'evolution' | 'meta';
    active: boolean;
    configuration: Record<string, any>;
}

// ─── Internal helper ──────────────────────────────────────────────────────────
async function invokeProxy(body: Record<string, any>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Unauthorized — no active session');

    // Explicitly pass the Authorization header to ensure it reaches the Edge Function
    const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
        body,
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const whatsappService = {

    /** List all configured WhatsApp instances for the current org */
    listSources: async (): Promise<{ data: WhatsAppSource[] | null; error: any }> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { data: null, error: 'Unauthorized' };

            const { data: profile } = await supabase
                .from('profiles').select('organization_id').eq('id', user.id).single();

            const { data, error } = await supabase
                .from('integration_inbound_sources')
                .select('id, name, display_name, phone_number, provider_type, active, configuration')
                .eq('organization_id', profile?.organization_id)
                .order('created_at', { ascending: true });

            return { data: data as WhatsAppSource[] | null, error };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /** Check connection status for a given source instance */
    instanceStatus: async (sourceId: string): Promise<{ data: any; error: any }> => {
        try {
            const data = await invokeProxy({ action: 'instanceStatus', sourceId });
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /** Send a text message via a specific source instance */
    sendText: async (sourceId: string, phone: string, content: string): Promise<{ data: any; error: any }> => {
        try {
            const data = await invokeProxy({ action: 'sendText', sourceId, phone, content });
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /** Send a media message (image, video, document) */
    sendMedia: async (sourceId: string, phone: string, mediaUrl: string, mediaType: string, caption?: string): Promise<{ data: any; error: any }> => {
        try {
            const data = await invokeProxy({ action: 'sendMedia', sourceId, phone, mediaUrl, mediaType, caption });
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /** Send a PTT audio message */
    sendAudio: async (sourceId: string, phone: string, mediaUrl: string): Promise<{ data: any; error: any }> => {
        try {
            const data = await invokeProxy({ action: 'sendAudio', sourceId, phone, mediaUrl });
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /** Fetch all WhatsApp groups from a source instance */
    fetchGroups: async (sourceId?: string): Promise<{ data: WhatsAppGroup[] | null; error: any }> => {
        try {
            const raw = await invokeProxy({ action: 'fetchGroups', sourceId });
            return { data: Array.isArray(raw) ? raw : [], error: null };
        } catch (err) {
            console.error('[whatsappService] fetchGroups:', err);
            return { data: null, error: err };
        }
    },

    /** Fetch participants of a specific group */
    fetchParticipants: async (groupJid: string, sourceId?: string): Promise<{ data: any[] | null; error: any }> => {
        try {
            const raw = await invokeProxy({ action: 'fetchParticipants', groupJid, sourceId });
            const participants = Array.isArray(raw) ? raw : (raw?.participants || []);
            return { data: participants, error: null };
        } catch (err) {
            console.error('[whatsappService] fetchParticipants:', err);
            return { data: null, error: err };
        }
    },

    /** Import WhatsApp groups as Contacts + create ChatSessions */
    importGroupsAsContacts: async (groups: WhatsAppGroup[], ownerId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Unauthorized');

            const { data: profile } = await supabase
                .from('profiles').select('organization_id').eq('id', user.id).single();
            if (!profile?.organization_id) throw new Error('No organization found');

            const contactsToCreate = groups.map(g => ({
                organization_id: profile.organization_id,
                name: g.subject || 'Grupo sem nome',
                phone: g.id.split('@')[0],
                owner_id: ownerId || user.id,
                source: 'whatsapp_group',
                notes: `Importado do WhatsApp via Sync. ID: ${g.id}`,
            }));

            const { data, error } = await supabase
                .from('contacts')
                .upsert(contactsToCreate, { onConflict: 'phone,organization_id', ignoreDuplicates: false })
                .select();

            if (data) {
                const sessionsToCreate = data.map(c => ({
                    organization_id: profile.organization_id,
                    contact_id: c.id,
                    provider: 'whatsapp',
                    unread_count: 0,
                }));
                await supabase
                    .from('chat_sessions')
                    .upsert(sessionsToCreate, { onConflict: 'organization_id,contact_id', ignoreDuplicates: true });
            }

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    /** Fetch and sync historical messages for a specific session */
    syncHistory: async (sessionId: string, remoteJid: string, sourceId?: string): Promise<{ data: any; error: any }> => {
        try {
            const data = await invokeProxy({ action: 'fetchMessages', sessionId, remoteJid, sourceId });
            return { data, error: null };
        } catch (err) {
            console.error('[whatsappService] syncHistory:', err);
            return { data: null, error: err };
        }
    },
};
