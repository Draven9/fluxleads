import { supabase } from '@/lib/supabase/client';
import { PlaybookItem, DealChecklistProgress } from '@/types/types';

// Transform snake_case from DB to camelCase for Frontend
const transformPlaybookItem = (data: any): PlaybookItem => ({
    id: data.id,
    boardId: data.board_id,
    stageId: data.stage_id,
    text: data.text,
    orderIndex: data.order_index
});

const transformProgress = (data: any): DealChecklistProgress => ({
    dealId: data.deal_id,
    playbookItemId: data.playbook_item_id,
    completed: data.completed,
    completedAt: data.completed_at,
    completedBy: data.completed_by
});

export const playbookService = {
    // === DEFINITIONS (Playbook Items) ===

    async getItemsByStage(boardId: string, stageId: string): Promise<PlaybookItem[]> {
        const { data, error } = await supabase
            .from('stage_playbook_items')
            .select('*')
            .eq('board_id', boardId)
            .eq('stage_id', stageId)
            .order('order_index', { ascending: true });

        if (error) throw error;
        return (data || []).map(transformPlaybookItem);
    },

    async createItem(item: Omit<PlaybookItem, 'id'>): Promise<PlaybookItem> {
        const { data, error } = await supabase
            .from('stage_playbook_items')
            .insert({
                board_id: item.boardId,
                stage_id: item.stageId,
                text: item.text,
                order_index: item.orderIndex
            })
            .select()
            .single();

        if (error) throw error;
        return transformPlaybookItem(data);
    },

    async updateItem(id: string, updates: Partial<PlaybookItem>): Promise<void> {
        const { error } = await supabase
            .from('stage_playbook_items')
            .update({
                text: updates.text,
                order_index: updates.orderIndex
            })
            .eq('id', id);

        if (error) throw error;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('stage_playbook_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // === EXECUTION (Checklist Progress) ===

    async getProgress(dealId: string): Promise<DealChecklistProgress[]> {
        const { data, error } = await supabase
            .from('deal_checklist_progress')
            .select('*')
            .eq('deal_id', dealId);

        if (error) throw error;
        return (data || []).map(transformProgress);
    },

    async toggleItem(dealId: string, itemId: string, completed: boolean): Promise<void> {
        const { error } = await supabase
            .from('deal_checklist_progress')
            .upsert({
                deal_id: dealId,
                playbook_item_id: itemId,
                completed,
                completed_at: completed ? new Date().toISOString() : null,
                // completed_by: user_id (handled by RLS or backend trigger if needed, but simple upsert works)
            });

        if (error) throw error;
    }
};
