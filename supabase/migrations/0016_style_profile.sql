-- Additive per-user style preferences. This migration is prepared but must be
-- applied explicitly using the project's migration process.
alter table public.profiles
  add column style_profile jsonb not null default '{"schema_version":1,"answers":{},"skipped":[]}'::jsonb;

alter table public.profiles
  add constraint profiles_style_profile_shape check (
    jsonb_typeof(style_profile) = 'object'
    and style_profile->>'schema_version' = '1'
    and jsonb_typeof(style_profile->'answers') = 'object'
    and jsonb_typeof(style_profile->'skipped') = 'array'
  );

grant select(style_profile) on public.profiles to authenticated;
grant update(style_profile) on public.profiles to authenticated;

create function public.merge_my_style_answers(p_answers jsonb, p_skipped text[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare result jsonb; current_profile jsonb; current_skipped text[]; next_skipped text[];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'answers must be a JSON object' using errcode = '22023';
  end if;

  select style_profile into current_profile
    from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(item.value), array[]::text[]) into current_skipped
    from jsonb_array_elements_text(coalesce(current_profile->'skipped', '[]'::jsonb)) as item(value);
  select coalesce(array_agg(distinct item.key order by item.key), array[]::text[]) into next_skipped
    from unnest(current_skipped || coalesce(p_skipped, array[]::text[])) as item(key)
   where not (p_answers ? item.key);

  update public.profiles
     set style_profile = jsonb_build_object(
           'schema_version', 1,
           'answers', (coalesce(current_profile->'answers', '{}'::jsonb) - coalesce(p_skipped, array[]::text[])) || p_answers,
           'skipped', to_jsonb(next_skipped)
         )
   where id = auth.uid()
   returning style_profile into result;

  if result is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.merge_my_style_answers(jsonb, text[]) from public;
grant execute on function public.merge_my_style_answers(jsonb, text[]) to authenticated;
notify pgrst, 'reload schema';
