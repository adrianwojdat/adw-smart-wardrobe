\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values ('a7500000-0000-4000-8000-000000000001','packing1@example.invalid','test','{}','{}'),
('a7500000-0000-4000-8000-000000000002','packing2@example.invalid','test','{}','{}');
insert into public.wardrobes(id,owner_id,name,kind) values
('a7510000-0000-4000-8000-000000000001','a7500000-0000-4000-8000-000000000001','Trip one','private'),
('a7510000-0000-4000-8000-000000000002','a7500000-0000-4000-8000-000000000002','Trip two','private');
insert into public.garments(id,wardrobe_id,owner_id,name,category) values
('a7520000-0000-4000-8000-000000000001','a7510000-0000-4000-8000-000000000001','a7500000-0000-4000-8000-000000000001','Own shirt','tops'),
('a7520000-0000-4000-8000-000000000002','a7510000-0000-4000-8000-000000000002','a7500000-0000-4000-8000-000000000002','Foreign shirt','tops');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a7500000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.packing_lists(id,wardrobe_id,name,trip,items) values
('a7530000-0000-4000-8000-000000000001','a7510000-0000-4000-8000-000000000001','Japan',
'{"wardrobe_id":"a7510000-0000-4000-8000-000000000001"}',
'[{"id":"row1","quantity":10,"packed":3,"match_wardrobe":true,"assigned":["a7520000-0000-4000-8000-000000000001"]}]');
do $$ begin
 if (select items->0->>'packed' from public.packing_lists limit 1) <> '3' then raise exception 'Progress not stored'; end if;
 begin
 update public.packing_lists set items=jsonb_set(items,'{0,assigned}','["a7520000-0000-4000-8000-000000000002"]');
 raise exception 'Foreign garment accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a7500000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.packing_lists) then raise exception 'Cross-user list read'; end if;
 if exists(select 1 from public.garments where id='a7520000-0000-4000-8000-000000000001') then raise exception 'Cross-user garment read'; end if;
 delete from public.packing_lists; get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Cross-user delete'; end if;
end $$;
reset role;
delete from public.garments where id='a7520000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a7500000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update public.packing_lists set items=jsonb_set(items,'{0,assigned}','[]');
do $$ begin
 if (select items->0->>'packed' from public.packing_lists limit 1) <> '3' then raise exception 'Deleted garment broke list'; end if;
end $$;
rollback;
