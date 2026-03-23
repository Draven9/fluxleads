import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();
  if (!me || !['admin', 'owner'].includes(me.role)) return null;
  return me;
}

/** GET /api/admin/organizations/[id] — org details + users */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const { id } = await ctx.params;

  const supabase = await createClient();
  const admin = createStaticAdminClient();

  const me = await getAdminProfile(supabase);
  if (!me) return json({ error: 'Forbidden' }, 403);

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, email, created_at')
    .eq('id', id)
    .single();

  if (orgError || !org) return json({ error: 'Organization not found' }, 404);

  const { data: users } = await admin
    .from('profiles')
    .select('id, name, email, role, created_at')
    .eq('organization_id', id)
    .order('created_at', { ascending: true });

  return json({ org, users: users ?? [] });
}

/** PATCH /api/admin/organizations/[id] — update org name and/or email */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Body required' }, 400);

  const supabase = await createClient();
  const admin = createStaticAdminClient();

  const me = await getAdminProfile(supabase);
  if (!me) return json({ error: 'Forbidden' }, 403);

  const updates: Record<string, string> = {};
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.email === 'string') updates.email = body.email.trim();

  if (Object.keys(updates).length === 0) return json({ error: 'No fields to update' }, 400);

  const { error } = await admin
    .from('organizations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
}
