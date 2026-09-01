#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

/**
 * Read-only production release identity check.
 *
 * Required environment:
 *   VERCEL_TOKEN              provider API token (never printed)
 *   VERCEL_PROJECT_ID         exact coupon-cycle project id
 *   VERCEL_DEPLOYMENT_ID      immutable deployment to verify
 *   EXPECTED_COMMIT_SHA       source commit expected in that deployment
 *
 * Optional:
 *   VERCEL_TEAM_ID             team id for the project
 *   VERCEL_PRIMARY_ALIAS       defaults to www.perks-reminder.com
 *
 * The check performs no promotion, deployment, migration, or database access.
 * Output is aggregate identity/status evidence only.
 */

export const requiredEnvironment = [
  'VERCEL_TOKEN',
  'VERCEL_PROJECT_ID',
  'VERCEL_DEPLOYMENT_ID',
  'EXPECTED_COMMIT_SHA',
];

export function sourceCommit(deployment) {
  return deployment?.meta?.githubCommitSha
    || deployment?.meta?.gitCommitSha
    || deployment?.gitSource?.sha
    || null;
}

export function evaluateRelease(candidate, primary, expectedCommitSha) {
  const candidateId = candidate?.id || null;
  const primaryId = primary?.id || null;
  const candidateReady = candidate?.readyState === 'READY' || candidate?.state === 'READY';
  const candidateCommitMatches = sourceCommit(candidate) === expectedCommitSha;
  const aliasMatchesCandidate = candidateId !== null && candidateId === primaryId;
  const passed = candidateReady && candidateCommitMatches && aliasMatchesCandidate;
  return { candidateReady, candidateCommitMatches, aliasMatchesCandidate, passed };
}

export async function runReleaseCheck(environment = process.env, fetchImpl = fetch) {
  const missing = requiredEnvironment.find((name) => !environment[name]);
  if (missing) return { exitCode: 2, error: `Missing required environment: ${missing}` };

  const queryParams = new URLSearchParams({ projectId: environment.VERCEL_PROJECT_ID });
  if (environment.VERCEL_TEAM_ID) queryParams.set('teamId', environment.VERCEL_TEAM_ID);
  const query = `?${queryParams.toString()}`;
  const headers = {
    Authorization: `Bearer ${environment.VERCEL_TOKEN}`,
    Accept: 'application/json',
  };
  const fetchDeployment = async (ref) => {
    const response = await fetchImpl(
      `https://api.vercel.com/v13/deployments/${encodeURIComponent(ref)}${query}`,
      { headers }
    );
    if (!response.ok) throw new Error(`Vercel deployment lookup failed (${response.status})`);
    return response.json();
  };

  const [candidate, primary] = await Promise.all([
    fetchDeployment(environment.VERCEL_DEPLOYMENT_ID),
    fetchDeployment(environment.VERCEL_PRIMARY_ALIAS || 'www.perks-reminder.com'),
  ]);
  const result = evaluateRelease(candidate, primary, environment.EXPECTED_COMMIT_SHA);
  return { exitCode: result.passed ? 0 : 1, result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const outcome = await runReleaseCheck();
    if (outcome.error) console.error(outcome.error);
    if (outcome.result) console.log(JSON.stringify(outcome.result));
    process.exit(outcome.exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release identity check failed');
    process.exit(1);
  }
}
