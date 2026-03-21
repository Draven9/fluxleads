// Edge Function: automation-engine
// Processada a cada 1 minuto via pg_cron.
// Busca automation_runs pendentes/atrasados, executa nós e atualiza status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AutomationRun {
  id: string;
  automation_id: string;
  organization_id: string;
  trigger_type: string;
  context: Record<string, string>;
  current_node_id: string | null;
  status: string;
  run_at: string;
}

interface AutomationRow {
  id: string;
  organization_id: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  trigger_type: string;
  active: boolean;
}

interface AutomationNode {
  id: string;
  type: string; // 'trigger' | 'action' | 'condition'
  data: {
    label?: string;
    actionType?: string;
    config?: Record<string, any>;
    condition?: {
      field: string;
      operator: string;
      value: string;
      field_key?: string;
    };
  };
}

interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  animated?: boolean;
}

interface DealRow {
  id: string;
  status: string;
  owner_id: string | null;
  contact_id: string | null;
  tags: string[] | null;
  channel: string | null;
  custom_fields: Record<string, any> | null;
  is_won: boolean;
  is_lost: boolean;
  updated_at: string;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string | null;
  company_name: string | null;
}

interface IntegrationRow {
  config: {
    base_url?: string;
    api_key?: string;
    instance?: string;
  };
}

interface ChatSessionRow {
  id: string;
  provider_id: string;
}

// ─────────────────────────────────────────────────────────────
// Variable substitution (same as send-scheduled-messages)
// ─────────────────────────────────────────────────────────────

function applyVariables(template: string, contact: ContactRow | null): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return template
    .replace(/\{\{nome\}\}/g, contact?.name || '')
    .replace(/\{\{empresa\}\}/g, contact?.company_name || '')
    .replace(/\{\{data\}\}/g, dateStr)
    .replace(/\{\{hora\}\}/g, timeStr);
}

// ─────────────────────────────────────────────────────────────
// Condition evaluator
// ─────────────────────────────────────────────────────────────

function evaluateCondition(
  condition: { field: string; operator: string; value: string; field_key?: string },
  deal: DealRow,
  messageContent?: string,
  messageDirection?: string
): boolean {
  let actual: string | null = null;

  switch (condition.field) {
    case 'stage_id':
    case 'stage':
      actual = deal.status;
      break;
    case 'tags':
    case 'tag':
      if (condition.operator === 'contains' || condition.operator === 'exists') return (deal.tags || []).includes(condition.value);
      actual = (deal.tags || []).join(',');
      break;
    case 'channel':
      actual = deal.channel;
      break;
    case 'custom_field':
      actual = condition.field_key ? String(deal.custom_fields?.[condition.field_key] ?? '') : null;
      break;
    case 'message_content':
      actual = messageContent || null;
      break;
    case 'message_direction':
      actual = messageDirection || null;
      break;
    default:
      return false;
  }

  if (actual === null) return false;

  switch (condition.operator) {
    case 'eq':
    case 'equals':
      return actual === condition.value;
    case 'neq':
    case 'not_equals':
      return actual !== condition.value;
    case 'contains':
      return actual.toLowerCase().includes(condition.value.toLowerCase());
    case 'not_contains':
      return !actual.toLowerCase().includes(condition.value.toLowerCase());
    case 'starts_with':
      return actual.toLowerCase().startsWith(condition.value.toLowerCase());
    case 'ends_with':
      return actual.toLowerCase().endsWith(condition.value.toLowerCase());
    case 'is_set':
    case 'exists':
      return actual.length > 0;
    case 'is_empty':
      return actual.length === 0;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Graph traversal helper
// ─────────────────────────────────────────────────────────────

function nextNode(
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  currentId: string,
  sourceHandle?: string
): AutomationNode | null {
  const edge = edges.find(
    e => e.source === currentId && (!sourceHandle || e.sourceHandle === sourceHandle)
  );
  if (!edge) return null;
  return nodes.find(n => n.id === edge.target) || null;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseKey}`,
    'apikey': supabaseKey,
  };

  // ── 1. Handle time-based triggers (deal_stale, hours_since_last_message) ──
  await handleTimeTriggers(supabaseUrl, headers);

  // ── 2. Fetch pending/delayed runs due now ──
  const runsRes = await fetch(
    `${supabaseUrl}/rest/v1/automation_runs?status=in.(pending,delayed)&run_at=lte.${new Date().toISOString()}&select=*&limit=50`,
    { headers }
  );
  const runs: AutomationRun[] = await runsRes.json();

  if (!runs.length) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  const results = [];

  for (const run of runs) {
    try {
      // Mark running
      await fetch(`${supabaseUrl}/rest/v1/automation_runs?id=eq.${run.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() }),
      });

      // Load automation
      const autoRes = await fetch(
        `${supabaseUrl}/rest/v1/automations?id=eq.${run.automation_id}&select=*&limit=1`,
        { headers }
      );
      const autos: AutomationRow[] = await autoRes.json();
      const automation = autos[0];
      if (!automation || !automation.active) {
        await markRunDone(supabaseUrl, headers, run.id);
        continue;
      }

      const nodes: AutomationNode[] = automation.nodes || [];
      const edges: AutomationEdge[] = automation.edges || [];

      // Load deal and contact for context
      let deal: DealRow | null = null;
      let contact: ContactRow | null = null;

      if (run.context.deal_id) {
        const dealRes = await fetch(
          `${supabaseUrl}/rest/v1/deals?id=eq.${run.context.deal_id}&select=*&limit=1`,
          { headers }
        );
        const deals: DealRow[] = await dealRes.json();
        deal = deals[0] || null;
      }

      const contactId = run.context.contact_id || deal?.contact_id;
      if (contactId) {
        const contactRes = await fetch(
          `${supabaseUrl}/rest/v1/contacts?id=eq.${contactId}&select=id,name,phone,company_name&limit=1`,
          { headers }
        );
        const contacts: ContactRow[] = await contactRes.json();
        contact = contacts[0] || null;
      }

      // Find start node — resume from current_node_id if delayed, else start at trigger
      let startNodeId = run.current_node_id;
      if (!startNodeId) {
        const triggerNode = nodes.find(n => n.type === 'trigger');
        startNodeId = triggerNode?.id || null;
      }

      if (!startNodeId) {
        await markRunDone(supabaseUrl, headers, run.id);
        continue;
      }

      // Traverse
      let currentNode: AutomationNode | null = nodes.find(n => n.id === startNodeId) || null;
      // If resuming from delay, advance past the delay node
      if (run.current_node_id && currentNode?.data?.actionType === 'delay') {
        currentNode = nextNode(nodes, edges, currentNode.id);
      }

      let delayed = false;

      while (currentNode) {
        const nodeType = currentNode.type;
        const actionType = currentNode.data?.actionType;

        // Trigger node → just advance
        if (nodeType === 'trigger') {
          currentNode = nextNode(nodes, edges, currentNode.id);
          continue;
        }

        // End node
        if (actionType === 'end') break;

        // Delay node
        if (actionType === 'delay') {
          const config = currentNode.data.config || {};
          const amount = Number(config.amount) || 1;
          const unit = String(config.unit || 'hours');
          const minutes = unit === 'minutes' ? amount : unit === 'hours' ? amount * 60 : amount * 1440;
          const runAt = new Date(Date.now() + minutes * 60_000).toISOString();

          await fetch(`${supabaseUrl}/rest/v1/automation_runs?id=eq.${run.id}`, {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({
              status: 'delayed',
              current_node_id: currentNode.id,
              run_at: runAt,
            }),
          });
          delayed = true;
          break;
        }

        // Condition node
        if (nodeType === 'condition') {
          const condition = currentNode.data?.condition;
          let result = false;
          if (condition && deal) {
            result = evaluateCondition(condition, deal, run.context.content, run.context.message_direction);
          }
          currentNode = nextNode(nodes, edges, currentNode.id, result ? 'true' : 'false');
          continue;
        }

        // Action node
        if (nodeType === 'action') {
          await executeAction(
            supabaseUrl, headers, actionType || '', currentNode.data.config || {},
            run, deal, contact
          );
        }

        currentNode = nextNode(nodes, edges, currentNode.id);
      }

      if (!delayed) {
        await markRunDone(supabaseUrl, headers, run.id);
        // Update automation stats
        await fetch(`${supabaseUrl}/rest/v1/automations?id=eq.${run.automation_id}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            run_count: 'run_count + 1',
            last_run_at: new Date().toISOString(),
          }),
        });
      }

      results.push({ id: run.id, status: delayed ? 'delayed' : 'done' });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await fetch(`${supabaseUrl}/rest/v1/automation_runs?id=eq.${run.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'failed', error: msg }),
      });
      results.push({ id: run.id, status: 'failed', error: msg });
    }
  }

  return new Response(
    JSON.stringify({ processed: runs.length, results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});

// ─────────────────────────────────────────────────────────────
// Action executors
// ─────────────────────────────────────────────────────────────

async function executeAction(
  supabaseUrl: string,
  headers: Record<string, string>,
  actionType: string,
  config: Record<string, any>,
  run: AutomationRun,
  deal: DealRow | null,
  contact: ContactRow | null
): Promise<void> {
  const dealId = run.context.deal_id || deal?.id;

  switch (actionType) {
    case 'send_message': {
      if (!config.message) break;
      const message = applyVariables(config.message, contact);

      // Get integration
      const intRes = await fetch(
        `${supabaseUrl}/rest/v1/integrations?organization_id=eq.${run.organization_id}&type=eq.uazapi&select=config&limit=1`,
        { headers }
      );
      const integrations: IntegrationRow[] = await intRes.json();
      const integration = integrations[0];
      if (!integration?.config?.base_url || !integration?.config?.instance) break;

      // Get recipient phone: prefer session provider_id, fallback to contact.phone
      let recipientPhone: string | null = null;
      if (run.context.session_id) {
        const sessRes = await fetch(
          `${supabaseUrl}/rest/v1/chat_sessions?id=eq.${run.context.session_id}&select=provider_id&limit=1`,
          { headers }
        );
        const sessions: ChatSessionRow[] = await sessRes.json();
        recipientPhone = sessions[0]?.provider_id || null;
      }
      if (!recipientPhone && contact?.phone) {
        recipientPhone = contact.phone;
      }
      if (!recipientPhone) break;

      await fetch(
        `${integration.config.base_url}/message/send/text/${integration.config.instance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': integration.config.api_key || '' },
          body: JSON.stringify({ to: recipientPhone, text: message }),
        }
      );
      break;
    }

    case 'move_stage': {
      if (!config.stage_id || !dealId) break;
      await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: config.stage_id }),
      });
      break;
    }

    case 'add_tag': {
      if (!config.tag || !dealId) break;
      // array_append via RPC or raw SQL not possible via REST — use rpc
      await fetch(`${supabaseUrl}/rest/v1/rpc/append_deal_tag`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_deal_id: dealId, p_tag: config.tag }),
      });
      break;
    }

    case 'remove_tag': {
      if (!config.tag || !dealId) break;
      await fetch(`${supabaseUrl}/rest/v1/rpc/remove_deal_tag`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_deal_id: dealId, p_tag: config.tag }),
      });
      break;
    }

    case 'assign_owner': {
      if (!config.user_id || !dealId) break;
      await fetch(`${supabaseUrl}/rest/v1/deals?id=eq.${dealId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ owner_id: config.user_id }),
      });
      break;
    }

    case 'create_task': {
      if (!dealId) break;
      const dueMs = Date.now() + (Number(config.due_offset_hours) || 24) * 3_600_000;
      await fetch(`${supabaseUrl}/rest/v1/activities`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          deal_id: dealId,
          contact_id: run.context.contact_id || deal?.contact_id || null,
          organization_id: run.organization_id,
          type: config.task_type || 'task',
          title: config.title || 'Follow-up automático',
          due_date: new Date(dueMs).toISOString(),
          assigned_to: config.user_id || null,
        }),
      });
      break;
    }

    case 'notify_owner': {
      if (!deal?.owner_id) break;
      // Fetch owner phone
      const ownerRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${deal.owner_id}&select=id,phone&limit=1`,
        { headers }
      );
      const owners: { id: string; phone?: string }[] = await ownerRes.json();
      const ownerPhone = owners[0]?.phone;
      if (!ownerPhone) break;

      const intRes = await fetch(
        `${supabaseUrl}/rest/v1/integrations?organization_id=eq.${run.organization_id}&type=eq.uazapi&select=config&limit=1`,
        { headers }
      );
      const integrations: IntegrationRow[] = await intRes.json();
      const integration = integrations[0];
      if (!integration?.config?.base_url || !integration?.config?.instance) break;

      const notifyMsg = config.message
        ? applyVariables(config.message, contact)
        : `Novo evento em negócio: ${deal.id}`;

      await fetch(
        `${integration.config.base_url}/message/send/text/${integration.config.instance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': integration.config.api_key || '' },
          body: JSON.stringify({ to: ownerPhone, text: notifyMsg }),
        }
      );
      break;
    }

    case 'send_webhook': {
      if (!config.url) break;
      await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: run.id, trigger_type: run.trigger_type, context: run.context }),
      });
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function markRunDone(supabaseUrl: string, headers: Record<string, string>, runId: string) {
  await fetch(`${supabaseUrl}/rest/v1/automation_runs?id=eq.${runId}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'done', completed_at: new Date().toISOString() }),
  });
}

async function handleTimeTriggers(supabaseUrl: string, headers: Record<string, string>) {
  // deal_stale: deals sem atualização há >7 dias com automações ativas
  const staleThreshold = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const staleDealsRes = await fetch(
    `${supabaseUrl}/rest/v1/deals?updated_at=lte.${staleThreshold}&is_won=eq.false&is_lost=eq.false&select=id,contact_id,organization_id&limit=50`,
    { headers }
  );
  const staleDeals: { id: string; contact_id: string; organization_id: string }[] = await staleDealsRes.json();

  for (const deal of staleDeals) {
    // Only queue if not already queued today
    const existsRes = await fetch(
      `${supabaseUrl}/rest/v1/automation_runs?context->>deal_id=eq.${deal.id}&trigger_type=eq.deal_stale&created_at=gte.${new Date(Date.now() - 86_400_000).toISOString()}&select=id&limit=1`,
      { headers }
    );
    const exists: { id: string }[] = await existsRes.json();
    if (exists.length > 0) continue;

    // Find matching automations
    const autoRes = await fetch(
      `${supabaseUrl}/rest/v1/automations?organization_id=eq.${deal.organization_id}&trigger_type=eq.deal_stale&active=eq.true&select=id,organization_id`,
      { headers }
    );
    const autos: { id: string; organization_id: string }[] = await autoRes.json();

    for (const auto of autos) {
      await fetch(`${supabaseUrl}/rest/v1/automation_runs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          automation_id: auto.id,
          organization_id: auto.organization_id,
          trigger_type: 'deal_stale',
          context: { deal_id: deal.id, contact_id: deal.contact_id },
        }),
      });
    }
  }

  // hours_since_last_message: sessions sem mensagem há N horas (conforme trigger_config)
  const autoHoursRes = await fetch(
    `${supabaseUrl}/rest/v1/automations?trigger_type=eq.hours_since_last_message&active=eq.true&select=id,organization_id,trigger_config`,
    { headers }
  );
  const hoursAutos: { id: string; organization_id: string; trigger_config: { hours?: number } }[] = await autoHoursRes.json();

  for (const auto of hoursAutos) {
    const hours = Number(auto.trigger_config?.hours) || 24;
    const threshold = new Date(Date.now() - hours * 3_600_000).toISOString();

    const sessRes = await fetch(
      `${supabaseUrl}/rest/v1/chat_sessions?organization_id=eq.${auto.organization_id}&last_message_at=lte.${threshold}&select=id,contact_id&limit=50`,
      { headers }
    );
    const sessions: { id: string; contact_id: string }[] = await sessRes.json();

    for (const sess of sessions) {
      const existsRes = await fetch(
        `${supabaseUrl}/rest/v1/automation_runs?automation_id=eq.${auto.id}&context->>session_id=eq.${sess.id}&created_at=gte.${new Date(Date.now() - hours * 3_600_000).toISOString()}&select=id&limit=1`,
        { headers }
      );
      const exists: { id: string }[] = await existsRes.json();
      if (exists.length > 0) continue;

      await fetch(`${supabaseUrl}/rest/v1/automation_runs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          automation_id: auto.id,
          organization_id: auto.organization_id,
          trigger_type: 'hours_since_last_message',
          context: { session_id: sess.id, contact_id: sess.contact_id },
        }),
      });
    }
  }

  // ── before_date_field / after_date_field ──────────────────────────────
  for (const triggerType of ['before_date_field', 'after_date_field'] as const) {
    const dateAutosRes = await fetch(
      `${supabaseUrl}/rest/v1/automations?trigger_type=eq.${triggerType}&active=eq.true&select=id,organization_id,trigger_config`,
      { headers }
    );
    const dateAutos: { id: string; organization_id: string; trigger_config: { field_key?: string; days_before?: number; days_after?: number } }[] = await dateAutosRes.json();

    for (const auto of dateAutos) {
      const fieldKey = auto.trigger_config?.field_key;
      if (!fieldKey) continue;

      const dayOffset = triggerType === 'before_date_field'
        ? Number(auto.trigger_config.days_before) || 1
        : -(Number(auto.trigger_config.days_after) || 1);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const targetDateStr = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const todayStr = new Date().toISOString().slice(0, 10);

      // Fetch deals of this org
      const dealsRes = await fetch(
        `${supabaseUrl}/rest/v1/deals?organization_id=eq.${auto.organization_id}&is_won=eq.false&is_lost=eq.false&select=id,contact_id,custom_fields&limit=100`,
        { headers }
      );
      const deals: { id: string; contact_id: string; custom_fields: Record<string, any> | null }[] = await dealsRes.json();

      for (const deal of deals) {
        const fieldValue = deal.custom_fields?.[fieldKey];
        if (!fieldValue || !String(fieldValue).startsWith(targetDateStr)) continue;

        // Dedup: not already queued today for this deal + automation
        const existsRes = await fetch(
          `${supabaseUrl}/rest/v1/automation_runs?automation_id=eq.${auto.id}&context->>deal_id=eq.${deal.id}&created_at=gte.${todayStr}T00:00:00Z&select=id&limit=1`,
          { headers }
        );
        const exists: { id: string }[] = await existsRes.json();
        if (exists.length > 0) continue;

        await fetch(`${supabaseUrl}/rest/v1/automation_runs`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            automation_id: auto.id,
            organization_id: auto.organization_id,
            trigger_type: triggerType,
            context: { deal_id: deal.id, contact_id: deal.contact_id, field_key: fieldKey },
          }),
        });
      }
    }
  }

  // ── daily_at_time ─────────────────────────────────────────────────────
  const now = new Date();
  const dailyAtAutosRes = await fetch(
    `${supabaseUrl}/rest/v1/automations?trigger_type=eq.daily_at_time&active=eq.true&select=id,organization_id,trigger_config`,
    { headers }
  );
  const dailyAtAutos: { id: string; organization_id: string; trigger_config: { time?: string } }[] = await dailyAtAutosRes.json();

  for (const auto of dailyAtAutos) {
    const [configHour, configMin] = (auto.trigger_config?.time || '09:00').split(':').map(Number);
    if (now.getUTCHours() !== configHour || now.getUTCMinutes() !== configMin) continue;

    const todayStr = now.toISOString().slice(0, 10);
    const existsRes = await fetch(
      `${supabaseUrl}/rest/v1/automation_runs?automation_id=eq.${auto.id}&created_at=gte.${todayStr}T00:00:00Z&select=id&limit=1`,
      { headers }
    );
    const exists: { id: string }[] = await existsRes.json();
    if (exists.length > 0) continue;

    await fetch(`${supabaseUrl}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        automation_id: auto.id,
        organization_id: auto.organization_id,
        trigger_type: 'daily_at_time',
        context: { scheduled_time: auto.trigger_config?.time || '09:00' },
      }),
    });
  }

  // ── daily_execution ───────────────────────────────────────────────────
  const dailyExecAutosRes = await fetch(
    `${supabaseUrl}/rest/v1/automations?trigger_type=eq.daily_execution&active=eq.true&select=id,organization_id`,
    { headers }
  );
  const dailyExecAutos: { id: string; organization_id: string }[] = await dailyExecAutosRes.json();

  for (const auto of dailyExecAutos) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existsRes = await fetch(
      `${supabaseUrl}/rest/v1/automation_runs?automation_id=eq.${auto.id}&created_at=gte.${todayStr}T00:00:00Z&select=id&limit=1`,
      { headers }
    );
    const exists: { id: string }[] = await existsRes.json();
    if (exists.length > 0) continue;

    // Queue one run per org (not per deal — the automation itself decides what to do)
    await fetch(`${supabaseUrl}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        automation_id: auto.id,
        organization_id: auto.organization_id,
        trigger_type: 'daily_execution',
        context: {},
      }),
    });
  }
}
