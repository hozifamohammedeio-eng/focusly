-- Generic import: no user UUIDs, no destructive writes, no onboarding assumptions.
-- A fresh installation has no legacy schema and intentionally skips this import.
do $$
begin
  if to_regclass('focusly_legacy.profiles') is null then return; end if;

  insert into public.profiles (id, display_name, created_at, updated_at)
  select u.id,
    case when char_length(btrim(p.display_name)) between 1 and 80
      and p.display_name !~ '[[:cntrl:]]' then btrim(p.display_name) else null end,
    coalesce(p.created_at, now()), coalesce(p.updated_at, now())
  from auth.users u left join focusly_legacy.profiles p on p.id = u.id
  on conflict (id) do nothing;
  -- Defaults leave school stage/year/goal unset and onboarding incomplete.
  -- Existing new-profile changes are never overwritten on a retry.

  insert into public.user_settings (user_id, theme, accent, created_at, updated_at)
  select u.id,
    case when v.theme_mode in ('light','dark','system')
      then v.theme_mode::public.app_theme else 'system'::public.app_theme end,
    case when v.accent_color in ('violet','blue','green','orange')
      then v.accent_color::public.accent_color else 'violet'::public.accent_color end,
    coalesce(v.created_at, now()), coalesce(v.updated_at, now())
  from auth.users u left join public.user_preferences v on v.user_id = u.id
  on conflict (user_id) do nothing;
  -- Legacy hex colors have no exact enum equivalent. Locale was not stored.
  -- Keep defaults; all unmapped preferences remain intact in the legacy table.
end;
$$;
