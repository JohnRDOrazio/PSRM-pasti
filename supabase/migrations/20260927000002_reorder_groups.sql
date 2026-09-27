-- Saves a whole new group order at once (drag and drop). Groups missing from p_ids (e.g. one
-- created meanwhile in another tab) keep their relative order after the listed ones; unknown ids
-- are ignored. Positions are renumbered 1..n.
create function reorder_groups(p_ids uuid[]) returns void language sql as $$
  with wanted as (
    select id, ord from unnest(p_ids) with ordinality as w(id, ord)
  ),
  ranked as (
    select g.id,
           row_number() over (order by (w.ord is null), w.ord, g.position, lower(g.name)) as pos
      from groups g
      left join wanted w on w.id = g.id
  )
  update groups g set position = r.pos from ranked r where g.id = r.id;
$$;

revoke execute on function reorder_groups(uuid[]) from public, anon, authenticated;
