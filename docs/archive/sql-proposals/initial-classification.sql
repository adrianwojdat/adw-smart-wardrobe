-- ARCHIVED DESIGN DRAFT — NOT A MIGRATION. DO NOT APPLY.
-- See docs/archive/README.md for its status and the authoritative migrations.
-- HISTORICAL PROPOSAL — DO NOT APPLY.
-- Superseded by narrowly scoped functions in migrations 0009, 0013 and 0014.
/*
-- Additive proposal; NOT applied. Worker may populate metadata only on untouched rows.
-- Existing naming trigger still prohibits overwriting a manually set name.
begin;
grant update(category,subcategory,primary_color,secondary_color) on public.garments to wardrobe_worker;
create policy worker_initial_classification on public.garments for update to wardrobe_worker
 using (updated_at=created_at)
 with check (true);
-- Application must lock the garment and require no earlier image analysis,
-- unchanged updated_at, and same image revision; update name only if temporary.
commit;

*/
