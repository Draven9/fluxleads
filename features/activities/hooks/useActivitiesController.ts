import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Activity } from '@/types';
import {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
} from '@/lib/query/hooks/useActivitiesQuery';
import { useDeals } from '@/lib/query/hooks/useDealsQuery';
import { useContacts, useCompanies } from '@/lib/query/hooks/useContactsQuery';
import { useProfiles } from '@/lib/query/hooks/useProfilesQuery';
import { useRealtimeSync } from '@/lib/realtime/useRealtimeSync';

/**
 * Hook React `useActivitiesController` que encapsula uma lógica reutilizável.
 * @returns {{ viewMode: "list" | "calendar" | "team"; ... }}
 */
export const useActivitiesController = () => {
  const searchParams = useSearchParams();

  // Auth for tenant organization_id
  const { profile, organizationId } = useAuth();

  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'team'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<Activity['type'] | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'overdue' | 'today' | 'upcoming'>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL'); // New assignee filter
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Permite deep-link do Inbox: /activities?filter=overdue|today|upcoming
  useEffect(() => {
    const filter = (searchParams.get('filter') || '').toLowerCase();

    if (filter === 'overdue' || filter === 'today' || filter === 'upcoming') {
      setDateFilter(filter);
      setViewMode('list');
      return;
    }

    // Qualquer outro valor (inclui vazio) cai no padrão.
    setDateFilter('ALL');
  }, [searchParams]);

  const [formData, setFormData] = useState({
    title: '',
    type: 'CALL' as Activity['type'],
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    description: '',
    dealId: '',
    assigneeId: '', // Added assigneeId to form data
  });

  // Calculate Query Filters (Server-Side)
  const queryFilters = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

    const filters: any = {};

    if (debouncedSearchTerm) filters.search = debouncedSearchTerm;
    if (filterType !== 'ALL') filters.type = filterType;
    if (assigneeFilter !== 'ALL') filters.assigneeId = assigneeFilter;

    if (dateFilter === 'overdue') {
      filters.completed = false;
      filters.dateTo = today.toISOString(); // < Today (actually LTE, so use careful logic or rely on service)
      // Service uses lte for dateTo. "Overdue" means < NOW. 
      // If I send today 00:00, lte means <= today 00:00. This is "Start of today" or earlier. 
      // Correct for overdue (yesterday or older).
    } else if (dateFilter === 'today') {
      filters.dateFrom = today.toISOString();
      filters.dateTo = new Date(tomorrow.getTime() - 1).toISOString(); // End of today
    } else if (dateFilter === 'upcoming') {
      filters.dateFrom = tomorrow.toISOString();
    }

    return filters;
  }, [debouncedSearchTerm, filterType, dateFilter, assigneeFilter]);

  // TanStack Query hooks (Pass filters)
  const { data: activities = [], isLoading: activitiesLoading } = useActivities(queryFilters);
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: contacts = [], isLoading: contactsLoading } = useContacts();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const createActivityMutation = useCreateActivity();
  const updateActivityMutation = useUpdateActivity();
  const deleteActivityMutation = useDeleteActivity();

  // Enable realtime sync (Still global for simplicity, or could filter channel)
  useRealtimeSync('activities');

  const { showToast } = useToast();

  const isLoading = activitiesLoading || dealsLoading || contactsLoading || companiesLoading;

  // Performance: build lookups once (avoid `.find(...)` in handlers).
  const activitiesById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  // Filtered Activities - Just return data from query (it's already filtered)
  const filteredActivities = activities;

  const handleNewActivity = () => {
    setEditingActivity(null);
    setFormData({
      title: '',
      type: 'CALL',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      description: '',
      dealId: '',
      assigneeId: '',
    });
    setIsModalOpen(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    const date = new Date(activity.date);
    setFormData({
      title: activity.title,
      type: activity.type,
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().slice(0, 5),
      description: activity.description || '',
      dealId: activity.dealId,
      assigneeId: (activity as any).assigneeId || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteActivity = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta atividade?')) {
      deleteActivityMutation.mutate(id, {
        onSuccess: () => {
          showToast('Atividade excluída com sucesso', 'success');
        },
      });
    }
  };

  const handleToggleComplete = useCallback(
    (id: string) => {
      const activity = activitiesById.get(id);
      if (!activity) return;

      updateActivityMutation.mutate(
        {
          id,
          updates: { completed: !activity.completed },
        },
        {
          onSuccess: () => {
            showToast(activity.completed ? 'Atividade reaberta' : 'Atividade concluída', 'success');
          },
        }
      );
    },
    [activitiesById, showToast, updateActivityMutation]
  );

  const handleSnooze = (id: string, days = 1) => {
    const activity = activitiesById.get(id);
    if (!activity) return;

    // Parse current date
    const dateObj = new Date(activity.date);

    // Add days
    dateObj.setDate(dateObj.getDate() + days);

    const updates = {
      date: dateObj.toISOString(),
      assignee_id: (activity as any).assigneeId,
    };

    updateActivityMutation.mutate(
      { id, updates },
      {
        onSuccess: () => {
          showToast('Atividade adiada com sucesso!', 'success');
        },
        onError: () => {
          showToast('Erro ao adiar atividade', 'error');
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const date = new Date(`${formData.date}T${formData.time}`);
    const selectedDeal = formData.dealId ? dealsById.get(formData.dealId) : undefined;
    const selectedContact = selectedDeal?.contactId ? contactsById.get(selectedDeal.contactId) : undefined;
    const clientCompanyId = selectedDeal?.clientCompanyId || selectedContact?.clientCompanyId || undefined;
    const participantContactIds = selectedContact?.id ? [selectedContact.id] : [];

    if (editingActivity) {
      updateActivityMutation.mutate(
        {
          id: editingActivity.id,
          updates: {
            title: formData.title,
            type: formData.type,
            description: formData.description,
            date: date.toISOString(),
            dealId: formData.dealId || '',
            contactId: selectedContact?.id || '',
            clientCompanyId,
            participantContactIds,
          },
        },
        {
          onSuccess: () => {
            showToast('Atividade atualizada com sucesso', 'success');
            setIsModalOpen(false);
          },
        }
      );
    } else {
      createActivityMutation.mutate(
        {
          activity: {
            title: formData.title,
            type: formData.type,
            description: formData.description,
            date: date.toISOString(),
            dealId: formData.dealId || '',
            contactId: selectedContact?.id || '',
            clientCompanyId,
            participantContactIds,
            dealTitle: selectedDeal?.title || '',
            completed: false,
            user: { name: 'Eu', avatar: '' },
          },
        },
        {
          onSuccess: () => {
            showToast('Atividade criada com sucesso', 'success');
            setIsModalOpen(false);
          },
          onError: (error: Error) => {
            showToast(`Erro ao criar atividade: ${error.message}`, 'error');
          },
        }
      );
    }
  };

  return {
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    dateFilter,
    setDateFilter,
    assigneeFilter,
    setAssigneeFilter,
    currentDate,
    setCurrentDate,
    isModalOpen,
    setIsModalOpen,
    editingActivity,
    formData,
    setFormData,
    filteredActivities,
    deals,
    contacts,
    companies,
    profiles,
    isLoading,
    handleNewActivity,
    handleEditActivity,
    handleDeleteActivity,
    handleToggleComplete,
    handleSnooze,
    handleSubmit,
  };
};
