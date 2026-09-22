-- Focusly open-ended study stopwatch.
-- Existing countdown sessions remain unchanged.
-- p_minutes = 0 represents an open-ended session.

alter table public.focus_sessions
  drop constraint if exists
  focus_sessions_accumulated_seconds_check;

alter table public.focus_sessions
  drop constraint if exists
  focus_sessions_accumulated_nonnegative;

alter table public.focus_sessions
  add constraint
  focus_sessions_accumulated_nonnegative
  check (
    accumulated_seconds >= 0
  );

alter table public.focus_sessions
  drop constraint if exists
  focus_timer_consistency;

alter table public.focus_sessions
  add constraint
  focus_timer_consistency
  check (
    timer_state is null
    or (
      accumulated_seconds >= 0
      and (
        planned_seconds is null
        or (
          planned_seconds
            between 300
            and 10800
          and
          accumulated_seconds
            <= planned_seconds
        )
      )
      and (
        (
          timer_state = 'running'
          and
          running_since
            is not null
          and
          not completed
          and
          ended_at is null
        )
        or (
          timer_state = 'paused'
          and
          running_since is null
          and
          not completed
          and
          ended_at is null
        )
        or (
          timer_state =
            'completed'
          and
          running_since is null
          and
          completed
          and
          ended_at
            is not null
          and
          duration_seconds >= 60
          and (
            planned_seconds
              is null
            or
            duration_seconds
              <=
              planned_seconds
          )
        )
        or (
          timer_state =
            'discarded'
          and
          running_since is null
          and
          not completed
          and
          ended_at
            is not null
        )
      )
    )
  );

create or replace function
public.focus_transition(
  p_action text,
  p_id uuid default null,
  p_minutes integer
    default 25,
  p_subject uuid
    default null,
  p_task uuid
    default null,
  p_revision timestamptz
    default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid :=
    auth.uid();

  stamp timestamptz :=
    clock_timestamp();

  s public.focus_sessions;

  elapsed integer;

  finish_at timestamptz;
begin
  if owner_id is null then
    raise exception
      'Authentication required'
      using errcode='42501';
  end if;

  perform 1
  from public.profiles
  where
    id = owner_id
    and onboarding_completed
  for update;

  if not found then
    raise exception
      'Onboarding required'
      using errcode='42501';
  end if;

  if p_action not in (
    'start',
    'recover',
    'pause',
    'resume',
    'finish',
    'discard'
  ) then
    raise exception
      'Invalid action'
      using errcode='22023';
  end if;

  if p_id is not null then
    select *
    into s
    from
      public.focus_sessions
    where
      id = p_id
      and
      user_id = owner_id
    for update;
  end if;

  if
    s.id is null
    and
    p_action in (
      'start',
      'recover'
    )
  then
    select *
    into s
    from
      public.focus_sessions
    where
      user_id = owner_id
      and timer_state in (
        'running',
        'paused'
      )
    for update;
  end if;

  if
    s.id is null
    and
    p_action = 'start'
  then
    if
      p_id is null
      or
      p_minutes is null
      or not (
        p_minutes = 0
        or
        p_minutes
          between 5
          and 180
      )
    then
      raise exception
        'Invalid duration'
        using errcode='22023';
    end if;

    if
      p_subject is not null
      and not exists (
        select 1
        from public.subjects
        where
          id = p_subject
          and
          user_id =
            owner_id
          and
          archived_at
            is null
      )
    then
      raise exception
        'Invalid subject'
        using errcode='22023';
    end if;

    if
      p_task is not null
      and not exists (
        select 1
        from public.tasks
        where
          id = p_task
          and
          user_id =
            owner_id
          and
          status <>
            'completed'
      )
    then
      raise exception
        'Invalid task'
        using errcode='22023';
    end if;

    insert into
      public.focus_sessions(
        id,
        user_id,
        subject_id,
        task_id,
        started_at,
        timer_state,
        planned_seconds,
        running_since
      )
    values(
      p_id,
      owner_id,
      p_subject,
      p_task,
      stamp,
      'running',
      case
        when
          p_minutes = 0
        then null
        else
          p_minutes * 60
      end,
      stamp
    )
    returning *
    into s;

  elsif
    s.id is not null
    and
    s.timer_state in (
      'running',
      'paused'
    )
  then
    elapsed :=
      s.accumulated_seconds
      +
      case
        when
          s.timer_state =
            'running'
        then
          greatest(
            0,
            floor(
              extract(
                epoch
                from
                  stamp -
                  s.running_since
              )
            )::integer
          )
        else
          0
      end;

    if
      s.planned_seconds
        is not null
    then
      elapsed :=
        least(
          s.planned_seconds,
          elapsed
        );
    end if;

    if
      s.timer_state =
        'paused'
      and
      s.updated_at <
        stamp -
        interval '7 days'
    then
      p_action :=
        'discard';
    end if;

    if (
      (
        s.planned_seconds
          is not null
        and
        elapsed >=
          s.planned_seconds
      )
      or
      p_action =
        'discard'
      or (
        p_action =
          'finish'
        and (
          p_revision is null
          or
          p_revision =
            s.updated_at
        )
      )
    ) then
      finish_at :=
        case
          when
            s.planned_seconds
              is not null
            and
            elapsed >=
              s.planned_seconds
            and
            s.running_since
              is not null
          then
            s.running_since
            +
            make_interval(
              secs =>
                s.planned_seconds
                -
                s.accumulated_seconds
            )
          else
            stamp
        end;

      update
        public.focus_sessions
      set
        timer_state =
          case
            when
              p_action =
                'discard'
              or
              elapsed < 60
            then
              'discarded'
            else
              'completed'
          end,

        completed =
          (
            p_action <>
              'discard'
            and
            elapsed >= 60
          ),

        duration_seconds =
          case
            when
              p_action =
                'discard'
            then
              0
            else
              elapsed
          end,

        accumulated_seconds =
          elapsed,

        running_since = null,

        ended_at =
          finish_at

      where
        id = s.id
        and
        user_id =
          owner_id

      returning *
      into s;

    elsif
      p_revision is null
      or
      p_revision =
        s.updated_at
    then

      if
        p_action =
          'pause'
        and
        s.timer_state =
          'running'
      then

        update
          public.focus_sessions
        set
          accumulated_seconds =
            elapsed,
          running_since =
            null,
          timer_state =
            'paused'
        where
          id = s.id
          and
          user_id =
            owner_id
        returning *
        into s;

      elsif
        p_action =
          'resume'
        and
        s.timer_state =
          'paused'
      then

        update
          public.focus_sessions
        set
          running_since =
            stamp,
          timer_state =
            'running'
        where
          id = s.id
          and
          user_id =
            owner_id
        returning *
        into s;

      end if;
    end if;

  elsif
    s.id is null
    and
    p_action <>
      'recover'
  then

    raise exception
      'Session unavailable'
      using errcode='P0002';

  end if;

  return
    jsonb_build_object(
      'session',
      case
        when
          s.id is null
        then
          null
        else
          to_jsonb(s)
      end,

      'serverNow',
      clock_timestamp()
    );
end;
$$;

revoke all
on function
public.focus_transition(
  text,
  uuid,
  integer,
  uuid,
  uuid,
  timestamptz
)
from public, anon;

grant execute
on function
public.focus_transition(
  text,
  uuid,
  integer,
  uuid,
  uuid,
  timestamptz
)
to authenticated;
