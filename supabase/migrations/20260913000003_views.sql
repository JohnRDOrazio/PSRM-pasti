create view persons_overview with (security_invoker = false) as
  select p.*,
         (select max(c.created_at) from changes c where c.person_id = p.id) as last_change_at,
         (select count(*)::int from changes c where c.person_id = p.id)     as change_count
    from persons p;

revoke all on persons_overview from anon, authenticated;
