import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * POST /api/admin/provision-tenant
 *
 * Cria um novo tenant (Organização) com Board padrão,
 * estágios de funil e usuário administrador.
 *
 * Apenas usuários com role 'admin' ou 'owner' podem chamar este endpoint.
 *
 * Body JSON esperado:
 * {
 *   "orgName": "Nome da Empresa",
 *   "adminEmail": "admin@empresa.com",
 *   "adminName": "Nome do Admin",
 *   "adminPassword": "senha-segura"
 * }
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  // 1. Validar que o chamador é super admin / owner da plataforma
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();

  if (!caller) return json({ error: 'Unauthorized' }, 401);

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role ?? '')) {
    return json({ error: 'Forbidden. Only admins/owners can provision tenants.' }, 403);
  }

  // 2. Parse do body
  const body = await req.json().catch(() => null);
  if (!body?.orgName || !body?.adminEmail || !body?.adminName || !body?.adminPassword) {
    return json({ error: 'Missing required fields: orgName, adminEmail, adminName, adminPassword' }, 400);
  }

  const { orgName, adminEmail, adminName, adminPassword } = body as {
    orgName: string;
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  };

  const admin = createStaticAdminClient();

  let orgId: string | null = null;
  let boardId: string | null = null;
  let newUserId: string | null = null;

  try {
    // 3. Criar organização
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: orgName })
      .select('id')
      .single();

    if (orgError || !org) throw new Error(`Erro ao criar organização: ${orgError?.message}`);
    orgId = org.id;

    // 4. Criar Board padrão
    const { data: board, error: boardError } = await admin
      .from('boards')
      .insert({
        name: 'Funil de Vendas',
        key: 'funil-de-vendas',
        organization_id: orgId,
        type: 'SALES',
        is_default: true,
      })
      .select('id')
      .single();

    if (boardError || !board) throw new Error(`Erro ao criar board: ${boardError?.message}`);
    boardId = board.id;

    // 5. Criar estágios padrão
    const stages = [
      { name: 'lead',            label: 'Novo Lead',          color: '#6366f1', order: 1, is_default: true  },
      { name: 'qualificacao',    label: 'Qualificação',        color: '#3b82f6', order: 2, is_default: false },
      { name: 'proposta',        label: 'Proposta Enviada',    color: '#f59e0b', order: 3, is_default: false },
      { name: 'negociacao',      label: 'Em Negociação',       color: '#ec4899', order: 4, is_default: false },
      { name: 'fechado_ganho',   label: 'Fechado (Ganho)',     color: '#10b981', order: 5, is_default: false },
      { name: 'fechado_perdido', label: 'Fechado (Perdido)',   color: '#ef4444', order: 6, is_default: false },
    ].map(s => ({ ...s, board_id: boardId!, organization_id: orgId! }));

    const { error: stagesError } = await admin.from('board_stages').insert(stages);
    if (stagesError) throw new Error(`Erro ao criar estágios: ${stagesError.message}`);

    // 6. Criar usuário admin no Supabase Auth
    const { data: newUser, error: userError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        organization_id: orgId,
        role: 'admin',
      },
    });

    if (userError || !newUser.user) throw new Error(`Erro ao criar usuário: ${userError?.message}`);
    newUserId = newUser.user.id;

    // 7. O trigger `handle_new_user` criará o profile automaticamente.
    //    Aguardamos e garantimos via upsert case trigger seja lento.
    await new Promise(r => setTimeout(r, 500));

    const { error: profileUpsertError } = await admin
      .from('profiles')
      .upsert({
        id: newUserId,
        email: adminEmail,
        name: adminName,
        role: 'admin',
        organization_id: orgId,
      }, { onConflict: 'id' });

    if (profileUpsertError) throw new Error(`Erro ao garantir perfil: ${profileUpsertError.message}`);

    return json({
      success: true,
      organization: { id: orgId, name: orgName },
      board: { id: boardId, name: 'Funil de Vendas' },
      user: { id: newUserId, email: adminEmail },
    }, 201);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[provision-tenant] ERRO:', message);

    // Limpeza parcial se organização foi criada mas algo falhou depois
    if (orgId && !newUserId) {
      await admin.from('boards').delete().eq('organization_id', orgId);
      await admin.from('board_stages').delete().eq('organization_id', orgId);
      await admin.from('organizations').delete().eq('id', orgId);
    }

    return json({ error: message }, 500);
  }
}
