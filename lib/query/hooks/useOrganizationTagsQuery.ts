import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagsService } from '@/lib/supabase/tags';
import { useAuth } from '@/context/AuthContext';

const TAGS_KEY = ['organization_tags'] as const;

export const useOrganizationTags = () => {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: TAGS_KEY,
    queryFn: async () => {
      const { data, error } = await tagsService.getAll();
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && !!user,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateOrganizationTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      tagsService.create(name, color),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });
};

export const useUpdateOrganizationTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, color }: { id: string; name?: string; color?: string | null }) =>
      tagsService.update(id, { name, color }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });
};

export const useDeleteOrganizationTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });
};
