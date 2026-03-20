import { supabase } from './client';

export interface OrganizationTag {
  id: string;
  organizationId: string;
  name: string;
  color?: string | null;
  createdAt: string;
}

interface DbTag {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

function toTag(db: DbTag): OrganizationTag {
  return {
    id: db.id,
    organizationId: db.organization_id,
    name: db.name,
    color: db.color,
    createdAt: db.created_at,
  };
}

export const tagsService = {
  async getAll() {
    const result = await supabase
      .from('organization_tags')
      .select('*')
      .order('name');
    return { data: (result.data as DbTag[] | null)?.map(toTag) ?? [], error: result.error };
  },

  async create(name: string, color?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return { data: null, error: new Error('Profile not found') };

    const result = await supabase
      .from('organization_tags')
      .insert({ name: name.trim(), color: color ?? null, organization_id: (profile as any).organization_id })
      .select()
      .single();
    return { data: result.data ? toTag(result.data as DbTag) : null, error: result.error };
  },

  async update(id: string, updates: { name?: string; color?: string | null }) {
    const result = await supabase
      .from('organization_tags')
      .update({ ...(updates.name !== undefined && { name: updates.name.trim() }), ...(updates.color !== undefined && { color: updates.color }) })
      .eq('id', id)
      .select()
      .single();
    return { data: result.data ? toTag(result.data as DbTag) : null, error: result.error };
  },

  async delete(id: string) {
    const result = await supabase
      .from('organization_tags')
      .delete()
      .eq('id', id);
    return { error: result.error };
  },
};
