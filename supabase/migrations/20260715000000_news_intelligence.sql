begin;

create extension if not exists pgcrypto;

create type public.source_type as enum (
  'press',
  'youtube',
  'x',
  'reddit',
  'hacker_news',
  'tiktok'
);

create type public.raw_item_status as enum (
  'fetched',
  'normalized',
  'rejected',
  'failed'
);

create type public.cluster_status as enum (
  'pending',
  'ready',
  'suppressed',
  'failed'
);

create type public.summary_kind as enum (
  'short',
  'detail',
  'video',
  'discussion',
  'translation'
);

create type public.summary_status as enum (
  'pending',
  'ready',
  'failed'
);

create type public.job_kind as enum (
  'ingest_source',
  'normalize_item',
  'cluster_item',
  'enrich_cluster',
  'refresh_metrics'
);

create type public.job_status as enum (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type public.source_type not null,
  homepage_url text,
  feed_url text,
  external_id text,
  handle text,
  fetch_interval_minutes integer not null default 15
    check (fetch_interval_minutes between 1 and 1440),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (feed_url is not null or external_id is not null or handle is not null)
);

create table public.raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  external_id text not null,
  canonical_url text not null,
  original_title text not null,
  original_text text,
  original_html text,
  author_name text,
  image_url text,
  language_code text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text,
  status public.raw_item_status not null default 'fetched',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raw_items_source_external_id_key unique (source_id, external_id)
);

create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  primary_raw_item_id uuid references public.raw_items(id) on delete set null,
  primary_type public.source_type not null,
  canonical_title text not null,
  title_vi text,
  topic_tags text[] not null default '{}',
  status public.cluster_status not null default 'pending',
  source_count integer not null default 0 check (source_count >= 0),
  heat_score numeric(12, 4) not null default 0,
  is_rising boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cluster_sources (
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  match_confidence numeric(5, 4) not null default 1
    check (match_confidence between 0 and 1),
  is_primary boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (cluster_id, raw_item_id),
  unique (raw_item_id)
);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  kind public.summary_kind not null,
  language_code text not null default 'vi',
  status public.summary_status not null default 'pending',
  content text,
  bullets jsonb not null default '[]'::jsonb,
  model text,
  prompt_version text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint summaries_cluster_kind_language_key unique (cluster_id, kind, language_code),
  check (
    (status = 'ready' and content is not null)
    or (status <> 'ready')
  )
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  collected_at timestamptz not null default now(),
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  reposts bigint check (reposts is null or reposts >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  metadata jsonb not null default '{}'::jsonb,
  constraint metrics_raw_item_collected_at_key unique (raw_item_id, collected_at)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.job_kind not null,
  status public.job_status not null default 'queued',
  source_id uuid references public.sources(id) on delete cascade,
  raw_item_id uuid references public.raw_items(id) on delete cascade,
  cluster_id uuid references public.clusters(id) on delete cascade,
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  priority smallint not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cluster_sources_one_primary_key
  on public.cluster_sources (cluster_id)
  where is_primary;

create index raw_items_source_published_at_idx
  on public.raw_items (source_id, published_at desc nulls last);

create index raw_items_canonical_url_idx
  on public.raw_items (canonical_url);

create index clusters_feed_rank_idx
  on public.clusters (status, heat_score desc, last_seen_at desc);

create index clusters_published_at_idx
  on public.clusters (published_at desc nulls last);

create index cluster_sources_source_id_idx
  on public.cluster_sources (source_id, cluster_id);

create index summaries_pending_idx
  on public.summaries (status, created_at)
  where status = 'pending';

create index metrics_raw_item_collected_at_idx
  on public.metrics (raw_item_id, collected_at desc);

create index jobs_ready_idx
  on public.jobs (priority desc, run_after, created_at)
  where status = 'queued';

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.refresh_cluster_source_count()
returns trigger
language plpgsql
as $$
declare
  affected_cluster_id uuid;
begin
  affected_cluster_id := coalesce(new.cluster_id, old.cluster_id);

  update public.clusters
  set source_count = (
    select count(distinct source_id)
    from public.cluster_sources
    where cluster_id = affected_cluster_id
  )
  where id = affected_cluster_id;

  if tg_op = 'update' and old.cluster_id is distinct from new.cluster_id then
    update public.clusters
    set source_count = (
      select count(distinct source_id)
      from public.cluster_sources
      where cluster_id = old.cluster_id
    )
    where id = old.cluster_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

create trigger raw_items_set_updated_at
before update on public.raw_items
for each row execute function public.set_updated_at();

create trigger clusters_set_updated_at
before update on public.clusters
for each row execute function public.set_updated_at();

create trigger summaries_set_updated_at
before update on public.summaries
for each row execute function public.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger cluster_sources_refresh_source_count
after insert or update or delete on public.cluster_sources
for each row execute function public.refresh_cluster_source_count();

alter table public.sources enable row level security;
alter table public.raw_items enable row level security;
alter table public.clusters enable row level security;
alter table public.cluster_sources enable row level security;
alter table public.summaries enable row level security;
alter table public.metrics enable row level security;
alter table public.jobs enable row level security;

comment on schema public is
  'News intelligence data model. Only server-side workers should access it until public read APIs are introduced.';

commit;
