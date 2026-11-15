-- Run ONLY against an isolated test database where 0016_style_profile.sql has been applied.
-- Verifies authenticated isolation; all fixture users and profiles roll back.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('a6000000-0000-4000-8000-000000000001', 'style-owner@example.invalid', 'test-only', '{}', '{}'),
  ('a6000000-0000-4000-8000-000000000002', 'style-other@example.invalid', 'test-only', '{}', '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.merge_my_style_answers('{"q01_thermal":"cold","q07_avoided_fits":["slim"]}', array[]::text[]);

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.merge_my_style_answers('{"q27_variety":"varied"}', array['q02_at_18c']::text[]);

do $$ begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS leak: another user profile is visible';
  end if;
  if (select count(*) from public.profiles where id='a6000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'RLS leak: cross-user profile can be selected';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.merge_my_style_answers('{"q31_dominant_style":"classic","q32_colors":["navy"],"q34_preference_strength":{"colors":"strong"},"q28_remind_rarely_worn":false}', array['q33_daily_formality']::text[]);

do $$ declare p jsonb; begin
  select style_profile into p from public.profiles where id=auth.uid();
  if p->'answers'->>'q01_thermal' <> 'cold' then raise exception 'Owner answer was lost'; end if;
  if p->'answers'->'q07_avoided_fits' <> '["slim"]'::jsonb then raise exception 'Hard preference was not persisted'; end if;
  if p->'answers'->>'q31_dominant_style' <> 'classic' then raise exception 'New dominant style was not saved'; end if;
  if p->'answers'->'q32_colors' <> '["navy"]'::jsonb then raise exception 'New colors were not saved'; end if;
  if p->'answers'->'q34_preference_strength' <> '{"colors":"strong"}'::jsonb then raise exception 'Preference strength lost'; end if;
  if p->'answers'->'q28_remind_rarely_worn' is distinct from 'false'::jsonb then raise exception 'Explicit No was lost'; end if;
  if p->'answers' ? 'q33_daily_formality' then raise exception 'Skipped new answer received a default'; end if;
  if not (p->'skipped' @> '["q33_daily_formality"]'::jsonb) then raise exception 'New skip was not saved'; end if;
  if p->'answers' ? 'q27_variety' then raise exception 'Other user answer leaked into owner profile'; end if;
end $$;
rollback;
