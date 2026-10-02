-- Do not let one authenticated user replace another user's push endpoint.
-- Keep existing subscription IDs and related delivery history on refresh.
create or replace function public.claim_study_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  result_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_endpoint is null or char_length(p_endpoint) < 16 or char_length(p_endpoint) > 4096
    or p_p256dh is null or char_length(p_p256dh) < 16 or char_length(p_p256dh) > 512
    or p_auth is null or char_length(p_auth) < 8 or char_length(p_auth) > 512
    or (p_user_agent is not null and char_length(p_user_agent) > 1000)
  then
    raise exception 'Invalid push subscription' using errcode = '22023';
  end if;

  insert into public.study_push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  values (owner_id, p_endpoint, p_p256dh, p_auth, nullif(p_user_agent, ''))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now()
    where study_push_subscriptions.user_id = owner_id
  returning id into result_id;

  if result_id is null then
    raise exception 'Subscription endpoint unavailable' using errcode = '42501';
  end if;

  return result_id;
end;
$$;

revoke all on function public.claim_study_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function public.claim_study_push_subscription(text, text, text, text)
  to authenticated;
