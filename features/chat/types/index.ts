import { Contact } from '@/types';

export interface ChatSession {
    id: string;
    organization_id: string;
    contact_id: string;
    deal_id?: string;
    provider: 'whatsapp' | 'instagram' | 'email';
    provider_id: string; // remoteJid
    last_message_at: string;
    unread_count: number;
    created_at: string;
    updated_at: string;

    // Relations (Joined)
    contact?: Contact;
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
}
