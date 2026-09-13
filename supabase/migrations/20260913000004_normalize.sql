create or replace function normalize_meal_choices() returns int
language sql as $$
  with d as (
    delete from meal_choices mc
     where mc.present = season_default(mc.date, mc.meal)
    returning 1
  )
  select count(*)::int from d
$$;

revoke execute on all functions in schema public from anon, authenticated;
