-- Completed Focus sessions are reward evidence. The browser must not be able to
-- insert or alter that evidence directly; the server-clock transition is the
-- sole authenticated write path. Existing rows and SELECT policies are kept.
revoke insert, update, delete on public.focus_sessions from authenticated;

-- This function already verifies auth.uid(), scopes every row by that owner,
-- validates linked subjects/tasks, and calculates elapsed time from the server
-- clock. SECURITY DEFINER lets those checked writes continue after the revoke.
alter function public.focus_transition(text, uuid, integer, uuid, uuid, timestamptz)
  security definer;

revoke all on function public.focus_transition(text, uuid, integer, uuid, uuid, timestamptz)
  from public, anon;
grant execute on function public.focus_transition(text, uuid, integer, uuid, uuid, timestamptz)
  to authenticated;
