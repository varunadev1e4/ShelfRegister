-- Shelf Register: run this whole file once in Supabase > SQL Editor > New query > Run.

-- 1. The catalog table. One row per book or game.
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('book','game')),
  title        text not null,
  creator      text,                       -- author (books)
  lang         text,                       -- English / Telugu (books)
  cat          text,                       -- Dewey-style class (books) or game category
  loc          text,                       -- shelf code, e.g. A3
  isbn         text,
  read_status  text default 'unread',      -- unread / reading / read
  rating       int  default 0,
  notes        text,
  gtype        text,                       -- Board game / Card game
  pmin         int,
  pmax         int,
  mins         int,
  cx           text,                       -- Light / Medium / Heavy
  status       text not null default 'shelf' check (status in ('shelf','lent')),
  lent_to      text,
  lent_on      date,
  hidden       boolean not null default false,   -- true = friends cannot see it
  created_at   timestamptz not null default now()
);

create index if not exists items_owner_idx on public.items (owner_id);
create index if not exists items_title_idx on public.items (lower(title));

-- 2. Lock the table. Only the signed-in owner can read or change rows.
alter table public.items enable row level security;

drop policy if exists "owner full access" on public.items;
create policy "owner full access" on public.items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 3. What friends can see: a read-only view with safe columns only.
--    It leaves out notes, ISBN, reading status, who borrowed what, and hidden items.
drop view if exists public.public_items;
create view public.public_items with (security_invoker = false) as
  select id, kind, title, creator, lang, cat, loc, gtype, pmin, pmax, mins, cx,
         case when status = 'lent' then 'lent' else 'shelf' end as status,
         created_at
  from public.items
  where hidden = false;

revoke all on public.public_items from anon, authenticated;
grant select on public.public_items to anon, authenticated;


-- 4. Reading tracker (added later; safe to run again on an existing database).
alter table public.items add column if not exists pages        int;
alter table public.items add column if not exists current_page int  default 0;
alter table public.items add column if not exists started_on   date;
alter table public.items add column if not exists finished_on  date;
alter table public.items add column if not exists queued       boolean not null default false;  -- on the reading list
alter table public.items add column if not exists queue_pos    int;                              -- order on the reading list

-- One goal per year. A new year has no row yet, so the goal starts fresh every January 1
-- and earlier years stay on record.
create table if not exists public.reading_goals (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year     int  not null,
  target   int  not null check (target > 0),
  primary key (owner_id, year)
);

-- A small diary of reading days and pages, used for streaks and pace.
create table if not exists public.reading_log (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id    uuid references public.items(id) on delete cascade,
  log_date   date not null default current_date,
  pages      int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reading_log_owner_idx on public.reading_log (owner_id, log_date);

alter table public.reading_goals enable row level security;
alter table public.reading_log   enable row level security;

drop policy if exists "owner full access" on public.reading_goals;
create policy "owner full access" on public.reading_goals
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner full access" on public.reading_log;
create policy "owner full access" on public.reading_log
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());


-- 5. Second round: Telugu spellings, covers, series, picks, due dates, quotes, trash,
--    friends, loan history, borrow requests, backup date. Safe to run again.
alter table public.items add column if not exists title_en   text;       -- English spelling of a Telugu title
alter table public.items add column if not exists creator_en text;       -- English spelling of a Telugu author
alter table public.items add column if not exists cover_url  text;
alter table public.items add column if not exists series     text;
alter table public.items add column if not exists series_no  numeric;
alter table public.items add column if not exists pick       boolean not null default false;   -- shown on the friends "Picks" tab
alter table public.items add column if not exists pick_note  text;
alter table public.items add column if not exists due_on     date;
alter table public.items add column if not exists quotes     jsonb not null default '[]'::jsonb;
alter table public.items add column if not exists deleted_at timestamptz;                       -- set = in the trash

-- Friends see more fields now, but still never notes, ISBN, reading data, or who has a book.
drop view if exists public.public_items;
create view public.public_items with (security_invoker = false) as
  select id, kind, title, title_en, creator, creator_en, lang, cat, loc, gtype, pmin, pmax, mins, cx,
         case when status = 'lent' then 'lent' else 'shelf' end as status,
         cover_url, series, series_no, pick,
         case when pick then pick_note end as pick_note,
         created_at
  from public.items
  where hidden = false and deleted_at is null;
revoke all on public.public_items from anon, authenticated;
grant select on public.public_items to anon, authenticated;

create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  note       text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);
create table if not exists public.loans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid references public.items(id) on delete cascade,
  friend_name text not null,
  lent_on     date not null default current_date,
  due_on      date,
  returned_on date,
  created_at  timestamptz not null default now()
);
create index if not exists loans_owner_idx on public.loans (owner_id, lent_on);
create table if not exists public.settings (
  owner_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  last_backup date
);
create table if not exists public.borrow_requests (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null,
  item_id        uuid not null references public.items(id) on delete cascade,
  item_title     text,
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  contact        text not null check (char_length(contact) between 3 and 120),
  message        text check (message is null or char_length(message) <= 500),
  status         text not null default 'new' check (status in ('new','done','declined')),
  created_at     timestamptz not null default now()
);
create index if not exists borrow_requests_owner_idx on public.borrow_requests (owner_id, created_at);

alter table public.friends         enable row level security;
alter table public.loans           enable row level security;
alter table public.settings        enable row level security;
alter table public.borrow_requests enable row level security;

drop policy if exists "owner full access" on public.friends;
create policy "owner full access" on public.friends for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.loans;
create policy "owner full access" on public.loans for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.settings;
create policy "owner full access" on public.settings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.borrow_requests;
create policy "owner full access" on public.borrow_requests for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Anyone may ADD a request, nothing else. They cannot read, change or delete requests.
drop policy if exists "anyone can request" on public.borrow_requests;
create policy "anyone can request" on public.borrow_requests for insert to anon, authenticated with check (status = 'new');
revoke all on public.borrow_requests from anon;
grant insert (item_id, requester_name, contact, message) on public.borrow_requests to anon;

-- Spam guard. Fills in the owner and the real title, and refuses requests for items that are hidden
-- or deleted, floods (30 an hour overall), repeats (5 a day per contact) and the same item twice in a day.
create or replace function public.check_borrow_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid; t text;
begin
  select owner_id, title into o, t from public.items where id = new.item_id and hidden = false and deleted_at is null;
  if o is null then raise exception 'That item is not available to request.'; end if;
  new.owner_id := o; new.item_title := t; new.status := 'new';
  if (select count(*) from public.borrow_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many requests right now. Please try again later.'; end if;
  if (select count(*) from public.borrow_requests where lower(contact) = lower(new.contact) and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several requests today. Please try again tomorrow.'; end if;
  if exists (select 1 from public.borrow_requests where item_id = new.item_id and lower(contact) = lower(new.contact) and created_at > now() - interval '1 day') then
    raise exception 'You already asked for this one today.'; end if;
  return new;
end $$;
drop trigger if exists borrow_request_guard on public.borrow_requests;
create trigger borrow_request_guard before insert on public.borrow_requests for each row execute function public.check_borrow_request();
