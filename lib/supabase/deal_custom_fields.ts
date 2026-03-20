import { supabase } from './client';
import { CustomFieldDefinition, CustomFieldType } from '@/types';

// ============================================================================
// DB Row type
// ============================================================================

interface DbDealCustomField {
  id: string;
  organization_id: string;
  label: string;
  field_key: string;
  field_type: string;
  options: string[] | null;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// Transformers
// ============================================================================

const fromDb = (db: DbDealCustomField): CustomFieldDefinition => ({
  id: db.id,
  key: db.field_key,
  label: db.label,
  type: db.field_type as CustomFieldType,
  options: db.options || undefined,
});

const toDb = (field: Partial<Omit<CustomFieldDefinition, 'id'>>): Partial<DbDealCustomField> => {
  const db: Partial<DbDealCustomField> = {};
  if (field.label !== undefined) db.label = field.label;
  if (field.key !== undefined) db.field_key = field.key;
  if (field.type !== undefined) db.field_type = field.type;
  if ('options' in field) db.options = field.options || null;
  return db;
};

// ============================================================================
// Service
// ============================================================================

export const dealCustomFieldsService = {
  async getFields(): Promise<{ data: CustomFieldDefinition[] | null; error: Error | null }> {
    try {
      if (!supabase) throw new Error('Supabase client is absent.');
      const { data, error } = await supabase
        .from('deal_custom_fields')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { data: (data || []).map(d => fromDb(d as DbDealCustomField)), error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async createField(
    field: Omit<CustomFieldDefinition, 'id'>
  ): Promise<{ data: CustomFieldDefinition | null; error: Error | null }> {
    try {
      if (!supabase) throw new Error('Supabase client is absent.');
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userData.user.id)
        .single();

      const { data, error } = await supabase
        .from('deal_custom_fields')
        .insert([{ ...toDb(field), organization_id: profile?.organization_id }])
        .select()
        .single();

      if (error) throw error;
      return { data: fromDb(data as DbDealCustomField), error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async updateField(
    id: string,
    updates: Partial<CustomFieldDefinition>
  ): Promise<{ data: CustomFieldDefinition | null; error: Error | null }> {
    try {
      if (!supabase) throw new Error('Supabase client is absent.');
      const { data, error } = await supabase
        .from('deal_custom_fields')
        .update(toDb(updates))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: fromDb(data as DbDealCustomField), error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async deleteField(id: string): Promise<{ error: Error | null }> {
    try {
      if (!supabase) throw new Error('Supabase client is absent.');
      const { error } = await supabase
        .from('deal_custom_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
