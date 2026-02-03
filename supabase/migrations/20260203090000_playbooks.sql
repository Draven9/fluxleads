-- Create table for Playbook Items (Definitions)
create table if not exists public.stage_playbook_items (
    id uuid not null default gen_random_uuid(),
    organization_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid, -- Tenant FK
    board_id uuid not null references public.boards(id) on delete cascade,
    stage_id text not null, -- Links to the JSONB stage ID in boards table
    text text not null,
    order_index integer not null default 0,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint stage_playbook_items_pkey primary key (id)
);

-- Create table for Checklist Progress (Execution)
create table if not exists public.deal_checklist_progress (
    organization_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid, -- Tenant FK
    deal_id uuid not null references public.deals(id) on delete cascade,
    playbook_item_id uuid not null references public.stage_playbook_items(id) on delete cascade,
    completed boolean not null default false,
    completed_at timestamp with time zone,
    completed_by uuid references auth.users(id),
    
    constraint deal_checklist_progress_pkey primary key (deal_id, playbook_item_id)
);

-- RLS Policies
alter table public.stage_playbook_items enable row level security;
alter table public.deal_checklist_progress enable row level security;

-- Policies for stage_playbook_items (Accessible by authenticated users)
create policy "Enable all access for authenticated users" on public.stage_playbook_items
    for all using (auth.role() = 'authenticated');

-- Policies for deal_checklist_progress
create policy "Enable all access for authenticated users" on public.deal_checklist_progress
    for all using (auth.role() = 'authenticated');
