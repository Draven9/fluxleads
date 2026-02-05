import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Handler HTTP `GET` deste endpoint (Next.js Route Handler).
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function GET() {
  const supabase = await createClient();

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

  // Performance: evita payload grande em organizações com muitos usuários.
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, organization_id, created_at')
    .eq('organization_id', me.organization_id)
    .limit(200)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);

  const users = (profiles || []).map((p) => ({
    id: p.id,
    email: p.email,
    role: p.role,
    organization_id: p.organization_id,
    created_at: p.created_at,
    status: 'active' as const,
  }));

  return json({ users });
}

/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 * Cria um usuário manualmente (Email/Senha) e o vincula à organização.
 * Requer permissão de 'admin'.
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  // 1. Verificar permissão de Admin do usuário atual
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (meError || !me?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (me.role !== 'admin') return json({ error: 'Forbidden. Only admins can create users.' }, 403);

  // 2. Parse e Validação do Body
  const body = await req.json().catch(() => null);
  if (!body || !body.email || !body.password || !body.name) {
    return json({ error: 'Missing required fields (email, password, name)' }, 400);
  }

  const { email, password, name, role } = body;
  const targetRole = role || 'vendedor'; // Default fallback

  // 3. Criar usuário usando Service Role (Admin API)
  // Necessário para criar usuário sem logar e sem enviar email de confirmação obrigatoriamente (se quisermos auto-confirmar)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not defined');
    return json({ error: 'Server configuration error' }, 500);
  }

  // Importar createClient do supabase-js para usar service key
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // 3.1 Criar no Auth
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirma o email
    user_metadata: { name }
  });

  if (createError) {
    return json({ error: createError.message }, 400);
  }

  if (!newUser.user) {
    return json({ error: 'Failed to create user' }, 500);
  }

  // 4. Atualizar Profile (vincular à Organization e definir Role)
  // O trigger de 'on_auth_user_created' cria o profile, mas precisamos atualizar organization_id e role.
  // Usamos o admin client para garantir permissão de update imediato se necessário, 
  // embora o RLS devesse permitir o próprio user... mas como estamos no server action admin context, melhor garantir.

  // Aguardar um pouco para garantir que o trigger rodou? 
  // Ou melhor: fazer um upsert manual para garantir.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      organization_id: me.organization_id,
      role: targetRole,
      status: 'active', // Marca como ativo direto
      confirmed_at: new Date().toISOString()
    })
    .eq('id', newUser.user.id);

  if (profileError) {
    // Se falhar o update do profile, talvez devêssemos deletar o user? 
    // Por enquanto, logamos o erro. O user existe mas sem org vinculada corretamente.
    console.error('Error updating profile for new user:', profileError);
    return json({ error: 'User created but profile update failed', details: profileError.message }, 207); // 207 Multi-Status kinda
  }

  return json({ success: true, user: { id: newUser.user.id, email: newUser.user.email, role: targetRole } }, 201);
}
