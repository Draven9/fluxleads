-- FASE 5.2 — Agendamento do worker de webhooks via pg_cron + pg_net
-- REQUISITO: pg_cron deve estar habilitado em Database > Extensions

-- Para recriar do zero, remova o job antigo primeiro:
-- SELECT cron.unschedule('process-meta-webhook-events');

-- Agendar o worker para rodar a cada 2 minutos usando pg_net (padrão Supabase)
SELECT cron.schedule(
    'process-meta-webhook-events',
    '*/2 * * * *',
    $$
        SELECT net.http_post(
            url := 'https://gjvktulkjlxgqjgmdpvq.supabase.co/functions/v1/process-webhook-events',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveW1odHBqc2hudHBleGNmempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAwODE2MCwiZXhwIjoyMDg1NTg0MTYwfQ.A7u71hNQSpxQ_Gy8KJSSepH0-I6dl6HHDu-LoQPkuMc'
            ),
            body := '{}'::jsonb
        );
    $$
);

-- Para verificar:
-- SELECT * FROM cron.job;

-- Para desativar:
-- SELECT cron.unschedule('process-meta-webhook-events');
