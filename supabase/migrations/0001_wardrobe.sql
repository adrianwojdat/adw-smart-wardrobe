create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.sessions (
 id_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 tokens text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index sessions_expiry on private.sessions(expires_at);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text not null default '', created_at timestamptz not null default now());
create table public.wardrobes (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id), name text not null check(length(name) between 1 and 120), kind text not null default 'private' check(kind in ('private','family')), created_at timestamptz not null default now());
create table public.wardrobe_members (wardrobe_id uuid not null references public.wardrobes(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('owner','editor','viewer')), created_at timestamptz not null default now(), primary key(wardrobe_id,user_id));
create index members_user on public.wardrobe_members(user_id);
create function public.has_wardrobe_access(w uuid, editing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.wardrobe_members where wardrobe_id=w and user_id=auth.uid() and (not editing or role in ('owner','editor')))
$$;
create function public.owns_wardrobe(w uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.wardrobes where id=w and owner_id=auth.uid()) $$;
create function public.on_wardrobe_created() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.wardrobe_members(wardrobe_id,user_id,role) values(new.id,new.owner_id,'owner'); return new; end $$;
create trigger wardrobe_created after insert on public.wardrobes for each row execute function public.on_wardrobe_created();
create function public.on_user_created() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name','')); return new; end $$;
create trigger user_created after insert on auth.users for each row execute function public.on_user_created();
create table public.garments (
 id uuid primary key default gen_random_uuid(), wardrobe_id uuid not null references public.wardrobes(id) on delete cascade, owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(name) between 1 and 120), category text not null check(category in ('tops','bottoms','dresses','outerwear','shoes','accessories')),
 subcategory text not null default '',brand text not null default '',size text not null default '',primary_color text not null default '',secondary_color text not null default '',
 material text not null default '' check(length(material)<=1000), material_source text not null default 'unknown' check(material_source in ('user','label','unknown')),
 seasons text[] not null default '{}' check(seasons <@ array['spring','summer','autumn','winter']), warmth int not null default 3 check(warmth between 1 and 5), thickness text not null default 'medium' check(thickness in ('thin','medium','thick')),
 style text not null default '', occasions text[] not null default '{}' check(occasions <@ array['office','everyday','date','evening','weekend','travel']),
 cleanliness text not null default 'clean' check(cleanliness in ('clean','worn','dirty','washing','drying','ironing')), favorite boolean not null default false, archived boolean not null default false, notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,wardrobe_id)
);
create index garments_wardrobe on public.garments(wardrobe_id,archived,created_at desc);
create index garments_category on public.garments(wardrobe_id,category);
create index garments_search on public.garments using gin(to_tsvector('simple',name||' '||brand));
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger garments_updated before update on public.garments for each row execute function public.touch_updated_at();
create table public.garment_images (id uuid primary key default gen_random_uuid(), garment_id uuid not null, wardrobe_id uuid not null, path text not null unique, kind text not null default 'garment' check(kind in ('garment','label')), width int not null check(width>0), height int not null check(height>0), created_at timestamptz not null default now(), foreign key(garment_id,wardrobe_id) references public.garments(id,wardrobe_id) on delete cascade);
create index images_garment on public.garment_images(garment_id);
create table public.jobs (id uuid primary key default gen_random_uuid(), wardrobe_id uuid not null references public.wardrobes(id) on delete cascade, garment_id uuid not null references public.garments(id) on delete cascade, image_id uuid not null references public.garment_images(id) on delete cascade, requested_by uuid not null default auth.uid() references auth.users(id), type text not null check(type='process_image'), status text not null default 'queued' check(status in ('queued','processing','completed','failed')), progress int not null default 0 check(progress between 0 and 100), attempts int not null default 0, error text, result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index jobs_dispatch on public.jobs(status,updated_at);
create trigger jobs_updated before update on public.jobs for each row execute function public.touch_updated_at();
create table public.invitations (id uuid primary key default gen_random_uuid(),wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,email text not null,role text not null check(role in ('editor','viewer')),token_hash text not null unique,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now());
create function public.accept_invitation(token text) returns uuid language plpgsql security definer set search_path='' as $$ declare inv public.invitations; begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select * into inv from public.invitations where token_hash=token and expires_at>now() and lower(email)=lower(auth.jwt()->>'email') for update;
 if inv.id is null then raise exception 'invalid invitation'; end if;
 insert into public.wardrobe_members(wardrobe_id,user_id,role) values(inv.wardrobe_id,auth.uid(),inv.role) on conflict do nothing;
 delete from public.invitations where id=inv.id; return inv.wardrobe_id;
 end $$;
create table public.outfits (id uuid primary key default gen_random_uuid(),wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,created_by uuid not null default auth.uid() references auth.users(id),name text not null check(length(name) between 1 and 120),occasion text not null,temperature numeric,created_at timestamptz not null default now(),unique(id,wardrobe_id));
create table public.outfit_garments(outfit_id uuid not null,garment_id uuid not null,wardrobe_id uuid not null,primary key(outfit_id,garment_id),foreign key(outfit_id,wardrobe_id) references public.outfits(id,wardrobe_id) on delete cascade,foreign key(garment_id,wardrobe_id) references public.garments(id,wardrobe_id) on delete cascade);
create table public.wear_history(id uuid primary key default gen_random_uuid(),wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,garment_id uuid not null, user_id uuid not null default auth.uid() references auth.users(id), worn_on date not null default current_date,created_at timestamptz not null default now(),foreign key(garment_id,wardrobe_id) references public.garments(id,wardrobe_id) on delete cascade,unique(garment_id,user_id,worn_on));
create index wear_history_garment on public.wear_history(garment_id,worn_on desc);
-- All exposed data is protected, including relation embedding via PostgREST.
alter table public.profiles enable row level security;
alter table public.wardrobes enable row level security;
alter table public.wardrobe_members enable row level security;
alter table public.garments enable row level security;
alter table public.garment_images enable row level security;
alter table public.jobs enable row level security;
alter table public.invitations enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_garments enable row level security;
alter table public.wear_history enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy wardrobes_read on public.wardrobes for select to authenticated using(public.has_wardrobe_access(id));
create policy wardrobes_insert on public.wardrobes for insert to authenticated with check(owner_id=auth.uid());
create policy wardrobes_update on public.wardrobes for update to authenticated using(public.owns_wardrobe(id)) with check(owner_id=auth.uid());
create policy wardrobes_delete on public.wardrobes for delete to authenticated using(public.owns_wardrobe(id));
create policy members_read on public.wardrobe_members for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy members_update on public.wardrobe_members for update to authenticated using(public.owns_wardrobe(wardrobe_id) and role<>'owner') with check(public.owns_wardrobe(wardrobe_id) and role in ('editor','viewer'));
create policy members_delete on public.wardrobe_members for delete to authenticated using(public.owns_wardrobe(wardrobe_id) and role<>'owner');
create policy garments_read on public.garments for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy garments_insert on public.garments for insert to authenticated with check(public.has_wardrobe_access(wardrobe_id,true) and owner_id=auth.uid());
create policy garments_update on public.garments for update to authenticated using(public.has_wardrobe_access(wardrobe_id,true)) with check(public.has_wardrobe_access(wardrobe_id,true));
create policy garments_delete on public.garments for delete to authenticated using(public.has_wardrobe_access(wardrobe_id,true));
create policy images_read on public.garment_images for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy images_insert on public.garment_images for insert to authenticated with check(public.has_wardrobe_access(wardrobe_id,true) and split_part(path,'/',1)=wardrobe_id::text and split_part(path,'/',2)=garment_id::text);
create policy images_delete on public.garment_images for delete to authenticated using(public.has_wardrobe_access(wardrobe_id,true));
create policy jobs_read on public.jobs for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy jobs_insert on public.jobs for insert to authenticated with check(public.has_wardrobe_access(wardrobe_id,true) and requested_by=auth.uid() and status='queued' and exists(select 1 from public.garment_images i where i.id=image_id and i.garment_id=jobs.garment_id and i.wardrobe_id=jobs.wardrobe_id));
create policy invitations_owner on public.invitations for all to authenticated using(public.owns_wardrobe(wardrobe_id)) with check(public.owns_wardrobe(wardrobe_id) and exists(select 1 from public.wardrobes where id=wardrobe_id and kind='family'));
create policy outfits_read on public.outfits for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy outfits_write on public.outfits for all to authenticated using(public.has_wardrobe_access(wardrobe_id,true)) with check(public.has_wardrobe_access(wardrobe_id,true) and created_by=auth.uid());
create policy outfit_items_read on public.outfit_garments for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy outfit_items_write on public.outfit_garments for all to authenticated using(public.has_wardrobe_access(wardrobe_id,true)) with check(public.has_wardrobe_access(wardrobe_id,true));
create policy wear_read on public.wear_history for select to authenticated using(public.has_wardrobe_access(wardrobe_id));
create policy wear_insert on public.wear_history for insert to authenticated with check(public.has_wardrobe_access(wardrobe_id,true) and user_id=auth.uid());
-- Explicit column permissions prevent ownership transfer and timestamp tampering.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.wardrobes,public.wardrobe_members,public.garments,public.garment_images,public.jobs,public.invitations,public.outfits,public.outfit_garments,public.wear_history to authenticated;
grant update(name) on public.profiles to authenticated;
grant insert(name,kind),update(name,kind),delete on public.wardrobes to authenticated;
grant update(role),delete on public.wardrobe_members to authenticated;
grant insert(wardrobe_id,name,category,subcategory,brand,size,primary_color,secondary_color,material,material_source,seasons,warmth,thickness,style,occasions,cleanliness,favorite,archived,notes), update(wardrobe_id,name,category,subcategory,brand,size,primary_color,secondary_color,material,material_source,seasons,warmth,thickness,style,occasions,cleanliness,favorite,archived,notes),delete on public.garments to authenticated;
grant insert(garment_id,wardrobe_id,path,kind,width,height),delete on public.garment_images to authenticated;
grant insert(wardrobe_id,garment_id,image_id,type) on public.jobs to authenticated;
grant insert(wardrobe_id,email,role,token_hash),delete on public.invitations to authenticated;
grant insert(wardrobe_id,name,occasion,temperature),delete on public.outfits to authenticated;
grant insert,delete on public.outfit_garments to authenticated;
grant insert(wardrobe_id,garment_id,worn_on) on public.wear_history to authenticated;
revoke all on function public.accept_invitation(text),public.has_wardrobe_access(uuid,boolean),public.owns_wardrobe(uuid),public.on_user_created(),public.on_wardrobe_created() from public;
grant execute on function public.accept_invitation(text),public.has_wardrobe_access(uuid,boolean),public.owns_wardrobe(uuid) to authenticated;
-- Private image objects are reachable only using a user JWT or a scoped worker operation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('garments','garments',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy garment_objects_read on storage.objects for select to authenticated using(bucket_id='garments' and public.has_wardrobe_access((storage.foldername(name))[1]::uuid));
create policy garment_objects_insert on storage.objects for insert to authenticated with check(bucket_id='garments' and public.has_wardrobe_access((storage.foldername(name))[1]::uuid,true));
create policy garment_objects_delete on storage.objects for delete to authenticated using(bucket_id='garments' and public.has_wardrobe_access((storage.foldername(name))[1]::uuid,true));
-- BFF may only manage opaque sessions; worker may only process durable jobs.
grant usage on schema private to wardrobe_session;
grant select,insert,update,delete on private.sessions to wardrobe_session;
grant usage on schema public to wardrobe_worker;
grant select,update on public.jobs to wardrobe_worker;
grant select on public.wardrobe_members,public.garment_images,public.garments to wardrobe_worker;
create policy worker_jobs on public.jobs for all to wardrobe_worker using(true) with check(true);
create policy worker_members on public.wardrobe_members for select to wardrobe_worker using(true);
create policy worker_images on public.garment_images for select to wardrobe_worker using(true);
create policy worker_garments on public.garments for select to wardrobe_worker using(true);
notify pgrst,'reload schema';
