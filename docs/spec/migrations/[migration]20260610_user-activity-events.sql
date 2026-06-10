-- migration: user-activity-events
-- spec: docs/spec/[spec]20260610_service-usage-dashboard.md
-- 작성일: 2026년 6월 10일
--
-- 이 SQL은 작성만 한다. 실제 적용은 AnonymousMessageWeb의 Supabase 마이그레이션으로
-- 옮긴 뒤 검토와 승인을 거쳐 수행한다.

-- =========================
-- UP
-- =========================

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('login_success', 'message_sent')),
  ref_type text,
  ref_id uuid,
  event_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_activity_events enable row level security;

create index if not exists user_activity_events_type_occurred_at_idx
  on public.user_activity_events (event_type, occurred_at desc);

create index if not exists user_activity_events_type_event_date_idx
  on public.user_activity_events (event_type, event_date);

create index if not exists user_activity_events_type_user_occurred_at_idx
  on public.user_activity_events (event_type, user_id, occurred_at desc);

create unique index if not exists user_activity_events_unique_login_day_idx
  on public.user_activity_events (user_id, event_type, event_date)
  where event_type = 'login_success';

create unique index if not exists user_activity_events_unique_ref_idx
  on public.user_activity_events (user_id, event_type, ref_type, ref_id)
  where ref_id is not null;

revoke all on public.user_activity_events from anon, authenticated, public;

create or replace function public.record_login_success()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  insert into public.user_activity_events (
    user_id,
    event_type,
    ref_type,
    ref_id,
    event_date,
    metadata
  )
  values (
    v_uid,
    'login_success',
    null,
    null,
    (now() at time zone 'Asia/Seoul')::date,
    '{}'::jsonb
  )
  on conflict (user_id, event_type, event_date)
  where event_type = 'login_success'
  do update set occurred_at = excluded.occurred_at
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_login_success() from anon, authenticated, public;
grant execute on function public.record_login_success() to authenticated;

create or replace function public.record_message_sent(p_message_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_message_id is null then
    raise exception 'message_id required';
  end if;

  if not exists (
    select 1
    from public.messages
    where messages.id = p_message_id
      and messages.deleted_at is null
  ) then
    raise exception 'message not found';
  end if;

  insert into public.user_activity_events (
    user_id,
    event_type,
    ref_type,
    ref_id,
    event_date,
    metadata
  )
  values (
    v_uid,
    'message_sent',
    'message',
    p_message_id,
    (now() at time zone 'Asia/Seoul')::date,
    '{}'::jsonb
  )
  on conflict (user_id, event_type, ref_type, ref_id)
  where ref_id is not null
  do update set metadata = public.user_activity_events.metadata
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_message_sent(uuid) from anon, authenticated, public;

-- submit_public_message RPC 내부의 메시지 저장 성공 직후 다음 호출을 추가한다.
-- begin
--   if (select auth.uid()) is not null then
--     perform public.record_message_sent(v_msg_id);
--   end if;
-- exception when others then
--   null;
-- end;

-- =========================
-- DOWN (수동 롤백용)
-- =========================
--
-- drop function if exists public.record_message_sent(uuid);
-- drop function if exists public.record_login_success();
-- drop table if exists public.user_activity_events;
