-- Keep the task/profile row independent from the garment aggregation.
create or replace function private.load_gemini_outfit_context(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare context jsonb;
begin
  if session_user <> 'wardrobe_worker' then raise exception 'worker role required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'request',t.request,
    'profile',coalesce(p.style_profile,'{"schema_version":1,"answers":{},"skipped":[]}'::jsonb),
    'garments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'name',g.name,'category',g.category,'subcategory',g.subcategory,
        'primary_color',g.primary_color,'secondary_color',g.secondary_color,'material',g.material,
        'seasons',g.seasons,'warmth',g.warmth,'thickness',g.thickness,'style',g.style,
        'pattern',g.pattern,'occasions',g.occasions
      ) order by g.created_at desc)
      from public.garments g
      where g.wardrobe_id=m.wardrobe_id and g.cleanliness='clean' and not g.archived
    ),'[]'::jsonb)
  ) into context
  from public.gemini_tasks t
  join public.wardrobe_members m on m.user_id=t.user_id and m.wardrobe_id=(t.request->>'wardrobe_id')::uuid
  join public.profiles p on p.id=t.user_id
  where t.id=p_task_id and t.kind='outfit_recommendation';
  if context is null then raise exception 'authorized task context not found' using errcode = 'P0002'; end if;
  return context;
end $$;
revoke all on function private.load_gemini_outfit_context(uuid) from public,anon,authenticated,service_role;
grant execute on function private.load_gemini_outfit_context(uuid) to wardrobe_worker;
