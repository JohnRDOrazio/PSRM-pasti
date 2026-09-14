-- 1. Monotonic ordering for changes: created_at comes from the caller/transaction start,
--    so a transaction that waited on the per-person advisory lock can commit *after* one
--    with a later created_at. `seq` is assigned at insert time (after the lock), so it
--    reflects commit order. created_at stays for cutoff/undo-age logic.
alter table changes add column seq bigserial;
create index changes_seq_idx on changes (person_id, seq desc);

-- 2. Recurring seasons: reject impossible month-days (02-31, 04-31); leap-year reference allows 02-29.
create or replace function is_valid_md(md char(5)) returns boolean
language plpgsql immutable as $$
begin
  if md !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then return false; end if;
  perform to_date('2024-' || md, 'YYYY-MM-DD');
  return true;
exception when others then
  return false;
end $$;

alter table season_defaults
  add constraint season_defaults_md_valid
  check (start_md is null or (is_valid_md(start_md) and is_valid_md(end_md)));

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
  -- A later change (by commit order, not wall clock) touching any of these cells blocks the undo.
  if exists (
    select 1
      from change_entries e
      join changes c on c.id = e.change_id
     where e.person_id = p_person
       and c.seq > v_orig.seq
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

revoke execute on all functions in schema public from public, anon, authenticated;
