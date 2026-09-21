-- Groups become a table managed by the admin; persons.group_name (free text) is replaced by
-- persons.group_id. Existing names are kept: one group per distinct value.
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
create unique index groups_name_key on groups (lower(name));
alter table groups enable row level security;

insert into groups (name)
  select distinct group_name from persons where group_name is not null;

alter table persons add column group_id uuid references groups(id) on delete restrict;
update persons p set group_id = g.id from groups g where g.name = p.group_name;
create index persons_group_id_idx on persons (group_id);

-- Views and functions keep exposing group_name, now through the join. persons_overview depends
-- on the old column, so it goes first.
drop view persons_overview;
alter table persons drop column group_name;
create view persons_overview with (security_invoker = false) as
  select p.*,
         g.name as group_name,
         (select max(c.created_at) from changes c where c.person_id = p.id) as last_change_at,
         (select count(*)::int from changes c where c.person_id = p.id)     as change_count
    from persons p
    left join groups g on g.id = p.group_id;

create view groups_overview with (security_invoker = false) as
  select g.id, g.name, g.created_at,
         (select count(*)::int from persons p where p.group_id = g.id) as member_count
    from groups g;

drop function day_roster(date);
create function day_roster(p_date date)
returns table (person_id uuid, full_name text, group_name text, dietary_notes text,
               lunch_present boolean, lunch_explicit boolean,
               dinner_present boolean, dinner_explicit boolean)
language sql stable as $$
  select p.id, p.full_name, g.name, p.dietary_notes,
         coalesce(l.present,  season_default(p_date, 'lunch')),  l.present  is not null,
         coalesce(dn.present, season_default(p_date, 'dinner')), dn.present is not null
    from persons p
    left join groups g on g.id = p.group_id
    left join meal_choices l  on l.person_id  = p.id and l.date  = p_date and l.meal  = 'lunch'
    left join meal_choices dn on dn.person_id = p.id and dn.date = p_date and dn.meal = 'dinner'
   where p.active
   order by g.name nulls last, p.full_name;
$$;

revoke all on groups, groups_overview, persons_overview from public, anon, authenticated;
revoke execute on function day_roster(date) from public, anon, authenticated;
