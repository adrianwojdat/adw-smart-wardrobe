alter table public.outfits
  add column rationale text,
  add column wearing_tips text,
  add column missing_items jsonb not null default '[]'::jsonb;

alter table public.outfits
  add constraint outfits_rationale_length check (rationale is null or length(rationale) <= 500),
  add constraint outfits_wearing_tips_length check (wearing_tips is null or length(wearing_tips) <= 300),
  add constraint outfits_missing_items_shape check (
    jsonb_typeof(missing_items) = 'array' and jsonb_array_length(missing_items) <= 2
  );

grant insert(rationale,wearing_tips,missing_items) on public.outfits to authenticated;

create or replace function public.save_outfit(payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.outfits; gid uuid; w uuid; begin
  w=(payload->>'wardrobe_id')::uuid;
  if not public.has_wardrobe_access(w,true) then raise exception 'forbidden'; end if;
  insert into public.outfits(wardrobe_id,name,occasion,temperature,rationale,wearing_tips,missing_items)
  values(
    w,payload->>'name',payload->>'occasion',(payload->>'temperature')::numeric,
    nullif(payload->>'rationale',''),nullif(payload->>'wearing_tips',''),
    coalesce(payload->'missing_items','[]'::jsonb)
  ) returning * into o;
  for gid in select jsonb_array_elements_text(payload->'garment_ids')::uuid loop
    insert into public.outfit_garments(outfit_id,garment_id,wardrobe_id) values(o.id,gid,w);
  end loop;
  return to_jsonb(o)||jsonb_build_object('garment_ids',payload->'garment_ids');
end $$;
notify pgrst,'reload schema';
