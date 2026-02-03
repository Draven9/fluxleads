import { supabase } from '@/lib/supabase/client';

export interface VaultItem {
    id: string;
    organizationId: string;
    clientCompanyId: string;
    type: 'LOGIN' | 'NOTE' | 'SERVER' | 'WIFI' | 'OTHER';
    name: string;
    username?: string;
    encryptedPassword?: string; // We'll store/retrieve this as is for now
    url?: string;
    notes?: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
}

const transformVaultItem = (dbItem: any): VaultItem => ({
    id: dbItem.id,
    organizationId: dbItem.organization_id,
    clientCompanyId: dbItem.client_company_id,
    type: dbItem.type,
    name: dbItem.name,
    username: dbItem.username,
    encryptedPassword: dbItem.encrypted_password,
    url: dbItem.url,
    notes: dbItem.notes,
    category: dbItem.category,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
});

export const vaultService = {
    async getByCompanyId(companyId: string) {
        const { data, error } = await supabase
            .from('client_vault_items')
            .select('*')
            .eq('client_company_id', companyId)
            .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(transformVaultItem);
    },

    async create(item: Partial<VaultItem>) {
        const dbPayload = {
            client_company_id: item.clientCompanyId,
            type: item.type,
            name: item.name,
            username: item.username,
            encrypted_password: item.encryptedPassword,
            url: item.url,
            notes: item.notes,
            category: item.category,
        };

        const { data, error } = await supabase
            .from('client_vault_items')
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;
        return transformVaultItem(data);
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('client_vault_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
