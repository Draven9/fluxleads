
import { supabase } from './client';

export interface Profile {
    id: string;
    name: string;
    email: string;
    avatar: string;
    avatar_url?: string;
    role: string;
}

export const profilesService = {
    async getAll(): Promise<{ data: Profile[] | null; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, avatar, avatar_url, role')
                .order('name', { ascending: true });

            if (error) return { data: null, error };
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e as Error };
        }
    },
};
