import { useState, useCallback } from 'react';
import { whatsappService } from '@/lib/supabase/whatsapp';

interface Participant {
    id: string; // JID (phone@s.whatsapp.net)
    admin?: 'admin' | 'superadmin' | null;
}

export function useGroupParticipants(groupJid: string | undefined, isGroup: boolean) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    const fetchParticipants = useCallback(async () => {
        if (!groupJid || !isGroup || fetched || loading) {
            console.log('[Mentions] Skip fetch:', { groupJid, isGroup, fetched, loading });
            return;
        }

        console.log('[Mentions] Fetching participants for:', groupJid);
        setLoading(true);
        const { data, error } = await whatsappService.fetchParticipants(groupJid);

        if (!error && data) {
            console.log('[Mentions] Participants loaded:', data.length, data);
            // Map Evolution API format to simple Participant interface
            // Evolution usually returns { id: '...', admin: '...' }
            setParticipants(data);
            setFetched(true);
        } else {
            console.error('[Mentions] Error fetching participants:', error);
        }
        setLoading(false);
    }, [groupJid, isGroup, fetched, loading]);

    return {
        participants,
        loading,
        fetchParticipants
    };
}
