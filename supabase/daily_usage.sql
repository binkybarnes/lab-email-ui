-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Creates the daily_usage table and the increment_daily_usage RPC function.
-- Uses 5-hour universal windows (0:00, 5:00, 10:00, 15:00, 20:00 UTC).

-- Drop old version if it exists (safe to re-run)
drop function if exists increment_daily_usage(text, date, int);
drop table if exists daily_usage;

-- Table: tracks API calls per IP per 5-hour window
create table daily_usage (
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, window_start)
);

-- Index for quick lookups and cleanup
create index idx_daily_usage_window on daily_usage (window_start);

-- RPC: atomically increment usage and check limit.
-- Returns { allowed: bool, remaining: int, resets_at: text }
create or replace function increment_daily_usage(p_ip text, p_limit int)
returns json
language plpgsql
as $$
declare
  current_count int;
  w_start timestamptz;
  w_end timestamptz;
begin
  -- Compute current 5-hour window start (18000 seconds = 5 hours)
  w_start := to_timestamp(floor(extract(epoch from now()) / 18000) * 18000);
  w_end := w_start + interval '5 hours';

  -- Upsert: insert or increment
  insert into daily_usage (ip, window_start, count)
  values (p_ip, w_start, 1)
  on conflict (ip, window_start)
  do update set count = daily_usage.count + 1
  returning count into current_count;

  -- Check if over limit
  if current_count > p_limit then
    -- Roll back the increment since we're denying
    update daily_usage set count = count - 1 where ip = p_ip and window_start = w_start;
    return json_build_object('allowed', false, 'remaining', 0, 'resets_at', w_end::text);
  end if;

  return json_build_object('allowed', true, 'remaining', p_limit - current_count, 'resets_at', w_end::text);
end;
$$;

-- Optional: auto-cleanup old rows (run periodically or as a cron)
-- delete from daily_usage where window_start < now() - interval '1 day';
