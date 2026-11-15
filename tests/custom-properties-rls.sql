-- Isolated RLS regression: run against a migrated local database.
-- All test users, wardrobes and garments are rolled back at the end.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('a1000000-0000-4000-8000-000000000001', 'custom-owner@example.invalid', 'test-only', '{}', '{}'),
  ('a1000000-0000-4000-8000-000000000002', 'custom-other@example.invalid', 'test-only', '{}', '{}');

insert into public.wardrobes(id, owner_id, name, kind) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'RLS custom owner', 'private'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'RLS custom other', 'private');
insert into public.garments(id, wardrobe_id, owner_id, name, category) values
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Owner test garment', 'tops'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'Other test garment', 'tops');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.garment_property_definitions(id, wardrobe_id, name, type)
values ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Własne pole', 'select');
insert into public.garment_property_options(id, property_id, wardrobe_id, label)
values ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Opcja');
insert into public.garment_property_values(garment_id, property_id, wardrobe_id, value)
values ('a3000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '"a5000000-0000-4000-8000-000000000001"');

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.garment_property_definitions) <> 0 then raise exception 'RLS leak: definitions'; end if;
  if (select count(*) from public.garment_property_options) <> 0 then raise exception 'RLS leak: options'; end if;
  if (select count(*) from public.garment_property_values) <> 0 then raise exception 'RLS leak: values'; end if;
  begin
    insert into public.garment_property_definitions(wardrobe_id, name, type)
    values ('a2000000-0000-4000-8000-000000000001', 'Forbidden', 'text');
    raise exception 'RLS failed to block cross-wardrobe write';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.garment_property_values(garment_id, property_id, wardrobe_id, value)
    values ('a3000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', '"x"');
    raise exception 'Composite FK failed to block cross-wardrobe value';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
