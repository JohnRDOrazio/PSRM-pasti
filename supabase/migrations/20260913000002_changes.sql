create or replace function effective_presence(p_person uuid, p_from date, p_to date)
returns table (date date, meal meal_t, present boolean, explicit boolean, default_present boolean)
language sql stable as $$
  select d::date,
         m,
         coalesce(mc.present, season_default(d::date, m)),
         mc.present is not null,
         season_default(d::date, m)
    from generate_series(p_from, p_to, interval '1 day') d
   cross join unnest(enum_range(null::meal_t)) m
    left join meal_choices mc on mc.person_id = p_person and mc.date = d::date and mc.meal = m
   order by 1, meal_ord(m);
$$;

create or replace function day_roster(p_date date)
returns table (person_id uuid, full_name text, group_name text,
               lunch_present boolean, lunch_explicit boolean,
               dinner_present boolean, dinner_explicit boolean)
language sql stable as $$
  select p.id, p.full_name, p.group_name,
         coalesce(l.present,  season_default(p_date, 'lunch')),  l.present  is not null,
         coalesce(dn.present, season_default(p_date, 'dinner')), dn.present is not null
    from persons p
    left join meal_choices l  on l.person_id  = p.id and l.date  = p_date and l.meal  = 'lunch'
    left join meal_choices dn on dn.person_id = p.id and dn.date = p_date and dn.meal = 'dinner'
   where p.active
   order by p.group_name nulls last, p.full_name;
$$;

-- One transaction: validate, lock-check (members only), log entries, upsert/delete exception rows.
create or replace function apply_change(
  p_person uuid, p_actor actor_t, p_actor_user uuid, p_kind change_kind_t,
  p_start_date date, p_start_meal meal_t, p_end_date date, p_end_meal meal_t,
  p_state boolean, p_now timestamptz default now()
) returns jsonb
language plpgsql as $$
declare
  v_start_key  int := (p_start_date - date '1970-01-01') * 2 + meal_ord(p_start_meal);
  v_end_key    int := (p_end_date   - date '1970-01-01') * 2 + meal_ord(p_end_meal);
  v_change     uuid;
  v_locked     jsonb;
  v_overwritten jsonb;
  v_new        boolean;
  r            record;
begin
  if v_end_key < v_start_key then
    return jsonb_build_object('error', 'invalid_interval');
  end if;
  if v_end_key - v_start_key + 1 > 800 then
    return jsonb_build_object('error', 'too_long');
  end if;
  if p_kind = 'undo' then
    return jsonb_build_object('error', 'invalid_kind');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_person::text));

  if p_actor = 'member' then
    select jsonb_agg(jsonb_build_object('date', c.date, 'meal', c.meal) order by c.date, meal_ord(c.meal))
      into v_locked
      from interval_cells(p_start_date, p_start_meal, p_end_date, p_end_meal) c
     where is_locked(c.date, c.meal, p_now);
    if v_locked is not null then
      return jsonb_build_object('error', 'locked', 'locked', v_locked);
    end if;
  end if;

  insert into changes (person_id, actor, actor_user_id, kind, start_date, start_meal, end_date, end_meal, state, created_at)
  values (p_person, p_actor, p_actor_user, p_kind, p_start_date, p_start_meal, p_end_date, p_end_meal, p_state, p_now)
  returning id into v_change;

  for r in
    select c.date, c.meal, mc.present as explicit_present, season_default(c.date, c.meal) as def
      from interval_cells(p_start_date, p_start_meal, p_end_date, p_end_meal) c
      left join meal_choices mc on mc.person_id = p_person and mc.date = c.date and mc.meal = c.meal
     order by c.date, meal_ord(c.meal)
  loop
    if coalesce(r.explicit_present, r.def) = p_state then
      continue;
    end if;
    v_new := case when p_state = r.def then null else p_state end;

    insert into change_entries (change_id, person_id, date, meal, prev_present, new_present)
    values (v_change, p_person, r.date, r.meal, r.explicit_present, v_new);

    if v_new is null then
      delete from meal_choices where person_id = p_person and date = r.date and meal = r.meal;
    else
      insert into meal_choices (person_id, date, meal, present, change_id)
      values (p_person, r.date, r.meal, v_new, v_change)
      on conflict (person_id, date, meal) do update set present = excluded.present, change_id = excluded.change_id;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'meal', meal, 'prev_present', prev_present)
                            order by date, meal_ord(meal)), '[]'::jsonb)
    into v_overwritten
    from change_entries
   where change_id = v_change and prev_present is not null;

  return jsonb_build_object('change_id', v_change, 'overwritten', v_overwritten);
end $$;

create or replace function undo_change(p_change uuid, p_person uuid, p_now timestamptz default now())
returns jsonb
language plpgsql as $$
declare
  v_orig changes%rowtype;
  v_undo uuid;
  r      record;
begin
  perform pg_advisory_xact_lock(hashtext(p_person::text));

  select * into v_orig from changes where id = p_change and person_id = p_person for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_orig.undone_by is not null then return jsonb_build_object('error', 'already_undone'); end if;
  if v_orig.kind = 'undo' or v_orig.actor <> 'member' then return jsonb_build_object('error', 'not_undoable'); end if;
  if p_now - v_orig.created_at > interval '24 hours' then return jsonb_build_object('error', 'too_old'); end if;
  if v_orig.actor = 'member' and exists (
    select 1 from change_entries e where e.change_id = p_change and is_locked(e.date, e.meal, p_now)
  ) then
    return jsonb_build_object('error', 'locked');
  end if;
  if exists (
    select 1
      from change_entries e
      join changes c on c.id = e.change_id
     where e.person_id = p_person
       and c.created_at > v_orig.created_at
       and (e.date, e.meal) in (select date, meal from change_entries where change_id = p_change)
  ) then
    return jsonb_build_object('error', 'superseded');
  end if;

  insert into changes (person_id, actor, actor_user_id, kind, start_date, start_meal, end_date, end_meal, state, created_at)
  values (p_person, v_orig.actor, v_orig.actor_user_id, 'undo',
          v_orig.start_date, v_orig.start_meal, v_orig.end_date, v_orig.end_meal, not v_orig.state, p_now)
  returning id into v_undo;

  for r in select * from change_entries where change_id = p_change loop
    insert into change_entries (change_id, person_id, date, meal, prev_present, new_present)
    values (v_undo, p_person, r.date, r.meal, r.new_present, r.prev_present);
    if r.prev_present is null then
      delete from meal_choices where person_id = p_person and date = r.date and meal = r.meal;
    else
      insert into meal_choices (person_id, date, meal, present, change_id)
      values (p_person, r.date, r.meal, r.prev_present, v_undo)
      on conflict (person_id, date, meal) do update set present = excluded.present, change_id = excluded.change_id;
    end if;
  end loop;

  update changes set undone_by = v_undo where id = p_change;
  return jsonb_build_object('change_id', v_undo);
end $$;

revoke execute on all functions in schema public from anon, authenticated;
