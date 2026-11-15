-- Supabase may grant table-wide SELECT through default privileges. Restrict
-- authenticated PostgREST clients to non-secret credential metadata only.
revoke select on table public.gemini_credentials from public, anon, authenticated;
grant select(user_id, key_hint, model, updated_at)
  on table public.gemini_credentials to authenticated;
notify pgrst, 'reload schema';
