/**
 * Claim queued enrichment jobs, generate Vietnamese summaries, and persist the
 * short/detail read models. This worker must run only with server-side secrets.
 */

import { createClusterSummarizerFromEnvironment } from "../src/lib/news/summarizer";
import { runEnrichmentBatch } from "../src/lib/news/enrichment";
import { createNewsRepositoryFromEnvironment } from "../src/lib/news/repository";

const DEFAULT_LIMIT = 10;

const logger = {
  info(message = "") {
    process.stdout.write(`${message}\n`);
  },
  error(message: string) {
    process.stderr.write(`${message}\n`);
  },
};

async function main(): Promise<void> {
  const configuredRepository = createNewsRepositoryFromEnvironment();
  const configuredSummarizer = createClusterSummarizerFromEnvironment();
  if (!configuredRepository) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for enrichment."
    );
  }
  if (!configuredSummarizer) {
    throw new Error("OPENAI_API_KEY must be configured for enrichment.");
  }
  const repository = configuredRepository;
  const summarizer = configuredSummarizer;

  const workerId = createWorkerId();
  const result = await runEnrichmentBatch(repository, summarizer, {
    workerId,
    limit: parseLimit(process.argv),
    onCompleted: job => logger.info(`Completed enrichment job ${job.id}.`),
    onFailure: ({ job, error, releaseError }) => {
      if (releaseError) {
        logger.error(`Could not release job ${job.id}: ${releaseError}`);
      }
      logger.error(`Enrichment job ${job.id} failed: ${error}`);
    },
  });
  if (!result.claimed) {
    logger.info("No enrichment jobs are ready.");
    return;
  }

  logger.info(
    `Enrichment finished: ${result.completed} completed, ${result.deferred} queued for retry, ${result.failed} failed.`
  );
}

function parseLimit(argumentsList: string[]): number {
  const limitIndex = argumentsList.indexOf("--limit");
  const requested = limitIndex >= 0 ? Number(argumentsList[limitIndex + 1]) : DEFAULT_LIMIT;
  if (!Number.isInteger(requested)) return DEFAULT_LIMIT;
  return Math.min(Math.max(requested, 1), 50);
}

function createWorkerId(): string {
  const host = process.env.HOSTNAME || process.env.COMPUTERNAME || "local";
  return `${host.slice(0, 80)}-enrich-${process.pid}`;
}

main().catch(error => {
  const detail = error instanceof Error ? error.message : "unknown error";
  logger.error(`News enrichment failed: ${detail}`);
  process.exitCode = 1;
});
