insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default)
  select 'Anno', '10-01', '06-30', true, true
  where not exists (select 1 from season_defaults where label = 'Anno');

insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default)
  select 'Estate', '07-01', '09-30', false, false
  where not exists (select 1 from season_defaults where label = 'Estate');

insert into settings (key, value) values
  ('lunch_cutoff',  '"10:00"'),
  ('dinner_cutoff', '"10:00"')
on conflict (key) do nothing;
