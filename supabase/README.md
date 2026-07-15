# Deferred news intelligence database

> The production site currently uses the static GitHub Pages pipeline. This
> Supabase/OpenAI architecture is retained for future evaluation only and is not
> invoked by the scheduled workflow or static build.

The SQL migration in `migrations/` is the source of truth for the data layer
needed by the Peek-compatible functionality. It is standard PostgreSQL SQL and
can be applied through the Supabase CLI or the Supabase SQL editor.

## Apply to a Supabase project

1. Create a Supabase project and keep its database password and service-role
   key outside this repository.
2. Link the project with the Supabase CLI, then run `supabase db push`.
3. Store `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as deployment secrets.
   The service-role key is for server-side workers only; it must never be
   exposed through `PUBLIC_*` variables or browser code.

The migration enables Row Level Security for every table and intentionally adds
no public policies. The next phase will introduce a server-side feed API with
least-privilege read access.

## Scope of this migration

- `sources` stores configured publishers, channels, and accounts.
- `raw_items` preserves normalized source material before enrichment.
- `clusters` and `cluster_sources` represent one news event backed by one or
  more sources.
- `summaries` stores cached AI outputs by type and language.
- `metrics` retains time-series engagement counters.
- `jobs` is the persistent queue for ingestion, clustering, enrichment, and
  metric refresh work.

## Deferred architecture

There are no database-backed API routes in the current deployment. The
scheduled workflow does not run `ingest:news` or `enrich:news`, and the default
environment example deliberately contains no Supabase or OpenAI credentials.

If this architecture is reconsidered later, create explicit read endpoints and
separate server-side workers first. Do not re-enable it merely by adding secrets
to a static deployment workflow; retain the Markdown/RSS path as the production
fallback.
