-- persons.notes becomes dietary_notes: editable by the member from their personal link and by the
-- admin; the kitchen page lists them per meal. There are no admin-private notes.
alter table persons rename column notes to dietary_notes;

-- persons_overview was created with `select p.*`, which Postgres expands at creation time, so the
-- view still names the column `notes`: recreate it. day_roster needs the new column in its return
-- type, which requires drop + recreate.
drop view persons_overview;
create view persons_overview with (security_invoker = false) as
  select p.*,
         (select max(c.created_at) from changes c where c.person_id = p.id) as last_change_at,
         (select count(*)::int from changes c where c.person_id = p.id)     as change_count
    from persons p;
revoke all on persons_overview from public, anon, authenticated;

drop function day_roster(date);
create function day_roster(p_date date)
returns table (person_id uuid, full_name text, group_name text, dietary_notes text,
               lunch_present boolean, lunch_explicit boolean,
               dinner_present boolean, dinner_explicit boolean)
language sql stable as $$
  select p.id, p.full_name, p.group_name, p.dietary_notes,
         coalesce(l.present,  season_default(p_date, 'lunch')),  l.present  is not null,
         coalesce(dn.present, season_default(p_date, 'dinner')), dn.present is not null
    from persons p
    left join meal_choices l  on l.person_id  = p.id and l.date  = p_date and l.meal  = 'lunch'
    left join meal_choices dn on dn.person_id = p.id and dn.date = p_date and dn.meal = 'dinner'
   where p.active
   order by p.group_name nulls last, p.full_name;
$$;
revoke execute on function day_roster(date) from public, anon, authenticated;
