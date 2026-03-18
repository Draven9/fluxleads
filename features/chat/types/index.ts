import { Contact } from '@/types';

export interface ChatSession {
    id: string;
    organization_id: string;
    contact_id: string;
    deal_id?: string;
    provider: 'whatsapp' | 'instagram' | 'facebook' | 'email';
    provider_id: string; // remoteJid
    name?: string | null; // custom display name (groups or overrides)
    last_message_at: string;
    unread_count: number;
    created_at: string;
    updated_at: string;

    // Relations (Joined)
    contact?: Contact;
    is_marked_unread?: boolean;

    // Multi-provider: which WhatsApp number originated this session
    whatsapp_source_id?: string | null;
    source_display_name?: string | null;  // populated by join from integration_inbound_sources
    source_phone_number?: string | null;
}

export interface Message {
    id: string;
    organization_id: string;
    session_id: string;
    direction: 'inbound' | 'outbound';
    content: string;
    message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'imageMessage' | 'audioMessage' | 'videoMessage' | 'documentMessage' | 'extendedTextMessage' | 'conversation';
    media_url?: string;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    external_id?: string;
    created_at: string;
    reply_to_message_id?: string | null;
    sender_name?: string | null; // name of the sender inside a group
    sender_phone?: string | null; // phone of the sender inside a group
}
