create or replace function public.limit_feedback_submissions()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'Feedback requires your signed-in account.' using errcode = '42501';
  end if;
  -- Serializes simultaneous submissions from one account across API processes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tripsloom-feedback:' || new.user_id::text, 0));
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > pg_catalog.now() - interval '1 hour') >= 5 then
    raise exception 'You have sent five messages this hour. Please wait before sending more feedback.' using errcode = 'P0001';
  end if;
  new.created_at := pg_catalog.now();
  new.status := 'new';
  return new;
end;
$$;
revoke all on function public.limit_feedback_submissions() from public, anon, authenticated;
create trigger feedback_submission_limit before insert on public.feedback for each row execute function public.limit_feedback_submissions();
