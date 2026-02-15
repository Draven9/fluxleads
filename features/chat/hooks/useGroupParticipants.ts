import { useState, useCallback } from 'react';
import { whatsappService } from '@/lib/supabase/whatsapp';
import { supabase } from '@/lib/supabase';

export interface Participant {
    id: string; // JID (phone@s.whatsapp.net)
    admin?: 'admin' | 'superadmin' | null;
    name?: string; // Display name
    phone?: string; // Clean phone number
}

/**
 * Format a phone number for display.
 * e.g. "5511999887766" → "+55 11 99988-7766"
 */
function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');

    // Brazilian format: +55 XX XXXXX-XXXX or +55 XX XXXX-XXXX
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        const ddd = digits.slice(2, 4);
        const rest = digits.slice(4);
        if (rest.length === 9) {
            return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
        }
        if (rest.length === 8) {
            return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
        }
    }

    // Generic: just add + prefix
    if (digits.length > 4) {
        return `+${digits}`;
    }

    return raw;
}

export function useGroupParticipants(groupJid: string | undefined, isGroup: boolean) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    const fetchParticipants = useCallback(async () => {
        if (!groupJid || !isGroup || fetched || loading) return;

        setLoading(true);
        const { data: rawData, error } = await whatsappService.fetchParticipants(groupJid);

        if (!error && rawData) {
            console.log('[Mentions] RAW API Response:', JSON.stringify(rawData, null, 2));
            // The proxy may return:
            // 1. { participants: [...], groupName } (from findGroupInfos - with names)
            // 2. Raw array of { id, admin } (from basic participants endpoint)
            const response = rawData as any;
            let rawParticipants: any[] = [];

            if (response.participants && Array.isArray(response.participants)) {
                // Rich format from findGroupInfos
                rawParticipants = response.participants;
            } else if (Array.isArray(response)) {
                rawParticipants = response;
            } else {
                // Try to extract participants from any nested structure
                rawParticipants = response.participants || response.data || [];
            }

            // Build enriched list
            // Evolution API returns: { id: "LID@lid", phoneNumber: "5535...@s.whatsapp.net", admin }
            // The `id` is a Linked ID (NOT the phone), `phoneNumber` has the real number
            const enriched: Participant[] = rawParticipants
                .filter((p: any) => {
                    // Filter out entries that are group JIDs (not real participants)
                    const pid = p.id || '';
                    return !pid.endsWith('@g.us');
                })
                .map((p: any) => {
                    // Prefer phoneNumber field (real phone), fallback to id
                    const phoneJid = p.phoneNumber || p.id || '';
                    const phone = phoneJid.split('@')[0];
                    // Evolution API may return name/pushName/notify
                    const apiName = p.name || p.pushName || p.notify || p.verifiedName || null;
                    return {
                        id: p.phoneNumber || p.id || '', // Use real phone JID for mentions
                        admin: p.admin || null,
                        phone,
                        name: apiName || undefined,
                    };
                });

            // For participants without names from API, try matching our contacts table
            const unnamed = enriched.filter(p => !p.name && p.phone);

            if (unnamed.length > 0) {
                try {
                    const phones = unnamed.map(p => p.phone!);
                    const { data: contacts } = await supabase
                        .from('contacts')
                        .select('phone, name')
                        .in('phone', phones);

                    if (contacts) {
                        const phoneToName = new Map<string, string>();
                        contacts.forEach(c => {
                            if (c.phone && c.name && c.name !== 'Sem nome') {
                                phoneToName.set(c.phone, c.name);
                            }
                        });

                        enriched.forEach(p => {
                            if (!p.name && p.phone && phoneToName.has(p.phone)) {
                                p.name = phoneToName.get(p.phone);
                            }
                        });
                    }
                } catch (e) {
                    console.error('[Mentions] Error enriching names from contacts:', e);
                }
            }

            // Final fallback: format phone for display
            enriched.forEach(p => {
                if (!p.name) {
                    p.name = formatPhone(p.phone || p.id);
                }
            });

            // Sort: admins first, then by name
            enriched.sort((a, b) => {
                if (a.admin && !b.admin) return -1;
                if (!a.admin && b.admin) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });

            setParticipants(enriched);
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
