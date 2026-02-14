import { useState, useCallback } from 'react';
import { whatsappService } from '@/lib/supabase/whatsapp';
import { supabase } from '@/lib/supabase';

export interface Participant {
    id: string; // JID (phone@s.whatsapp.net)
    admin?: 'admin' | 'superadmin' | null;
    name?: string; // Display name (from contacts table or formatted phone)
    phone?: string; // Clean phone number
}

/**
 * Format a phone number for display.
 * e.g. "5511999887766" → "+55 11 99988-7766"
 */
function formatPhone(raw: string): string {
    // Remove non-digits
    const digits = raw.replace(/\D/g, '');

    // Brazilian format: +55 XX XXXXX-XXXX
    if (digits.startsWith('55') && digits.length >= 12) {
        const cc = digits.slice(0, 2);
        const ddd = digits.slice(2, 4);
        const rest = digits.slice(4);
        if (rest.length === 9) {
            return `+${cc} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
        }
        if (rest.length === 8) {
            return `+${cc} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
        }
    }

    // Generic international format
    if (digits.length > 6) {
        return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    }

    return raw;
}

export function useGroupParticipants(groupJid: string | undefined, isGroup: boolean) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    const fetchParticipants = useCallback(async () => {
        if (!groupJid || !isGroup || fetched || loading) {
            return;
        }

        setLoading(true);
        const { data, error } = await whatsappService.fetchParticipants(groupJid);

        if (!error && data) {
            // Extract phone numbers from JIDs and enrich with contact names
            const rawParticipants: Participant[] = data.map((p: any) => ({
                id: p.id,
                admin: p.admin || null,
                phone: p.id?.split('@')[0] || '',
                name: undefined, // Will be enriched below
            }));

            // Batch lookup: match participant phones against contacts table
            const phoneNumbers = rawParticipants.map(p => p.phone).filter(Boolean);

            if (phoneNumbers.length > 0) {
                try {
                    const { data: contacts } = await supabase
                        .from('contacts')
                        .select('phone, name')
                        .in('phone', phoneNumbers);

                    if (contacts) {
                        const phoneToName = new Map<string, string>();
                        contacts.forEach(c => {
                            if (c.phone && c.name && c.name !== 'Sem nome') {
                                phoneToName.set(c.phone, c.name);
                            }
                        });

                        // Enrich participants with names
                        rawParticipants.forEach(p => {
                            if (p.phone && phoneToName.has(p.phone)) {
                                p.name = phoneToName.get(p.phone);
                            }
                        });
                    }
                } catch (e) {
                    console.error('[Mentions] Error enriching names:', e);
                }
            }

            // Format display: use name if available, else formatted phone
            rawParticipants.forEach(p => {
                if (!p.name) {
                    p.name = formatPhone(p.phone || p.id);
                }
            });

            // Sort: named contacts first, then by name/phone
            rawParticipants.sort((a, b) => {
                // Admins first
                if (a.admin && !b.admin) return -1;
                if (!a.admin && b.admin) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });

            setParticipants(rawParticipants);
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
