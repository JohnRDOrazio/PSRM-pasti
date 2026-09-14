create extension if not exists pgcrypto;

create type meal_t as enum ('lunch', 'dinner');
create type actor_t as enum ('member', 'admin');
create type change_kind_t as enum ('toggle', 'interval', 'admin_edit', 'undo');

create table persons (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  group_name  text,
  notes       text,
  active      boolean not null default true,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table season_defaults (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  start_md       char(5),
  end_md         char(5),
  start_date     date,
  end_date       date,
  lunch_default  boolean not null,
  dinner_default boolean not null,
  check ((start_md is null) = (end_md is null)),
  check ((start_date is null) = (end_date is null)),
  check ((start_md is null) <> (start_date is null)),
  check (start_date is null or start_date <= end_date),
  check (start_md is null or (start_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' and end_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'))
);

create table settings (
  key   text primary key,
  value jsonb not null
);

create table changes (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id),
  actor         actor_t not null,
  actor_user_id uuid,
  kind          change_kind_t not null,
  start_date    date not null,
  start_meal    meal_t not null,
  end_date      date not null,
  end_meal      meal_t not null,
  state         boolean not null,
  created_at    timestamptz not null default now(),
  undone_by     uuid references changes(id)
);
create index changes_person_created_idx on changes (person_id, created_at desc);
create index changes_created_idx on changes (created_at desc);

create table meal_choices (
  person_id uuid not null references persons(id),
  date      date not null,
  meal      meal_t not null,
  present   boolean not null,
  change_id uuid not null references changes(id),
  primary key (person_id, date, meal)
);
create index meal_choices_date_idx on meal_choices (date);

create table change_entries (
  change_id    uuid not null references changes(id),
  person_id    uuid not null references persons(id),
  date         date not null,
  meal         meal_t not null,
  prev_present boolean,
  new_present  boolean,
  primary key (change_id, person_id, date, meal)
);
create index change_entries_cell_idx on change_entries (person_id, date, meal);

create table meal_guests (
  date       date not null,
  meal       meal_t not null,
  count      int not null check (count >= 0),
  note       text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (date, meal)
);

alter table persons         enable row level security;
alter table admins          enable row level security;
alter table season_defaults enable row level security;
alter table settings        enable row level security;
alter table changes         enable row level security;
alter table meal_choices    enable row level security;
alter table change_entries  enable row level security;
alter table meal_guests     enable row level security;

create or replace function meal_ord(m meal_t) returns int
language sql immutable as $$ select case when m = 'lunch' then 0 else 1 end $$;

-- Resolution: one-off row (narrowest) → recurring row (MM-DD, may wrap the year) → present.
create or replace function season_default(p_date date, p_meal meal_t) returns boolean
language sql stable as $$
  select coalesce(
    (select case when p_meal = 'lunch' then lunch_default else dinner_default end
       from season_defaults
      where start_date is not null and p_date between start_date and end_date
      order by (end_date - start_date) asc, start_date desc
      limit 1),
    (select case when p_meal = 'lunch' then lunch_default else dinner_default end
       from season_defaults
      where start_md is not null and (
        case when start_md <= end_md
             then to_char(p_date, 'MM-DD') between start_md and end_md
             else to_char(p_date, 'MM-DD') >= start_md or to_char(p_date, 'MM-DD') <= end_md
        end)
      order by start_md
      limit 1),
    true);
$$;

create or replace function is_locked(p_date date, p_meal meal_t, p_now timestamptz default now()) returns boolean
language plpgsql stable as $$
declare
  v_local  timestamp := p_now at time zone 'Europe/Rome';
  v_today  date := v_local::date;
  v_cutoff time;
begin
  select (value #>> '{}')::time into v_cutoff
    from settings
   where key = case when p_meal = 'lunch' then 'lunch_cutoff' else 'dinner_cutoff' end;
  if v_cutoff is null then v_cutoff := time '10:00'; end if;
  return p_date < v_today or (p_date = v_today and v_local::time >= v_cutoff);
end $$;

-- Every meal between (start_date, start_meal) and (end_date, end_meal), inclusive.
create or replace function interval_cells(p_start_date date, p_start_meal meal_t, p_end_date date, p_end_meal meal_t)
returns table (date date, meal meal_t)
language sql immutable as $$
  select d::date, m
    from generate_series(p_start_date, p_end_date, interval '1 day') d
   cross join unnest(enum_range(null::meal_t)) m
   where (d::date - date '1970-01-01') * 2 + meal_ord(m)
         between (p_start_date - date '1970-01-01') * 2 + meal_ord(p_start_meal)
             and (p_end_date   - date '1970-01-01') * 2 + meal_ord(p_end_meal)
   order by 1, meal_ord(m);
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
