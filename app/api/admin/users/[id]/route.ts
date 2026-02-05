import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Handler HTTP `DELETE` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @param {{ params: Promise<{ id: string; }>; }} ctx - Contexto de execução.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;

  const supabase = await createClient();
  const admin = createStaticAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (meError || !me?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (me.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  if (id === user.id) return json({ error: 'Você não pode remover a si mesmo' }, 400);

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, email, organization_id')
    .eq('id', id)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target) return json({ error: 'User not found' }, 404);
  if (target.organization_id !== me.organization_id) return json({ error: 'Forbidden' }, 403);

  // Delete auth user first (cascades profile via FK, but we also try to remove profile explicitly)
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(id);
  if (authDeleteError) return json({ error: authDeleteError.message }, 500);

  await supabase.from('profiles').delete().eq('id', id);

  return json({ ok: true });
}

/**
 * Handler HTTP `PUT` deste endpoint (Next.js Route Handler).
 * Atualiza dados do usuário (Nome, Cargo).
 * Requer permissão de 'admin'.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  if (!body) return json({ error: 'Body required' }, 400);

  const supabase = await createClient();
  const admin = createStaticAdminClient();

  // 1. Check Permissions
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  // 2. Check Target User
  const { data: target } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', id)
    .single();

  if (!target) return json({ error: 'User not found' }, 404);
  if (target.organization_id !== me.organization_id) return json({ error: 'Forbidden' }, 403);

  // 3. Update Data
  const updates: any = {};
  if (body.role) updates.role = body.role;
  if (body.name) {
    updates.name = body.name;
    updates.first_name = body.name.split(' ')[0];
    updates.last_name = body.name.split(' ').slice(1).join(' ') || '';
  }

  // Update Profile
  const { error: updateError } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id);

  if (updateError) return json({ error: updateError.message }, 500);

  // Update Auth Metadata (for consistency)
  if (body.name) {
    await admin.auth.admin.updateUserById(id, {
      user_metadata: { name: body.name }
    });
  }

  return json({ success: true });
}
