-- Persistent room tracking: head-to-head record and match score
create table if not exists public.rooms (
  room_code     text primary key,
  player1_name  text not null default '',
  player2_name  text not null default '',
  wins_p1       int not null default 0,
  wins_p2       int not null default 0,
  score_p1      int not null default 0,
  score_p2      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.rooms enable row level security;
create policy "Public select" on public.rooms for select using (true);
create policy "Public insert" on public.rooms for insert with check (true);
create policy "Public update" on public.rooms for update using (true);

alter publication supabase_realtime add table public.rooms;
