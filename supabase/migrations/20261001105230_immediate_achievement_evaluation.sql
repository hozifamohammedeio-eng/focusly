-- Keep the original nine-rule evaluator and challenge evaluator authoritative.
-- Their private implementations are unchanged; the public entry points now
-- finish all newly eligible achievement rewards in the same claim transaction.
create schema focusly_achievement_internal;
revoke all on schema focusly_achievement_internal from public, anon, authenticated;

alter function public.evaluate_progression_achievements()
  set schema focusly_achievement_internal;
revoke all on function focusly_achievement_internal.evaluate_progression_achievements()
  from public, anon, authenticated;

create function public.evaluate_progression_achievements()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  newly_unlocked jsonb;
  all_unlocked jsonb := '[]'::jsonb;
  pass integer;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.progression_profiles(user_id)
    values (owner_id) on conflict (user_id) do nothing;
  perform 1 from public.progression_profiles where user_id = owner_id for update;

  -- Achievement XP can satisfy level 2 or level 5. At most nine unique
  -- achievements can unlock, so this bounded fixed point always terminates.
  for pass in 1..9 loop
    newly_unlocked := focusly_achievement_internal.evaluate_progression_achievements();
    exit when jsonb_array_length(newly_unlocked) = 0;
    all_unlocked := all_unlocked || newly_unlocked;
  end loop;
  return all_unlocked;
end;
$$;
revoke all on function public.evaluate_progression_achievements() from public, anon;
grant execute on function public.evaluate_progression_achievements() to authenticated;

-- Direct trusted Challenge evaluation can itself award XP. Preserve the
-- existing array contract and attach any newly earned achievement receipts
-- to its first new Challenge receipt for the enclosing claim to return.
alter function public.evaluate_progression_challenges()
  set schema focusly_challenge_internal;
revoke all on function focusly_challenge_internal.evaluate_progression_challenges()
  from public, anon, authenticated;

create function public.evaluate_progression_challenges()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  challenge_awards jsonb;
  achievement_awards jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  challenge_awards := focusly_challenge_internal.evaluate_progression_challenges();
  if jsonb_array_length(challenge_awards) > 0 then
    achievement_awards := public.evaluate_progression_achievements();
    if jsonb_array_length(achievement_awards) > 0 then
      challenge_awards := jsonb_set(
        challenge_awards, '{0,achievementUnlocks}', achievement_awards, true
      );
    end if;
  end if;
  return challenge_awards;
end;
$$;
revoke all on function public.evaluate_progression_challenges() from public, anon;
grant execute on function public.evaluate_progression_challenges() to authenticated;

-- The existing trusted Focus/Task claim wrappers already hold an owner lock
-- and process City and Challenges in one database transaction. Add the final
-- achievement pass before returning a single trusted receipt.
create or replace function public.claim_focus_progression_reward(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
  challenges jsonb := '[]'::jsonb;
  achievements jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict(user_id) do nothing;
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_focus_progression_reward(p_session_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
    challenges := public.evaluate_progression_challenges();
    achievements := coalesce(challenges->0->'achievementUnlocks', '[]'::jsonb)
      || public.evaluate_progression_achievements();
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object(
    'cityConstruction', construction, 'challenges', challenges, 'achievements', achievements,
    'balances', jsonb_build_object('totalXp', balance.total_xp, 'coins', balance.coins,
      'constructionPoints', balance.construction_points)
  );
end;
$$;

create or replace function public.claim_task_progression_reward(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
  challenges jsonb := '[]'::jsonb;
  achievements jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict(user_id) do nothing;
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_task_progression_reward(p_task_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
    challenges := public.evaluate_progression_challenges();
    achievements := coalesce(challenges->0->'achievementUnlocks', '[]'::jsonb)
      || public.evaluate_progression_achievements();
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object(
    'cityConstruction', construction, 'challenges', challenges, 'achievements', achievements,
    'balances', jsonb_build_object('totalXp', balance.total_xp, 'coins', balance.coins,
      'constructionPoints', balance.construction_points)
  );
end;
$$;
revoke all on function public.claim_focus_progression_reward(uuid) from public, anon;
revoke all on function public.claim_task_progression_reward(uuid) from public, anon;
grant execute on function public.claim_focus_progression_reward(uuid) to authenticated;
grant execute on function public.claim_task_progression_reward(uuid) to authenticated;
