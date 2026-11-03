create index if not exists loyalty_attempts_reset_idx
  on public.loyalty_attempts (reset_at);

create or replace function public.loyalty_allow_attempt(
  p_key text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if random() < 0.02 then
    delete from public.loyalty_attempts
    where reset_at < now() - interval '1 day';
  end if;

  insert into public.loyalty_attempts (attempt_key, attempt_count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (attempt_key) do update
    set attempt_count = case
      when public.loyalty_attempts.reset_at <= now() then 1
      else public.loyalty_attempts.attempt_count + 1
    end,
    reset_at = case
      when public.loyalty_attempts.reset_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else public.loyalty_attempts.reset_at
    end
  returning attempt_count into v_count;
  return v_count <= p_max;
end;
$$;

revoke all on function public.loyalty_allow_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.loyalty_allow_attempt(text, integer, integer) to service_role;
