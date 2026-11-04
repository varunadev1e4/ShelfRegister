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
         case when status = 'lent' then 'lent' else 'shelf' end as status
  from public.items
  where hidden = false;

revoke all on public.public_items from anon, authenticated;
grant select on public.public_items to anon, authenticated;
