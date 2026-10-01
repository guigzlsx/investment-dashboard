create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_conversations_id_user_unique unique (id, user_id)
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_names jsonb not null default '[]'::jsonb,
  structured_data jsonb,
  provenance jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint assistant_messages_conversation_user_fkey
    foreign key (conversation_id, user_id)
    references public.assistant_conversations (id, user_id)
    on delete cascade
);

create index assistant_conversations_user_updated_idx
  on public.assistant_conversations(user_id, updated_at desc);

create index assistant_messages_conversation_created_idx
  on public.assistant_messages(conversation_id, created_at);

create trigger assistant_conversations_set_updated_at
  before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy "users manage their assistant conversations"
  on public.assistant_conversations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users manage their assistant messages"
  on public.assistant_messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.assistant_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );
