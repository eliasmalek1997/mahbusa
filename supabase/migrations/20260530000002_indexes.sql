-- Indexes for room_code lookups (used on every game load and poll)
create index if not exists games_room_code_idx on public.games(room_code);
create index if not exists games_status_idx on public.games(status);
create index if not exists games_updated_at_idx on public.games(updated_at desc);
