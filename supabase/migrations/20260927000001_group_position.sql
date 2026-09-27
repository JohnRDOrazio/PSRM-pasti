-- Groups get an admin-defined order, used by the persons list, the group pickers and the kitchen.
-- Existing groups start in reverse alphabetical order (Seminaristi, Presbiterio, Ospiti…).
alter table groups add column position int;
update groups g set position = o.ord
  from (select id, row_number() over (order by lower(name) desc) as ord from groups) o
 where g.id = o.id;
alter table groups alter column position set not null;

-- New groups go to the end.
create function groups_set_position() returns trigger language plpgsql as $$
begin
  if new.position is null then
    select coalesce(max(position), 0) + 1 into new.position from groups;
  end if;
  return new;
end $$;
create trigger groups_set_position before insert on groups
  for each row execute function groups_set_position();

-- Swaps a group with its neighbour (p_delta < 0: up, > 0: down) and renumbers 1..n in one go.
create function move_group(p_id uuid, p_delta int) returns void language plpgsql as $$
declare
  ids uuid[];
  i int;
  j int;
begin
  select array_agg(id order by position, lower(name)) into ids from groups;
  i := array_position(ids, p_id);
  if i is null or p_delta = 0 then return; end if;
  j := i + sign(p_delta)::int;
  if j < 1 or j > cardinality(ids) then return; end if;
  ids[i] := ids[j];
  ids[j] := p_id;
  update groups g set position = o.ord from unnest(ids) with ordinality as o(id, ord) where g.id = o.id;
end $$;

create or replace view groups_overview with (security_invoker = false) as
  select g.id, g.name, g.created_at,
         (select count(*)::int from persons p where p.group_id = g.id) as member_count,
         g.position
    from groups g;

create or replace function day_roster(p_date date)
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
   order by g.position nulls last, p.full_name;
$$;

revoke execute on function move_group(uuid, int), groups_set_position() from public, anon, authenticated;
revoke all on groups_overview from public, anon, authenticated;
