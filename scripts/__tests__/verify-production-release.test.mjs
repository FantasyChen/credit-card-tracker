import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRelease,
  runReleaseCheck,
  sourceCommit,
} from '../verify-production-release.mjs';

test('accepts only a Ready, commit-matched deployment served by the alias', () => {
  const candidate = { id: 'dpl-new', readyState: 'READY', meta: { githubCommitSha: 'abc123' } };

  assert.deepEqual(evaluateRelease(candidate, { id: 'dpl-new' }, 'abc123'), {
    candidateReady: true,
    candidateCommitMatches: true,
    aliasMatchesCandidate: true,
    passed: true,
  });
  assert.equal(evaluateRelease(candidate, { id: 'dpl-old' }, 'abc123').passed, false);
  assert.equal(evaluateRelease(candidate, { id: 'dpl-new' }, 'other').passed, false);
  assert.equal(evaluateRelease({ ...candidate, readyState: 'ERROR' }, { id: 'dpl-new' }, 'abc123').passed, false);
});

test('reads supported source commit fields without guessing', () => {
  assert.equal(sourceCommit({ meta: { githubCommitSha: 'github' } }), 'github');
  assert.equal(sourceCommit({ meta: { gitCommitSha: 'generic' } }), 'generic');
  assert.equal(sourceCommit({ gitSource: { sha: 'source' } }), 'source');
  assert.equal(sourceCommit({}), null);
});

test('fails closed before network access when provider configuration is missing', async () => {
  let fetched = false;
  const outcome = await runReleaseCheck({}, async () => {
    fetched = true;
    throw new Error('unexpected request');
  });

  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.error, 'Missing required environment: VERCEL_TOKEN');
  assert.equal(fetched, false);
});
