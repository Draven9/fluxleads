import { supabase } from '@/lib/supabase/client';
import { CRMCompany } from '@/types/types';

// Helper to transform snake_case DB object to camelCase frontend object
const transformCompany = (dbCompany: any): CRMCompany => ({
    id: dbCompany.id,
    organizationId: dbCompany.organization_id,
    name: dbCompany.name,
    industry: dbCompany.industry,
    website: dbCompany.website,
    status: dbCompany.status,
    createdAt: dbCompany.created_at,
    updatedAt: dbCompany.updated_at,
});

export const companiesService = {
    async getAll() {
        const { data, error } = await supabase
            .from('crm_companies')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(transformCompany);
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('crm_companies')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return transformCompany(data);
    },

    async create(company: Partial<CRMCompany>) {
        // Map camelCase back to snake_case for DB
        const dbPayload = {
            name: company.name,
            industry: company.industry,
            website: company.website,
            status: company.status,
            // organization_id is usually handled by RLS or default, but can be passed if needed
        };

        const { data, error } = await supabase
            .from('crm_companies')
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;
        return transformCompany(data);
    },

    async update(id: string, updates: Partial<CRMCompany>) {
        const dbPayload: any = {};
        if (updates.name !== undefined) dbPayload.name = updates.name;
        if (updates.industry !== undefined) dbPayload.industry = updates.industry;
        if (updates.website !== undefined) dbPayload.website = updates.website;
        if (updates.status !== undefined) dbPayload.status = updates.status;

        const { data, error } = await supabase
            .from('crm_companies')
            .update(dbPayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return transformCompany(data);
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('crm_companies')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
