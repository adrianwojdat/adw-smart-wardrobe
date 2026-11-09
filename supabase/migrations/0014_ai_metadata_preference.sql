-- Additive user preference and supported metadata; no mass analysis or data rewrite.
alter table public.profiles add column ai_overwrite_metadata boolean not null default false;
alter table public.garments add column pattern text not null default '' check(length(pattern)<=120);
grant update(ai_overwrite_metadata) on public.profiles to authenticated;
grant insert(pattern),update(pattern) on public.garments to authenticated;
create function private.ai_metadata_text(value jsonb) returns text language sql immutable set search_path='' as $$
 select case when jsonb_typeof(value)='string' and length(btrim(value#>>'{}')) between 1 and 120
 and lower(btrim(value#>>'{}')) not in ('unknown','null','none','nieznany','nieznana','nieznane','nieznany kolor','brak')
 then btrim(value#>>'{}') else null end
$$;
create function private.ai_metadata_array(value jsonb, allowed text[]) returns text[] language plpgsql immutable set search_path='' as $$
declare result text[];begin
 if jsonb_typeof(value) is distinct from 'array' then return null;end if;
 select array_agg(v) into result from jsonb_array_elements_text(value) v;
 if cardinality(result)>0 and cardinality(result)<=cardinality(allowed) and result<@allowed then return result;end if;
 return null;
end $$;
revoke all on function private.ai_metadata_text(jsonb),private.ai_metadata_array(jsonb,text[]) from public;
create function private.apply_ai_metadata(job_id uuid, suggestions jsonb, expected_updated timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.jobs; g public.garments; c public.garments; enabled boolean; patch jsonb; category text; heat integer;
begin
 select * into j from public.jobs where id=job_id and type='analyze_garment' and status='processing';
 if not found then return false;end if;
 select * into g from public.garments where id=j.garment_id and wardrobe_id=j.wardrobe_id for update;
 if not found or j.requested_by<>g.owner_id or g.updated_at is distinct from expected_updated then return false;end if;
 if not exists(select 1 from public.wardrobe_members where wardrobe_id=j.wardrobe_id and user_id=j.requested_by and role in ('owner','editor')) then return false;end if;
 select ai_overwrite_metadata into enabled from public.profiles where id=g.owner_id for share;
 if enabled is distinct from true then return false;end if;
 perform 1 from public.garment_images where id=j.image_id and garment_id=g.id and revision=j.revision and kind='garment' for share;
 if not found then return false;end if;
 category:=private.ai_metadata_text(suggestions->'category');
 if category is null or category not in ('tops','bottoms','dresses','outerwear','shoes','accessories') then category:=null;end if;
 if coalesce(category,g.category) not in ('accessories','shoes') and coalesce(suggestions->>'warmth','') ~ '^[1-5]$' then heat:=(suggestions->>'warmth')::integer;end if;
 patch:=jsonb_strip_nulls(jsonb_build_object(
  'category',category,
  'subcategory',private.ai_metadata_text(suggestions->'subcategory'),
  'primary_color',private.ai_metadata_text(suggestions->'primary_color'),
  'secondary_color',private.ai_metadata_text(suggestions->'secondary_color'),
  'pattern',private.ai_metadata_text(suggestions->'pattern'),
  'brand',private.ai_metadata_text(suggestions->'brand'),
  'style',private.ai_metadata_text(suggestions->'style'),
  'seasons',private.ai_metadata_array(suggestions->'seasons',array['spring','summer','autumn','winter']),
  'occasions',private.ai_metadata_array(suggestions->'occasions',array['office','everyday','date','evening','weekend','travel']),
  'thickness',case when suggestions->>'thickness' in ('thin','medium','thick') then suggestions->>'thickness' else null end,
  'warmth',heat,
  'warmth_manual',case when heat is not null then false else null end
 ));
 -- A temporary generated name may be completed; manual and existing AI names are untouched.
 if g.name_source='temporary' and private.ai_metadata_text(suggestions->'name') is not null then
  patch:=patch||jsonb_build_object('name',private.ai_metadata_text(suggestions->'name'),'name_source','ai');
 end if;
 if patch='{}'::jsonb then return false;end if;
 c:=jsonb_populate_record(g,patch);
 update public.garments set category=c.category,subcategory=c.subcategory,primary_color=c.primary_color,secondary_color=c.secondary_color,pattern=c.pattern,brand=c.brand,style=c.style,seasons=c.seasons,occasions=c.occasions,thickness=c.thickness,warmth=c.warmth,warmth_manual=c.warmth_manual,name=c.name,name_source=c.name_source where id=g.id;
 return true;
end $$;
revoke all on function private.apply_ai_metadata(uuid,jsonb,timestamptz) from public;
grant execute on function private.apply_ai_metadata(uuid,jsonb,timestamptz) to wardrobe_worker;
notify pgrst,'reload schema';
