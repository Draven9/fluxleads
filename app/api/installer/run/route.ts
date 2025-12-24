import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { runSchemaMigration } from '@/lib/installer/migrations';
import { bootstrapInstance } from '@/lib/installer/supabase';
import { triggerProjectRedeploy, upsertProjectEnvs } from '@/lib/installer/vercel';

export const maxDuration = 300;
export const runtime = 'nodejs';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const RunSchema = z
  .object({
    installerToken: z.string().optional(),
    vercel: z.object({
      token: z.string().min(1),
      teamId: z.string().optional(),
      projectId: z.string().min(1),
      targets: z.array(z.enum(['production', 'preview'])).min(1),
    }),
    supabase: z.object({
      url: z.string().url(),
      anonKey: z.string().min(1),
      serviceRoleKey: z.string().min(1),
      dbUrl: z.string().min(1),
    }),
    admin: z.object({
      companyName: z.string().min(1).max(200),
      email: z.string().email(),
      password: z.string().min(6),
    }),
  })
  .strict();

type StepStatus = 'ok' | 'error' | 'warning' | 'running';
type Step = { id: string; status: StepStatus; message?: string };

function updateStep(steps: Step[], id: string, status: StepStatus, message?: string) {
  const step = steps.find((item) => item.id === id);
  if (step) {
    step.status = status;
    if (message) step.message = message;
  } else {
    steps.push({ id, status, message });
  }
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  if (process.env.INSTALLER_ENABLED === 'false') {
    return json({ error: 'Installer disabled' }, 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = RunSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const expectedToken = process.env.INSTALLER_TOKEN;
  if (expectedToken && parsed.data.installerToken !== expectedToken) {
    return json({ error: 'Invalid installer token' }, 403);
  }

  const steps: Step[] = [];
  let currentStep: string | null = null;

  const startStep = (id: string) => {
    currentStep = id;
    updateStep(steps, id, 'running', 'Starting');
  };
  const finishStep = (id: string, message: string) => {
    updateStep(steps, id, 'ok', message);
    currentStep = null;
  };

  const { vercel, supabase, admin } = parsed.data;
  const envTargets = vercel.targets;

  try {
    startStep('vercel_envs');
    await upsertProjectEnvs(
      vercel.token,
      vercel.projectId,
      [
        {
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          value: supabase.url,
          targets: envTargets,
        },
        {
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          value: supabase.anonKey,
          targets: envTargets,
        },
        {
          key: 'SUPABASE_SERVICE_ROLE_KEY',
          value: supabase.serviceRoleKey,
          targets: envTargets,
        },
        {
          key: 'INSTALLER_ENABLED',
          value: 'false',
          targets: envTargets,
        },
      ],
      vercel.teamId || undefined
    );
    finishStep('vercel_envs', 'Environment variables configured (installer will be disabled).');

    startStep('supabase_migrations');
    await runSchemaMigration(supabase.dbUrl);
    finishStep('supabase_migrations', 'Schema applied.');

    startStep('supabase_bootstrap');
    const bootstrap = await bootstrapInstance({
      supabaseUrl: supabase.url,
      serviceRoleKey: supabase.serviceRoleKey,
      companyName: admin.companyName,
      email: admin.email,
      password: admin.password,
    });

    if (!bootstrap.ok) {
      updateStep(steps, 'supabase_bootstrap', 'error', bootstrap.error);
      return json({ ok: false, steps, error: bootstrap.error }, 400);
    }
    finishStep('supabase_bootstrap', `Organization ${bootstrap.organizationId} created.`);

    try {
      await triggerProjectRedeploy(
        vercel.token,
        vercel.projectId,
        vercel.teamId || undefined
      );
      updateStep(steps, 'vercel_redeploy', 'ok', 'Redeploy triggered.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to redeploy via Vercel API';
      updateStep(steps, 'vercel_redeploy', 'warning', message);
    }

    return json({ ok: true, steps });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Installer failed';
    if (currentStep) {
      updateStep(steps, currentStep, 'error', message);
    }
    return json({ ok: false, steps, error: message }, 500);
  }
}
