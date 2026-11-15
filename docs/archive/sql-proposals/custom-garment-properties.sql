-- ARCHIVED DESIGN DRAFT — NOT A MIGRATION. DO NOT APPLY.
-- See docs/archive/README.md for its status and the authoritative migrations.
-- Proposal only. Do not move into supabase/migrations or apply before approval.
-- Additive migration for wardrobe-scoped garment properties.

alter table public.garments
  add column wear_condition text not null default 'unknown'
  check (wear_condition in ('unknown','new_with_tags','new_without_tags','very_good','good','satisfactory'));

create table public.garment_property_definitions (
  id uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  type text not null check (type in ('text','number','currency','date','select','multi_select','boolean')),
  sort_order integer not null default 0 check (sort_order >= 0),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wardrobe_id)
);
create unique index garment_property_definitions_name
  on public.garment_property_definitions
    (wardrobe_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
create index garment_property_definitions_order
  on public.garment_property_definitions (wardrobe_id, sort_order, created_at);

create table public.garment_property_options (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  wardrobe_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 120),
  normalized_label text generated always as
    (lower(regexp_replace(btrim(label), '[[:space:]]+', ' ', 'g'))) stored,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (property_id, wardrobe_id)
    references public.garment_property_definitions(id, wardrobe_id) on delete cascade,
  unique (id, property_id, wardrobe_id),
  unique (property_id, normalized_label)
);
create index garment_property_options_order
  on public.garment_property_options (property_id, sort_order, created_at);

create table public.garment_property_values (
  garment_id uuid not null,
  property_id uuid not null,
  wardrobe_id uuid not null,
  value jsonb not null check (value <> 'null'::jsonb),
  updated_at timestamptz not null default now(),
  primary key (garment_id, property_id),
  foreign key (garment_id, wardrobe_id)
    references public.garments(id, wardrobe_id) on delete cascade,
  foreign key (property_id, wardrobe_id)
    references public.garment_property_definitions(id, wardrobe_id) on delete cascade
);
create index garment_property_values_wardrobe
  on public.garment_property_values (wardrobe_id, property_id);

alter table public.garment_property_definitions enable row level security;
alter table public.garment_property_options enable row level security;
alter table public.garment_property_values enable row level security;

create policy garment_property_definitions_read on public.garment_property_definitions
  for select to authenticated using (public.has_wardrobe_access(wardrobe_id));
create policy garment_property_definitions_write on public.garment_property_definitions
  for all to authenticated
  using (public.has_wardrobe_access(wardrobe_id, true))
  with check (public.has_wardrobe_access(wardrobe_id, true));

create policy garment_property_options_read on public.garment_property_options
  for select to authenticated using (public.has_wardrobe_access(wardrobe_id));
create policy garment_property_options_write on public.garment_property_options
  for all to authenticated
  using (public.has_wardrobe_access(wardrobe_id, true))
  with check (public.has_wardrobe_access(wardrobe_id, true));

create policy garment_property_values_read on public.garment_property_values
  for select to authenticated using (public.has_wardrobe_access(wardrobe_id));
create policy garment_property_values_write on public.garment_property_values
  for all to authenticated
  using (public.has_wardrobe_access(wardrobe_id, true))
  with check (public.has_wardrobe_access(wardrobe_id, true));

revoke all on public.garment_property_definitions,
  public.garment_property_options, public.garment_property_values from anon, authenticated;
grant select, insert, update, delete on public.garment_property_definitions,
  public.garment_property_options, public.garment_property_values to authenticated;
grant insert(wear_condition), update(wear_condition) on public.garments to authenticated;

notify pgrst, 'reload schema';
