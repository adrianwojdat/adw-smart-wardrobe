-- Bulk retry uses client-generated stable UUIDs. Existing RLS still verifies
-- wardrobe membership and garment ownership; no update/delete grants added.
grant insert(id) on public.garments to authenticated;
grant insert(id) on public.garment_images to authenticated;
notify pgrst, 'reload schema';
