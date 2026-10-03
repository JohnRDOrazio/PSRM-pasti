-- Deletes a person together with their whole history: meal choices, change log entries and
-- changes (undo changes belong to the same person, so undone_by never points outside the set).
-- One transaction: either everything goes or nothing does. Returns false if the person is unknown.
create function delete_person(p_id uuid) returns boolean language plpgsql as $$
begin
  delete from meal_choices where person_id = p_id;
  delete from change_entries where person_id = p_id or change_id in (select id from changes where person_id = p_id);
  delete from changes where person_id = p_id;
  delete from persons where id = p_id;
  return found;
end $$;

revoke execute on function delete_person(uuid) from public, anon, authenticated;
