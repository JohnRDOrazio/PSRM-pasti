insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default) values
  ('Anno',   '10-01', '06-30', true,  true),
  ('Estate', '07-01', '09-30', false, false);

insert into settings (key, value) values
  ('lunch_cutoff',  '"10:00"'),
  ('dinner_cutoff', '"10:00"');
