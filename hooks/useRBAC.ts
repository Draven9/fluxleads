import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { roleSettingsService } from '@/lib/supabase/roles';

export const useRBAC = () => {
    const { profile } = useAuth();

    const { data: allSettings, isLoading } = useQuery({
        queryKey: ['roleSettings'],
        queryFn: async () => {
            const { data, error } = await roleSettingsService.getAll();
            if (error) {
                console.error('Error fetching role settings:', error);
                return [];
            }
            return data || [];
        },
        // Cache for a long time as these don't change often via user interaction
        staleTime: 1000 * 60 * 5,
        enabled: !!profile?.organization_id
    });

    const currentUserSettings = allSettings?.find(s => s.role === profile?.role);
    const permissions = currentUserSettings?.permissions || {};

    /**
     * Checks if the current user has the specified permission.
     * Admins always return true.
     */
    const can = (action: string): boolean => {
        if (!profile) return false;
        if (profile.role === 'admin') return true; // Admins are god-mode

        // If permission explicitly set, return it.
        // If not set/undefined, default to false (safe by default).
        return !!permissions[action];
    };

    return {
        can,
        isLoading,
        role: profile?.role
    };
};
