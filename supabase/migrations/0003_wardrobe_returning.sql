-- INSERT ... RETURNING is checked before the AFTER INSERT membership trigger.
-- Owners must be able to read their new row during this statement.
drop policy wardrobes_read on public.wardrobes;
create policy wardrobes_read on public.wardrobes for select to authenticated using(owner_id=auth.uid() or public.has_wardrobe_access(id));
notify pgrst,'reload schema';
