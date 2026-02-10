/**
 * Webhook de entrada de leads (100% produto).
 *
 * Endpoint público para receber leads de Hotmart/forms/n8n/Make e criar:
 * - Contato (upsert por email/telefone)
 * - Deal (no board + estágio configurados na fonte)
 *
 * Rota (Supabase Edge Functions):
 * - `POST /functions/v1/webhook-in/<source_id>`
 *
 * Autenticação:
 * - Aceita **um** destes formatos:
 *   - Header `X-Webhook-Secret: <secret>`
 *   - Header `Authorization: Bearer <secret>`
 *   O valor deve bater com o `secret` da fonte em `integration_inbound_sources`.
 *
 * Observação:
 * - Este handler usa `SUPABASE_SERVICE_ROLE_KEY` (segredo padrão do Supabase) e ignora RLS.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

type LeadPayload = {
  /**
   * ID do evento no sistema de origem (opcional).
   * Use quando sua origem for orientada a eventos (ex.: Hotmart) e você quiser idempotência contra retry.
   * Para “cadastro/atualização” (formulário), não é necessário.
   */
  external_event_id?: string;
  /** Nome do contato (legado) */
  name?: string;
  /** Email do contato */
  email?: string;
  /** Telefone do contato */
  phone?: string;
  source?: string;
  notes?: string;
  /** Nome da empresa (cliente) */
  company_name?: string;

  // ===== Campos "produto" (espelham o modal Novo Negócio) =====
  /** Nome do negócio */
  deal_title?: string;
  /** Valor estimado do negócio */
  deal_value?: number | string;
  /** Nome do contato principal (alias) */
  contact_name?: string;

  // ===== Campos de Mídia (Chat) =====
  media_url?: string;
  message_type?: string;

  // Aliases comuns (camelCase / curtos)
  mediaUrl?: string;
  messageType?: string;
  type?: string;

  // Aliases comuns (camelCase / curtos)
  companyName?: string;
  dealTitle?: string;
  dealValue?: number | string;
  contactName?: string;
  title?: string;
  value?: number | string;
  company?: string;
};

const corsHeaders = {
  // NOTE: Para chamadas a partir do browser (UI "Enviar teste") precisamos de CORS.
  // Edge Functions do Supabase são cross-origin em relação ao app, então o navegador
  // faz um preflight (OPTIONS), especialmente com JSON/headers custom.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret, Authorization",
  // Ajuda no debug/observabilidade
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getSourceIdFromPath(req: Request): string | null {
  const url = new URL(req.url);
  // pathname esperado: /functions/v1/webhook-in/<source_id>
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "webhook-in");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

function normalizePhone(phone?: string) {
  if (!phone) return null;
  const cleaned = phone.trim();
  return cleaned || null;
}

function getSecretFromRequest(req: Request) {
  const xSecret = req.headers.get("X-Webhook-Secret") || "";
  if (xSecret.trim()) return xSecret.trim();

  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1]) return m[1].trim();

  return "";
}

function toNullableString(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function toNullableNumber(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    // aceita "1.234,56" e "1234.56"
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getCompanyName(payload: LeadPayload) {
  return (
    toNullableString(payload.company_name) ||
    toNullableString(payload.companyName) ||
    toNullableString(payload.company) ||
    null
  );
}

function getContactName(payload: LeadPayload) {
  return (
    toNullableString(payload.contact_name) ||
    toNullableString(payload.contactName) ||
    toNullableString(payload.name) ||
    null
  );
}

function getDealTitle(payload: LeadPayload) {
  return (
    toNullableString(payload.deal_title) ||
    toNullableString(payload.dealTitle) ||
    toNullableString(payload.title) ||
    null
  );
}

function getDealValue(payload: LeadPayload) {
  return (
    toNullableNumber(payload.deal_value) ??
    toNullableNumber(payload.dealValue) ??
    toNullableNumber(payload.value) ??
    null
  );
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  const sourceId = getSourceIdFromPath(req);
  if (!sourceId) return json(404, { error: "source_id ausente na URL" });

  const secretHeader = getSecretFromRequest(req);
  if (!secretHeader) return json(401, { error: "Secret ausente" });

  // Prefer custom secrets (installer-managed) to avoid reserved `SUPABASE_` prefix restrictions.
  // Fallback to Supabase-provided envs when available.
  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Supabase não configurado no runtime" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: source, error: sourceErr } = await supabase
    .from("integration_inbound_sources")
    .select("id, organization_id, entry_board_id, entry_stage_id, secret, active")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceErr) return json(500, { error: "Erro ao buscar fonte", details: sourceErr.message });
  if (!source || !source.active) return json(404, { error: "Fonte não encontrada/inativa" });
  if (String(source.secret) !== String(secretHeader)) return json(401, { error: "Secret inválido" });

  // Debug Logging - Log Headers and Raw Body
  console.log("WEBHOOK-IN: Request Received");
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

  const rawBody = await req.text();
  console.log("RAW BODY:", rawBody);

  let payload: LeadPayload;
  try {
    payload = JSON.parse(rawBody) as LeadPayload;
    // console.log("WEBHOOK-IN PAYLOAD:", JSON.stringify(payload)); 
  } catch {
    console.error("WEBHOOK-IN: JSON Parse Error", rawBody);
    return json(400, { error: "JSON inválido" });
  }

  const leadName = getContactName(payload);
  const leadEmail = payload.email?.trim()?.toLowerCase() || null;
  const leadPhone = normalizePhone(payload.phone || undefined);
  const externalEventId = payload.external_event_id?.trim() || null;
  const companyName = getCompanyName(payload);
  const dealTitleFromPayload = getDealTitle(payload);
  const dealValue = getDealValue(payload);

  // 1) Auditoria/dedupe (idempotente quando external_event_id existe)
  if (externalEventId) {
    const { error: insertEventErr } = await supabase
      .from("webhook_events_in")
      .insert({
        organization_id: source.organization_id,
        source_id: source.id,
        provider: payload.source || "generic",
        external_event_id: externalEventId,
        payload: payload as unknown as Record<string, unknown>,
        status: "received",
      });

    // Unique violation (dedupe) -> retorna ids já processados (idempotência)
    if (insertEventErr) {
      const msg = String(insertEventErr.message).toLowerCase();
      if (!msg.includes("duplicate")) {
        return json(500, { error: "Falha ao registrar evento", details: insertEventErr.message });
      }

      const { data: existingEvent, error: existingEventErr } = await supabase
        .from("webhook_events_in")
        .select("created_contact_id, created_deal_id, status")
        .eq("source_id", source.id)
        .eq("external_event_id", externalEventId)
        .maybeSingle();

      if (!existingEventErr && existingEvent?.created_deal_id) {
        return json(200, {
          ok: true,
          duplicate: true,
          message: "Recebido! Esse envio já tinha sido processado (não duplicamos nada).",
          organization_id: source.organization_id,
          contact_id: existingEvent.created_contact_id ?? null,
          deal_id: existingEvent.created_deal_id,
          status: existingEvent.status ?? "processed",
        });
      }
      // se ainda não tem IDs gravados, seguimos o fluxo (best-effort)
    }
  }

  // 2) Upsert de contato (por email e/ou telefone)
  let contactId: string | null = null;
  let clientCompanyId: string | null = null;
  let contactAction: "created" | "updated" | "none" = "none";
  let companyAction: "created" | "linked" | "none" = "none";

  // 2.0) Empresa (best-effort): cria/vincula em crm_companies quando companyName existir
  if (companyName) {
    try {
      const { data: existingCompany, error: companyFindErr } = await supabase
        .from("crm_companies")
        .select("id")
        .eq("organization_id", source.organization_id)
        .is("deleted_at", null)
        .eq("name", companyName)
        .limit(1)
        .maybeSingle();

      if (companyFindErr) throw companyFindErr;

      if (existingCompany?.id) {
        clientCompanyId = existingCompany.id as string;
        companyAction = "linked";
      } else {
        const { data: createdCompany, error: companyCreateErr } = await supabase
          .from("crm_companies")
          .insert({
            organization_id: source.organization_id,
            name: companyName,
          })
          .select("id")
          .single();

        if (companyCreateErr) throw companyCreateErr;
        clientCompanyId = (createdCompany as any)?.id ?? null;
        if (clientCompanyId) companyAction = "created";
      }
    } catch {
      // não bloqueia o fluxo do webhook
      clientCompanyId = null;
      companyAction = "none";
    }
  }

  if (leadEmail || leadPhone) {
    const filters: string[] = [];
    if (leadEmail) filters.push(`email.eq.${leadEmail}`);
    if (leadPhone) filters.push(`phone.eq.${leadPhone}`);

    const { data: existingContacts, error: findErr } = await supabase
      .from("contacts")
      .select("id, name, email, phone, organization_id")
      .eq("organization_id", source.organization_id)
      .or(filters.join(","))
      .limit(1);

    if (findErr) return json(500, { error: "Falha ao buscar contato", details: findErr.message });

    if (existingContacts && existingContacts.length > 0) {
      const existing = existingContacts[0];
      contactId = existing.id;

      const updates: Record<string, unknown> = {};
      if (leadName && (!existing.name || existing.name === "Sem nome")) updates.name = leadName;
      if (leadEmail && !existing.email) updates.email = leadEmail;
      if (leadPhone && !existing.phone) updates.phone = leadPhone;
      if (companyName) updates.company_name = companyName;
      if (clientCompanyId) updates.client_company_id = clientCompanyId;
      if (payload.notes) updates.notes = payload.notes;
      if (payload.source) updates.source = payload.source;

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase
          .from("contacts")
          .update(updates)
          .eq("id", contactId);
        if (updErr) return json(500, { error: "Falha ao atualizar contato", details: updErr.message });
        contactAction = "updated";
      } else {
        contactAction = "none";
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from("contacts")
        .insert({
          organization_id: source.organization_id,
          name: leadName || leadEmail || leadPhone || "Lead",
          email: leadEmail,
          phone: leadPhone,
          source: payload.source || "webhook",
          company_name: companyName,
          client_company_id: clientCompanyId,
          notes: payload.notes || null,
        })
        .select("id")
        .single();

      if (createErr) return json(500, { error: "Falha ao criar contato", details: createErr.message });
      contactId = created?.id ?? null;
      if (contactId) contactAction = "created";
    }
  }

  // 3) Deal (cadastro/upsert):
  // - Se já existir um deal "em aberto" do mesmo contato no mesmo board, atualiza em vez de criar outro.
  // - Se não existir (ou não tiver contato), cria.
  const dealTitle = dealTitleFromPayload || leadName || leadEmail || leadPhone || "Novo Lead";

  let dealId: string | null = null;
  let dealAction: "created" | "updated" = "created";

  if (contactId) {
    const { data: existingDeal, error: findDealErr } = await supabase
      .from("deals")
      .select("id, stage_id, is_won, is_lost")
      .eq("organization_id", source.organization_id)
      .eq("board_id", source.entry_board_id)
      .eq("contact_id", contactId)
      .eq("is_won", false)
      .eq("is_lost", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findDealErr) {
      return json(500, { error: "Falha ao buscar deal existente", details: findDealErr.message });
    }

    if (existingDeal?.id) {
      dealId = existingDeal.id as string;
      dealAction = "updated";

      const updates: Record<string, unknown> = {
        title: dealTitle,
        updated_at: new Date().toISOString(),
      };
      if (dealValue !== null) updates.value = dealValue;
      if (clientCompanyId) updates.client_company_id = clientCompanyId;

      // mantém stage atual (não “puxa” de volta pro stage de entrada)
      // apenas carimba metadados do inbound
      updates.custom_fields = {
        inbound_source_id: source.id,
        inbound_external_event_id: externalEventId,
        inbound_company_name: companyName,
      };

      const { error: updDealErr } = await supabase
        .from("deals")
        .update(updates)
        .eq("id", dealId);

      if (updDealErr) return json(500, { error: "Falha ao atualizar deal", details: updDealErr.message });
    }
  }

  if (!dealId) {
    const { data: createdDeal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        organization_id: source.organization_id,
        title: dealTitle,
        value: dealValue ?? 0,
        probability: 10,
        priority: "medium",
        board_id: source.entry_board_id,
        stage_id: source.entry_stage_id,
        contact_id: contactId,
        client_company_id: clientCompanyId,
        last_stage_change_date: new Date().toISOString(),
        tags: ["Novo"],
        custom_fields: {
          inbound_source_id: source.id,
          inbound_external_event_id: externalEventId,
          inbound_company_name: companyName,
        },
      })
      .select("id")
      .single();

    if (dealErr) return json(500, { error: "Falha ao criar deal", details: dealErr.message });
    dealId = createdDeal?.id ?? null;
    dealAction = "created";
  }

  // Helper functions for media fields
  function getMediaUrl(payload: any) {
    const url = (
      toNullableString(payload.media_url) ||
      toNullableString(payload.mediaUrl) ||
      null
    );
    // If we have a URL/Base64, return it.
    if (url) return url;

    // Check for nested media in extendedTextMessage (Forwarded case)
    // N8n might have flattened it to media_url already, but if not:
    const quoted = payload.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      return (
        quoted.imageMessage?.url ||
        quoted.videoMessage?.url ||
        quoted.audioMessage?.url ||
        quoted.documentMessage?.url ||
        quoted.stickerMessage?.url ||
        null
      );
    }
    return null;
  }

  function getMessageType(payload: any) {
    let type = (
      toNullableString(payload.message_type) ||
      toNullableString(payload.messageType) ||
      toNullableString(payload.type) ||
      'text'
    );

    // Normalize 'extendedTextMessage' to 'text' unless it has media
    if (type === 'extendedTextMessage' || type === 'conversation') {
      const media = getMediaUrl(payload);
      if (media) {
        // infer type from payload keys if possible, or default to image if we can't tell
        // (Strictly speaking we should check which key existed, but for now relies on valid mediaUrl)
        // If the mediaUrl came from imageMessage, it's an image.
        // Simplified heuristic: if it has mediaUrl, treatment as 'image' is safer than 'text' for UI rendering
        // but ideally we keep original type if it's mixed. 
        // However, UI renders 'text' as text-only. 
        // Let's try to detect specific type from payload if we can.
        if (payload.media_url?.startsWith('data:image') || payload.message?.imageMessage || payload.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) return 'image';
        if (payload.media_url?.startsWith('data:video') || payload.message?.videoMessage || payload.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) return 'video';
        if (payload.media_url?.startsWith('data:audio') || payload.message?.audioMessage || payload.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage) return 'audio';

        return 'image'; // Fallback for forwarded media visual
      }
      return 'text';
    }

    return type;
  }

  // 4) Integração com módulo de Chat (Mensagens)
  const mediaUrl = getMediaUrl(payload);
  const messageType = getMessageType(payload);

  // Group Logic Parsing
  const isGroup = (payload as any).is_group || (payload as any).isGroup || false;
  // For groups, remoteJid is the Group ID. For DMs, it's the sender.
  const remoteJid = (payload as any).remoteJid || (payload as any).group_id || (payload as any).groupId;
  // Sender identity
  const participant = (payload as any).participant || (payload as any).sender || leadPhone;
  const pushName = (payload as any).pushName || (payload as any).senderName || leadName || "Desconhecido";

  // Check if message is from me (sent from mobile)
  const isFromMe = (payload as any).from_me === true || (payload as any).fromMe === true || (payload as any).from_me === 'true';

  let content = payload.notes || (mediaUrl ? '' : null);

  // If Group, we MUST link to the GROUP Contact, not the SENDER Contact.
  let chatContactId = contactId; // Default to the individual contact found above

  if (isGroup && remoteJid) {
    // Find the Group Contact
    // We try multiple formats because the contact might have been created with full JID (generic lead) or stripped number.
    const groupPhoneParsed = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
    const potentialGroupPhones = [remoteJid, groupPhoneParsed];

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('organization_id', source.organization_id)
      .in('phone', potentialGroupPhones);

    let electedContactId = null;

    if (contacts && contacts.length > 0) {
      // Prioritize contact that ALREADY has a session (to avoid splitting history)
      const contactIds = contacts.map(c => c.id);
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('contact_id')
        .eq('organization_id', source.organization_id)
        .in('contact_id', contactIds)
        .limit(1);

      if (sessions && sessions.length > 0) {
        electedContactId = sessions[0].contact_id;
      } else {
        // No session exists? Prefer the one with short phone (Legacy Standard)
        const shortMatch = contacts.find(c => c.phone === groupPhoneParsed);
        electedContactId = shortMatch ? shortMatch.id : contacts[0].id;
      }
    }

    if (electedContactId) {
      chatContactId = electedContactId;

      // Prefix content with Sender Name for visibility in UI
      // ONLY if it's NOT from me. If I sent it, I know who I am.
      if (content && !isFromMe) {
        content = `*${pushName}*: ${content}`;
      }
    } else {
      // If group contact doesn't exist, we MUST create it to group messages correctly.
      // Use the stripped phone (standard) and forced source.
      try {
        const { data: newGroup } = await supabase
          .from('contacts')
          .upsert({
            organization_id: source.organization_id,
            name: "Grupo " + (pushName !== "Desconhecido" && pushName !== remoteJid ? pushName : groupPhoneParsed),
            phone: groupPhoneParsed,
            source: 'whatsapp_group',
            notes: 'Auto-created by Webhook-In (Group)'
          }, { onConflict: 'phone,organization_id' })
          .select('id')
          .single();

        if (newGroup) {
          chatContactId = newGroup.id;
          if (content && !isFromMe) {
            content = `*${pushName}*: ${content}`;
          }
        }
      } catch (e) {
        console.error("Failed to auto-create group contact", e);
        // Fallback: chatContactId remains contactId (Individual or Generic Group Contact)
      }
    }
  } else if (isFromMe && remoteJid && !isGroup) {
    // INDIVIDUAL MESSAGE SENT FROM MOBILE (From Me)
    // contactId might be "Me" (if N8n mapped phone=Sender) or null.
    // We MUST ensure chatContactId is the RECIPIENT.

    const recipientPhone = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;

    // Try to find the contact by the recipient's phone (remoteJid)
    const { data: recipientContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', source.organization_id)
      .eq('phone', recipientPhone)
      .limit(1)
      .maybeSingle();

    if (recipientContact) {
      chatContactId = recipientContact.id;
    } else {
      // Create contact for recipient if it doesn't exist
      // Note: We DO NOT use 'pushName' here because for fromMe messages, pushName is likely MY name.
      try {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            organization_id: source.organization_id,
            name: recipientPhone, // We don't know the name of the recipient in this context
            phone: recipientPhone,
            source: 'whatsapp_active', // Active outreach/response
            notes: 'Auto-created by Webhook-In (Outbound Mobile)'
          })
          .select('id')
          .single();

        if (newContact) {
          chatContactId = newContact.id;
        }
      } catch (e) {
        console.error("Failed to auto-create individual contact for outbound", e);
      }
    }
  }


  if (chatContactId && (content !== null || mediaUrl)) {
    try {
      // 4.1) Busca ou cria sessão de chat
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id, unread_count')
        .eq('organization_id', source.organization_id)
        .eq('contact_id', chatContactId)
        .maybeSingle();

      let sessionId = sessionData?.id;
      let duplicateMessageId: string | null = null;
      let insertError = null;
      let updateError = null;

      if (!sessionId) {
        console.log(`[Webhook-In] Creating new session for contact ${chatContactId}`);
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({
            organization_id: source.organization_id,
            contact_id: chatContactId,
            provider: 'whatsapp',
            unread_count: 0,
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();
        sessionId = newSession?.id;
      }



      if (sessionId) {
        // DEDUPLICATION LOGIC for Outbound Messages (Sent by System)
        // If message is from_me, check if we just sent it via chat-out to avoid duplication.
        if (isFromMe) {
          // Look for a message with same session, outbound, content, created recently (< 2 min)
          // And that does NOT have an external_id yet (or we can overwrite it)
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

          const { data: potentialDupes } = await supabase
            .from('messages')
            .select('id, content')
            .eq('session_id', sessionId)
            .eq('direction', 'outbound')
            .gte('created_at', twoMinutesAgo)
            .limit(5);

          if (potentialDupes && potentialDupes.length > 0) {
            // Fuzzy match content (exact match for now)
            const match = potentialDupes.find(m => m.content === (content || ''));
            if (match) {
              duplicateMessageId = match.id;
              console.log(`[Webhook-In] Deduplicated message ${match.id} (System sent)`);
            }
          }
        }

        if (duplicateMessageId) {
          // Update the existing message with the External ID (WhatsApp ID)
          const { error: updMsgErr } = await supabase.from('messages')
            .update({
              external_id: externalEventId,
              status: 'sent' // Confirm status
            })
            .eq('id', duplicateMessageId);

          if (updMsgErr) insertError = updMsgErr;

        } else {
          // 4.2) Insere a mensagem na tabela de chat (New Message)
          console.log(`[Webhook-In] Inserting new message. Group: ${isGroup} FromMe: ${isFromMe}`);
          const { error: insErr } = await supabase.from('messages').insert({
            organization_id: source.organization_id,
            session_id: sessionId,
            direction: isFromMe ? 'outbound' : 'inbound',
            content: content || '',
            message_type: messageType,
            media_url: mediaUrl,
            status: isFromMe ? 'sent' : 'received',
            external_id: externalEventId, // Save WA ID
            created_at: new Date().toISOString()
          });

          if (insErr) {
            console.error('[Webhook-In] Insert Error:', insErr);
            insertError = insErr;
          }

          // 4.3) Atualiza sessão
          const currentUnread = sessionData?.unread_count ?? 0;
          const { error: updSessErr } = await supabase
            .from('chat_sessions')
            .update({
              last_message_at: new Date().toISOString(),
              unread_count: isFromMe ? currentUnread : currentUnread + 1 // Don't inc unread if sent by me
            })
            .eq('id', sessionId);

          if (updSessErr) updateError = updSessErr;
        }
      }

      // Build debug object
      const debugInfo = {
        isGroup,
        isFromMe,
        sessionId,
        content,
        direction: isFromMe ? 'outbound' : 'inbound',
        duplicateMessageId,
        action: duplicateMessageId ? 'updated_existing' : 'inserted_new',
        chatContactId,
        insertError,
        updateError
      };

      console.log('[Webhook-In] Debug:', debugInfo);

      return json(200, {
        ok: true,
        message: "Processado com sucesso",
        debug: debugInfo
      });
    } catch (chatErr) {
      console.error("Erro ao processar chat:", chatErr);
      return json(200, {
        ok: false,
        message: "Erro no processamento chat",
        error: String(chatErr)
      });
    }
  }

  return json(200, {
    ok: true,
    message: "Processado com sucesso",
    note: "Sem ação de chat (contato não encontrado ou sem conteúdo)"
  });
});
