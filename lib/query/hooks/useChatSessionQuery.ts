import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient()!;

interface ChatSessionSummary {
    id: string;
    provider_id: string;
    provider: string;
}

/**
 * Retorna a sessão de chat mais recente de um contato (para usar no agendamento de mensagens).
 * Retorna null se o contato não tiver nenhuma conversa no WhatsApp.
 */
export function useContactChatSession(contactId?: string | null) {
    return useQuery<ChatSessionSummary | null>({
        queryKey: ['chat_sessions', 'by_contact', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('id, provider_id, provider')
                .eq('contact_id', contactId!)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!contactId,
        staleTime: 60_000,
    });
}
