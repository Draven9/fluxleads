import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleKey, getSupabaseUrl, requireEnv } from './env';

let adminClient: SupabaseClient | null = null;

type SupabaseResult<T> = {
  data: T | null;
  error: unknown | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeTransientNetworkError(err: unknown): boolean {
  const text =
    typeof err === 'string'
      ? err
      : typeof err === 'object' && err
        ? JSON.stringify(err)
        : String(err);

  return (
    text.includes('ETIMEDOUT') ||
    text.includes('ECONNRESET') ||
    text.includes('EAI_AGAIN') ||
    text.includes('NetworkError') ||
    text.includes('fetch()') ||
    text.includes('Failed to execute')
  );
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = getSupabaseUrl() || requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getServiceRoleKey() || requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

export function assertNoSupabaseError(
  res: { error: unknown | null },
  context: string,
): void {
  if (!res.error) return;

  const details =
    typeof res.error === 'object'
      ? JSON.stringify(res.error, null, 2)
      : String(res.error);
  throw new Error(`Supabase error (${context}): ${details}`);
}

export function requireSupabaseData<T>(res: SupabaseResult<T>, context: string): T {
  assertNoSupabaseError(res, context);
  if (res.data == null) {
    throw new Error(`Supabase returned no data (${context})`);
  }
  return res.data;
}

/**
 * Executa uma operação Supabase com retry best-effort para erros transitórios de rede.
 * Útil para testes de integração que podem sofrer flutuações do ambiente/CI.
 */
export async function withSupabaseRetry<T>(
  op: () => Promise<SupabaseResult<T>>,
  context: string,
  opts?: { retries?: number; baseDelayMs?: number },
): Promise<SupabaseResult<T>> {
  const retries = Math.max(0, opts?.retries ?? 2);
  const baseDelayMs = Math.max(10, opts?.baseDelayMs ?? 250);

  let last: SupabaseResult<T> | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await op();
    last = res;

    if (!res.error) return res;
    if (!looksLikeTransientNetworkError(res.error)) return res;
    if (attempt === retries) return res;

    // backoff linear simples (250ms, 500ms, 750ms...)
    await sleep(baseDelayMs * (attempt + 1));
  }

  return last ?? { data: null, error: new Error(`Supabase retry failed (${context})`) };
}
