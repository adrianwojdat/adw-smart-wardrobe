-- Historical pending proposal; not applied by project cleanup.
-- Inspect existing data and obtain approval before applying these constraints.
-- The privileged worker must never download an original path supplied for another object.
alter table public.garment_images add constraint original_path_matches_image check(original_path=path);
alter table public.garment_images add constraint original_mime_allowed check(original_mime in ('image/jpeg','image/png','image/webp'));
