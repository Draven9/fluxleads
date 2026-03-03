import { supabase } from './client';
import {
    ContactCustomField,
    ContactCustomValue,
    DbContactCustomField,
    DbContactCustomValue
} from '@/types';

// ============================================================================
// Transformers
// ============================================================================

export const transformCustomField = (db: DbContactCustomField): ContactCustomField => ({
    id: db.id,
    organizationId: db.organization_id,
    name: db.name,
    fieldType: db.field_type as ContactCustomField['fieldType'],
    options: db.options || undefined,
    triggerAction: db.trigger_action,
    createdAt: db.created_at,
});

export const transformCustomValue = (db: DbContactCustomValue): ContactCustomValue => ({
    id: db.id,
    contactId: db.contact_id,
    fieldId: db.field_id,
    value: db.value,
    updatedAt: db.updated_at,
});

export const transformCustomFieldToDb = (field: Partial<ContactCustomField>): Partial<DbContactCustomField> => {
    const db: Partial<DbContactCustomField> = {};
    if (field.name !== undefined) db.name = field.name;
    if (field.fieldType !== undefined) db.field_type = field.fieldType;
    if (field.options !== undefined) db.options = field.options || null;
    if (field.triggerAction !== undefined) db.trigger_action = field.triggerAction || null;
    // organizationId managed by trigger/client, but we can pass it
    if (field.organizationId !== undefined) db.organization_id = field.organizationId;
    return db;
};

// ============================================================================
// Service
// ============================================================================

export const customFieldsService = {
    // -------------------------------------------------------------------------
    // Fields Definition CRUD
    // -------------------------------------------------------------------------

    /** Busca as definições de campos customizados para a org do usuário (via RLS) */
    async getFields(): Promise<{ data: ContactCustomField[] | null; error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');
            const { data, error } = await supabase
                .from('custom_fields')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return { data: (data || []).map(d => transformCustomField(d as DbContactCustomField)), error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    },

    async createField(field: Omit<ContactCustomField, 'id' | 'createdAt' | 'organizationId'>): Promise<{ data: ContactCustomField | null; error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');
            // O RLS lida com o organization_id via context/auth se omitido (padrão desse app), ou passamos manualmente se preciso.
            // Assumindo que o usuário usa a função get_auth_organization_id() em check/insert no auth, podemos omi-tí-lo. 
            // Porém vamos adicionar via supabase auth fallback caso algo exija explícito.
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error('User not auth.');

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userData.user.id).single();

            const { data, error } = await supabase
                .from('custom_fields')
                .insert([{
                    ...transformCustomFieldToDb(field),
                    organization_id: profile?.organization_id
                }])
                .select()
                .single();

            if (error) throw error;
            return { data: transformCustomField(data as DbContactCustomField), error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    },

    async updateField(id: string, updates: Partial<ContactCustomField>): Promise<{ data: ContactCustomField | null; error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');
            const { data, error } = await supabase
                .from('custom_fields')
                .update(transformCustomFieldToDb(updates))
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data: transformCustomField(data as DbContactCustomField), error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    },

    async deleteField(id: string): Promise<{ error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');
            const { error } = await supabase
                .from('custom_fields')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    },

    // -------------------------------------------------------------------------
    // Values EAV CRUD
    // -------------------------------------------------------------------------

    /** Pega os valores preenchidos de um contato específico */
    async getValuesForContact(contactId: string): Promise<{ data: ContactCustomValue[] | null; error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');
            const { data, error } = await supabase
                .from('contact_custom_values')
                .select('*')
                .eq('contact_id', contactId);

            if (error) throw error;
            return { data: (data || []).map(v => transformCustomValue(v as DbContactCustomValue)), error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    },

    /** 
     * Updates/Upserts multiple values for a contact.
     * `values` should map field_id to string value. 
     */
    async upsertValues(contactId: string, values: Record<string, string | null>): Promise<{ error: Error | null }> {
        try {
            if (!supabase) throw new Error('Supabase client is absent.');

            const recordsToUpsert = Object.entries(values).map(([fieldId, val]) => ({
                contact_id: contactId,
                field_id: fieldId,
                value: val,
                updated_at: new Date().toISOString()
            }));

            // No fields to update
            if (recordsToUpsert.length === 0) return { error: null };

            // Supabase UPSERT uses unique constraint (contact_id, field_id)
            const { error } = await supabase
                .from('contact_custom_values')
                .upsert(recordsToUpsert, { onConflict: 'contact_id,field_id' });

            if (error) throw error;
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }
};
