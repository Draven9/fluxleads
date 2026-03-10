-- FASE 5.4 — Logs de Auditoria
-- Usa IF NOT EXISTS em tudo para ser idempotente e compatível com tabela preexistente.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text,
    resource_id uuid,
    details jsonb,
    ip_address text,
    user_agent text,
    severity text NOT NULL DEFAULT 'info',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Adiciona colunas que possam não existir na versão preexistente da tabela
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS resource_type text,
    ADD COLUMN IF NOT EXISTS resource_id uuid,
    ADD COLUMN IF NOT EXISTS details jsonb,
    ADD COLUMN IF NOT EXISTS ip_address text,
    ADD COLUMN IF NOT EXISTS user_agent text;

-- Adiciona constraint de severidade se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'audit_logs_severity_check'
    ) THEN
        ALTER TABLE public.audit_logs
            ADD CONSTRAINT audit_logs_severity_check
            CHECK (severity IN ('info', 'warning', 'critical'));
    END IF;
END $$;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
    ON public.audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
    ON public.audit_logs(organization_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs(organization_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON public.audit_logs(user_id, created_at DESC);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de leitura: apenas admins da organização
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'audit_logs' AND policyname = 'Admins read own org audit logs'
    ) THEN
        CREATE POLICY "Admins read own org audit logs"
            ON public.audit_logs FOR SELECT
            TO authenticated
            USING (
                organization_id = (
                    SELECT organization_id FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                    LIMIT 1
                )
            );
    END IF;
END $$;

-- Política de inserção: apenas service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'audit_logs' AND policyname = 'Service role inserts audit logs'
    ) THEN
        CREATE POLICY "Service role inserts audit logs"
            ON public.audit_logs FOR INSERT
            TO service_role
            WITH CHECK (true);
    END IF;
END $$;
