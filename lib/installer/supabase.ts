import { createClient } from '@supabase/supabase-js';

type BootstrapInput = {
  supabaseUrl: string;
  serviceRoleKey: string;
  companyName: string;
  email: string;
  password: string;
};

export async function bootstrapInstance({
  supabaseUrl,
  serviceRoleKey,
  companyName,
  email,
  password,
}: BootstrapInput) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: existingOrgs, error: orgCheckError } = await admin
    .from('organizations')
    .select('id')
    .limit(1);

  if (orgCheckError) {
    return { ok: false as const, error: orgCheckError.message };
  }

  if (existingOrgs && existingOrgs.length > 0) {
    return { ok: false as const, error: 'Instance already initialized' };
  }

  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .insert({ name: companyName })
    .select()
    .single();

  if (orgError || !organization) {
    return { ok: false as const, error: orgError?.message || 'Failed to create organization' };
  }

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      organization_id: organization.id,
    },
  });

  if (userError || !userData?.user) {
    await admin.from('organizations').delete().eq('id', organization.id);
    return { ok: false as const, error: userError?.message || 'Failed to create admin user' };
  }

  const userId = userData.user.id;
  const displayName = email.split('@')[0] || 'Admin';

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      name: displayName,
      first_name: displayName,
      organization_id: organization.id,
      role: 'admin',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from('organizations').delete().eq('id', organization.id);
    return { ok: false as const, error: profileError.message };
  }

  return {
    ok: true as const,
    organizationId: organization.id,
    userId,
  };
}
