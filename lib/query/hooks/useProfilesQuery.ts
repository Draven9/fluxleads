
import { useQuery } from '@tanstack/react-query';
import { profilesService } from '@/lib/supabase/profiles';
import { useAuth } from '@/context/AuthContext';

export const useProfiles = () => {
    const { user, loading: authLoading } = useAuth();

    return useQuery({
        queryKey: ['profiles', 'list'], // Simple query key for now
        queryFn: async () => {
            const { data, error } = await profilesService.getAll();
            if (error) throw error;
            return data || [];
        },
        enabled: !authLoading && !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });
};
