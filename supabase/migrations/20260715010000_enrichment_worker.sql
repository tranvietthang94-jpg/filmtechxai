begin;

create function public.claim_news_jobs(
  worker_id text,
  requested_kind public.job_kind,
  max_jobs integer default 10
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if worker_id is null or length(trim(worker_id)) = 0 then
    raise exception 'worker_id is required';
  end if;

  return query
  with claimable as (
    select id
    from public.jobs
    where status = 'queued'
      and kind = requested_kind
      and run_after <= now()
    order by priority desc, run_after, created_at
    for update skip locked
    limit greatest(1, least(max_jobs, 50))
  )
  update public.jobs job
  set
    status = 'running',
    locked_at = now(),
    locked_by = worker_id,
    attempts = job.attempts + 1,
    updated_at = now()
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_news_jobs(text, public.job_kind, integer)
  from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_news_jobs(
      text,
      public.job_kind,
      integer
    ) to service_role;
  end if;
end;
$$;

comment on function public.claim_news_jobs(text, public.job_kind, integer) is
  'Atomically claims queued internal worker jobs. Execution is restricted to the Supabase service role.';

commit;
