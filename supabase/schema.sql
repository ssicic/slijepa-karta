-- Online leaderboard for Slijepa karta.
-- Paste into Supabase: SQL Editor -> New query -> Run.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(nickname) between 2 and 16),
  points      integer     not null check (points between 0 and 3000),  -- 6 levels x 5 questions x 100
  reached     smallint    not null check (reached between 0 and 9),    -- index of the last level played
  finished    boolean     not null default false,
  duration_s  integer     not null check (duration_s between 20 and 86400),
  client_id   uuid        not null,                                    -- random id per device, for rate limiting
  created_at  timestamptz not null default now()
);

create index if not exists scores_points_idx on public.scores (points desc, created_at);

-- Anyone may read the board and add a score; nobody may change or delete through the API.
alter table public.scores enable row level security;

drop policy if exists "read scores" on public.scores;
create policy "read scores" on public.scores for select to anon using (true);

drop policy if exists "add score" on public.scores;
create policy "add score" on public.scores for insert to anon
  with check (nickname ~ '^[[:alnum:] ._-]+$' and points <= 100 * 5 * (reached + 1));

-- Explicit access (works with "Automatically expose new tables" turned off).
-- client_id is only for the rate limit; don't expose it.
grant usage on schema public to anon;
grant usage on sequence public.scores_id_seq to anon;
revoke all on public.scores from anon, authenticated;
grant select (id, nickname, points, reached, finished, created_at) on public.scores to anon;
grant insert (nickname, points, reached, finished, duration_s, client_id) on public.scores to anon;

-- At most 5 scores per device per 10 minutes.
create or replace function public.scores_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.scores
      where client_id = new.client_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many scores, try again later';
  end if;
  return new;
end $$;

drop trigger if exists scores_rate_limit on public.scores;
create trigger scores_rate_limit before insert on public.scores
  for each row execute function public.scores_rate_limit();
