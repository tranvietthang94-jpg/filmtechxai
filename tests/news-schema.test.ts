import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CLUSTER_STATUSES,
  JOB_KINDS,
  SOURCE_TYPES,
  SUMMARY_KINDS,
} from "../src/lib/news/types";

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260715000000_news_intelligence.sql"
);
const migration = readFileSync(migrationPath, "utf8");
const enrichmentMigrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260715010000_enrichment_worker.sql"
);
const enrichmentMigration = readFileSync(enrichmentMigrationPath, "utf8");

test("news migration defines every required data table and relationship", () => {
  for (const table of [
    "sources",
    "raw_items",
    "clusters",
    "cluster_sources",
    "summaries",
    "metrics",
    "jobs",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`)
    );
  }

  assert.match(migration, /references public\.sources\(id\)/);
  assert.match(migration, /references public\.raw_items\(id\)/);
  assert.match(migration, /references public\.clusters\(id\)/);
  assert.match(migration, /cluster_sources_one_primary_key/);
  assert.match(migration, /raw_items_source_external_id_key/);
  assert.match(migration, /summaries_cluster_kind_language_key/);
  assert.match(migration, /dedupe_key text unique/);
  assert.match(enrichmentMigration, /create function public\.claim_news_jobs/);
  assert.match(enrichmentMigration, /for update skip locked/);
  assert.match(enrichmentMigration, /revoke all on function public\.claim_news_jobs/);
});

test("news contracts stay aligned with the database enum values", () => {
  for (const sourceType of SOURCE_TYPES) {
    assert.match(migration, new RegExp(`'${sourceType}'`));
  }

  for (const clusterStatus of CLUSTER_STATUSES) {
    assert.match(migration, new RegExp(`'${clusterStatus}'`));
  }

  for (const summaryKind of SUMMARY_KINDS) {
    assert.match(migration, new RegExp(`'${summaryKind}'`));
  }

  for (const jobKind of JOB_KINDS) {
    assert.match(migration, new RegExp(`'${jobKind}'`));
  }
});
