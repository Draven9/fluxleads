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

            // The edge function returns the array directly
            return { data, error: null };
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
                type: 'company', // Treat groups closer to companies or generic contacts
                tags: ['Grupo WhatsApp'],
                notes: `Importado do WhatsApp via Sync. ID: ${g.id}`,
                // Custom fields could be added to store group metadata
            }));

            const { data, error } = await supabase
                .from('contacts')
                .upsert(contactsToCreate, {
                    onConflict: 'phone,organization_id',
                    ignoreDuplicates: true
                })
                .select();

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    }
};
