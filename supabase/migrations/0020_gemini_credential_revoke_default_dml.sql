-- Remove table-wide DML inherited from Supabase default privileges. Keep
-- credential mutations exclusively behind the wardrobe_session RPCs.
revoke insert, update, delete on table public.gemini_credentials
  from public, anon, authenticated;
revoke insert(user_id, encrypted_key, key_hint, model),
       update(user_id, encrypted_key, key_hint, model)
  on table public.gemini_credentials from public, anon, authenticated;
