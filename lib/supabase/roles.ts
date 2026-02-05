import { supabase } from './client';
import { PostgrestError } from '@supabase/supabase-js';

export interface RoleSettings {
    id: string;
    organization_id: string;
    role: 'vendedor' | 'colaborador';
    permissions: {
        view_all_deals?: boolean; // Can view deals from other users?
        can_export_contacts?: boolean;
        view_revenue?: boolean;
        [key: string]: any;
    };
}

export const roleSettingsService = {
    /**
     * Fetches settings for all roles in the organization.
     */
    async getAll(): Promise<{ data: RoleSettings[] | null; error: PostgrestError | null }> {
        if (!supabase) return { data: null, error: { message: 'Supabase not initialized' } as PostgrestError };

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } as PostgrestError };

        // Get org id (helper)
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { data: null, error: { message: 'No organization found' } as PostgrestError };

        const { data, error } = await supabase
            .from('organization_role_settings')
            .select('*')
            .eq('organization_id', profile.organization_id);

        return { data: data as RoleSettings[], error };
    },

    /**
     * Updates permissions for a specific role.
     */
    async updatePermissions(role: 'vendedor' | 'colaborador', permissions: Record<string, boolean>): Promise<{ error: PostgrestError | null }> {
        if (!supabase) return { error: { message: 'Supabase not initialized' } as PostgrestError };

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } as PostgrestError };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { error: { message: 'No organization found' } as PostgrestError };

        // Upsert to ensure record exists
        const { error } = await supabase
            .from('organization_role_settings')
            .upsert({
                organization_id: profile.organization_id,
                role,
                permissions
            }, { onConflict: 'organization_id,role' });

        return { error };
    }
};
