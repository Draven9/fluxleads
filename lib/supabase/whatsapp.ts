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

export const whatsappService = {
    /**
     * Fetches all groups from the connected WhatsApp instance via Edge Function
     */
    fetchGroups: async (): Promise<{ data: WhatsAppGroup[] | null; error: any }> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                return { data: null, error: 'Unauthorized' };
            }

            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'fetchGroups' }
            });

            if (error) throw error;

            // Handle logical errors returned with 200 OK
            if (data && data.error) {
                throw new Error(data.error);
            }

            // The edge function returns the array directly or in a data property
            // We should ensure we return an array
            return { data: Array.isArray(data) ? data : [], error: null };
        } catch (error) {
            console.error('Error fetching WhatsApp groups:', error);
            return { data: null, error };
        }
    },

    /**
     * Imports selected groups as Contacts
     */
    importGroupsAsContacts: async (groups: WhatsAppGroup[], ownerId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Unauthorized');

            // Get organization_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) throw new Error('No organization found');

            const contactsToCreate = groups.map(g => ({
                organization_id: profile.organization_id,
                name: g.subject || 'Grupo sem nome',
                phone: g.id.split('@')[0], // Extract number part from JID
                owner_id: ownerId || user.id,
                // type: 'company', // removed: column does not exist on contacts table
                source: 'whatsapp_group', // Mark as group for chat logic
                notes: `Importado do WhatsApp via Sync. ID: ${g.id}`,
                // Custom fields could be added to store group metadata
            }));

            const { data, error } = await supabase
                .from('contacts')
                .upsert(contactsToCreate, {
                    onConflict: 'phone,organization_id',
                    ignoreDuplicates: false // We want to update so we get the IDs back reliably or use select
                })
                .select();

            if (data) {
                // Ensure chat sessions exist for these groups so they appear in the list
                const sessionsToCreate = data.map(c => ({
                    organization_id: profile.organization_id,
                    contact_id: c.id,
                    provider: 'whatsapp',
                    status: 'active',
                    unread_count: 0
                }));

                // Upsert sessions (prevent duplicates if session already exists)
                // Assuming composite unique key on (organization_id, contact_id) or similar logic needed.
                // Since chat_sessions might not have a clean composite key for upserting by contact_id, 
                // we'll try to insert and ignore conflicts if possible, or check first.
                // However, for bulk, upsert with ignoreDuplicates is best if constraint exists.
                // Let's assume standard upsert might duplicate if no constraint. 
                // Safest is to just loop or use ignoreDuplicates on a known constraint.
                // Prerequisite: Constraint on chat_sessions(organization_id, contact_id)

                await supabase
                    .from('chat_sessions')
                    .upsert(sessionsToCreate, { onConflict: 'organization_id,contact_id', ignoreDuplicates: true });
            }

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    }
};
