create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  room_code     text unique not null,
  status        text not null default 'waiting' check (status in ('waiting', 'active', 'complete')),
  player1_name  text not null default '',
  player2_name  text not null default '',
  current_turn  smallint not null default 1,
  game_state    jsonb not null,
  winner        smallint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.game_events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;
alter table public.game_events enable row level security;

create policy "Public read"   on public.games for select using (true);
create policy "Public insert" on public.games for insert with check (true);
create policy "Public update" on public.games for update using (true);

create policy "Public read events"   on public.game_events for select using (true);
create policy "Public insert events" on public.game_events for insert with check (true);

alter publication supabase_realtime add table public.games;
