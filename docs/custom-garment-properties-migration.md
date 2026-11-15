# Custom garment properties — schema and deployment

## Ustalenia ze schematu

`public.garments` has fixed system columns and RLS based on `wardrobe_id`; the UI/API update garments through the user session. At this design snapshot, field-definition and custom-value tables did not yet exist. `cleanliness` describes laundry status rather than wear condition. Migrations are transactional, ordered, and SHA-256-verified; the migrator applies all files in `supabase/migrations` at startup.

## Proponowane przechowywanie

- `garment_property_definitions`: name, type, ordering, and visibility shared within a wardrobe.
- `garment_property_options`: reusable select/multi-select options; normalized names are unique within each field.
- `garment_property_values`: JSONB value for a garment/field pair. Composite foreign keys enforce that the field and garment belong to the same wardrobe.
- `garments.wear_condition`: separate system property with values `unknown`, `new_with_tags`, `new_without_tags`, `very_good`, `good`, `satisfactory`; it is not a custom field and does not change `cleanliness`.

API validates JSONB against the definition’s type. Amounts use `{amount, currency}`; dates are ISO `YYYY-MM-DD`; choices store option UUIDs. Ordinary users use the existing BFF, which forwards their session JWT. RLS permits wardrobe members to read fields, with changes restricted to owner/editor. There is no service-role or public access.

## Migration effects

The additive migration adds `wear_condition` with `unknown` for existing/new garments, plus three tables, indexes, foreign keys, grants, and RLS policies. It does not change existing columns, photos, wardrobes, or metadata values. The deployed migration is `supabase/migrations/0015_custom_garment_properties.sql`; its review draft remains in `custom-garment-properties-migration-proposal.sql`.

The transactional checksum-verified migrator applied the migration. RLS was tested with two temporary users in a transaction ending with `ROLLBACK`. Only API/web were built/recreated and both are healthy. UI CRUD has a mocked-API Playwright test. The full live BFF test stopped at registration-email delivery through the existing SMTP relay, before reaching custom-property endpoints; SMTP was not changed.

Once custom properties are stored, rolling back through `DROP TABLE` would delete them. There is therefore no safe automatic backward migration; preserving data after deployment requires retaining the tables or exporting their contents separately before removal.
