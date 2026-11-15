-- Run after migrations 0001 and 0024 on a disposable/local test database.
-- Fixtures are transaction-local and always rolled back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values ('a7400000-0000-4000-8000-000000000001','saved-outfit@example.invalid','test-only','{}','{}');
insert into public.wardrobes(id,owner_id,name,kind)
values ('a7410000-0000-4000-8000-000000000001','a7400000-0000-4000-8000-000000000001','Outfit fixture','private');
insert into public.garments(id,wardrobe_id,owner_id,name,category)
values ('a7420000-0000-4000-8000-000000000001','a7410000-0000-4000-8000-000000000001','a7400000-0000-4000-8000-000000000001','Marynarka testowa','outerwear');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a7400000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare saved jsonb; begin
  saved := public.save_outfit('{"wardrobe_id":"a7410000-0000-4000-8000-000000000001","name":"Smart casual","occasion":"office","temperature":18,"garment_ids":["a7420000-0000-4000-8000-000000000001"],"rationale":"Granatowa marynarka pasuje do biura.","wearing_tips":"Podwiń rękawy.","missing_items":[{"category":"shoes","description":"Brązowe loafersy"}]}'::jsonb);
  if saved->>'rationale' <> 'Granatowa marynarka pasuje do biura.' then raise exception 'Outfit rationale was not persisted'; end if;
  if saved->>'wearing_tips' <> 'Podwiń rękawy.' then raise exception 'Outfit wearing tips were not persisted'; end if;
  if jsonb_array_length(saved->'missing_items') <> 1 then raise exception 'Missing outfit items were not persisted'; end if;
  if jsonb_array_length(saved->'garment_ids') <> 1 then raise exception 'Outfit garment IDs changed'; end if;
end $$;
rollback;
