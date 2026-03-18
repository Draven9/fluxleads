import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/admin/organizations
 * Lista todas as organizações com contagens de usuários, contacts e deals.
 * Apenas admin/owner podem acessar.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!me || !['admin', 'owner'].includes(me.role ?? '')) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const admin = createStaticAdminClient();

    const { data: orgs, error } = await admin
      .from('organizations')
      .select(`
        id,
        name,
        created_at,
        users_count:profiles(count),
        contacts_count:contacts(count),
        deals_count:deals(count)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return json({ error: error.message }, 500);

    return json({ organizations: orgs ?? [] });
  } catch (err: any) {
    console.error('API /admin/organizations CRASH:', err);
    return json({ error: err.message || 'Internal Server Crash' }, 500);
  }
}
