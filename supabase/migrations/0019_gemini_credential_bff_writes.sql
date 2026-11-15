-- Keep Gemini credential writes inside the authenticated BFF. PostgREST
-- upsert requires table-level privileges, which would expose ciphertext.
revoke insert(user_id, encrypted_key, key_hint, model),
       update(user_id, encrypted_key, key_hint, model),
       delete on table public.gemini_credentials
  from public, anon, authenticated;

create function private.save_gemini_credential_for_user(
  p_user_id uuid, p_encrypted_key text, p_key_hint text
) returns table(key_hint text, model text)
language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'wardrobe_session' then
    raise exception 'BFF role required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  insert into public.gemini_credentials as c(user_id, encrypted_key, key_hint)
    values (p_user_id, p_encrypted_key, p_key_hint)
    on conflict (user_id) do update
      set encrypted_key = excluded.encrypted_key,
          key_hint = excluded.key_hint,
          updated_at = now();
  return query select c.key_hint, c.model
    from public.gemini_credentials c where c.user_id = p_user_id;
end $$;

create function private.update_gemini_model_for_user(p_user_id uuid, p_model text)
returns table(key_hint text, model text)
language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'wardrobe_session' then
    raise exception 'BFF role required' using errcode = '42501';
  end if;
  if p_model is null or p_model !~ '^models/[A-Za-z0-9._-]{1,120}$' then
    raise exception 'invalid model' using errcode = '22023';
  end if;
  return query update public.gemini_credentials c
    set model = p_model, updated_at = now()
    where c.user_id = p_user_id
    returning c.key_hint, c.model;
  if not found then raise exception 'credential not found' using errcode = 'P0002'; end if;
end $$;

create function private.delete_gemini_credential_for_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'wardrobe_session' then
    raise exception 'BFF role required' using errcode = '42501';
  end if;
  delete from public.gemini_credentials c where c.user_id = p_user_id;
end $$;

revoke all on function private.save_gemini_credential_for_user(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.update_gemini_model_for_user(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.delete_gemini_credential_for_user(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.save_gemini_credential_for_user(uuid, text, text)
  to wardrobe_session;
grant execute on function private.update_gemini_model_for_user(uuid, text)
  to wardrobe_session;
grant execute on function private.delete_gemini_credential_for_user(uuid)
  to wardrobe_session;
