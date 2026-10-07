-- Seasons of the same kind may nest (a shorter season inside a longer one is an exception to it)
-- or be disjoint, but may not partly overlap or cover exactly the same days. That keeps resolution
-- unambiguous: on any date the covering seasons form a chain, and the innermost (shortest) wins.
-- One-off and recurring seasons are not checked against each other: a one-off always wins.

-- Day of year of an 'MM-DD' in a leap year (02-29 = 60, 12-31 = 366).
create or replace function md_doy(md char(5)) returns int
language sql immutable as $$ select extract(doy from ('2024-' || md)::date)::int $$;

-- Days of the year covered by a recurring season; a season that wraps the year is two pieces.
create or replace function md_span(p_start char(5), p_end char(5)) returns int4multirange
language sql immutable as $$
  select case when p_start <= p_end
              then int4multirange(int4range(md_doy(p_start), md_doy(p_end), '[]'))
              else int4multirange(int4range(md_doy(p_start), 366, '[]'), int4range(1, md_doy(p_end), '[]'))
         end
$$;

-- Number of days a recurring season covers (leap-year count).
create or replace function md_len(p_start char(5), p_end char(5)) returns int
language sql immutable as $$
  select case when p_start <= p_end
              then md_doy(p_end) - md_doy(p_start) + 1
              else 366 - md_doy(p_start) + 1 + md_doy(p_end)
         end
$$;

create or replace function season_defaults_check_nesting() returns trigger
language plpgsql as $$
declare
  v_conflict text;
begin
  -- Serialize season writes so two concurrent saves cannot each miss the other's row.
  perform pg_advisory_xact_lock(hashtext('season_defaults'));

  -- Impossible month-days are left to the season_defaults_md_valid check, which runs after us.
  if new.start_md is not null and not (is_valid_md(new.start_md) and is_valid_md(new.end_md)) then
    return new;
  end if;

  if new.start_md is not null then
    select s.label into v_conflict
      from season_defaults s,
           lateral (select md_span(new.start_md, new.end_md) as a, md_span(s.start_md, s.end_md) as b) r
     where s.id <> new.id and s.start_md is not null
       and r.a && r.b and (r.a = r.b or not (r.a @> r.b or r.b @> r.a))
     limit 1;
  else
    select s.label into v_conflict
      from season_defaults s,
           lateral (select daterange(new.start_date, new.end_date, '[]') as a,
                           daterange(s.start_date, s.end_date, '[]') as b) r
     where s.id <> new.id and s.start_date is not null
       and r.a && r.b and (r.a = r.b or not (r.a @> r.b or r.b @> r.a))
     limit 1;
  end if;

  if v_conflict is not null then
    raise exception 'season_overlap' using errcode = '23P01', detail = v_conflict;
  end if;
  return new;
end $$;

create trigger season_defaults_nesting
  before insert or update on season_defaults
  for each row execute function season_defaults_check_nesting();

-- Same resolution as before, except that among recurring seasons the shortest (innermost) wins.
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
      order by md_len(start_md, end_md) asc
      limit 1),
    true);
$$;

revoke execute on function md_doy(char), md_span(char, char), md_len(char, char),
  season_defaults_check_nesting(), season_default(date, meal_t) from public, anon, authenticated;
