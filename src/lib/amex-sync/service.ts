import { type AmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  amexDestinationAuthorityRowDigest,
  isGloballyAuthorizedAmexCard,
  planAmexSync,
  syncIdempotencyKey,
  type AmexSyncPlan,
} from "./authority";
import {
  amexSyncProposalAuthorityRowDigest,
  createAmexSyncProposal,
  digestAmexSyncProposalIdentities,
  verifyAmexSyncProposal,
} from "./proposal";
import {
  applyAmexSyncGroup,
  applyAmexSyncRow,
  completeAmexSyncAttempt,
  createAmexSyncAttempt,
  findAmexSyncAttempt,
  loadAmexSyncDestinationContext,
  recordCurrentAmexSyncRow,
  recordFailedAmexSyncRow,
  recordNonAppliedAmexSyncRow,
  type StoredRowResult,
} from "./repository";

export interface PublicAmexSyncRowResult {
  sourceRowIdentity: string;
  atomicGroupIdentity: string;
  sourceLocalCardId: string;
  productKey: string;
  creditFamilyKey: string;
  disposition: "proposed" | "updated" | "unchanged" | "skipped" | "failed";
  reason: string;
  destinationCardId: string | null;
  before: AmexSyncPlan["rows"][number]["before"];
  after: AmexSyncPlan["rows"][number]["after"];
  changes: AmexSyncPlan["rows"][number]["changes"];
}

function publicPreviewRows(plan: AmexSyncPlan): PublicAmexSyncRowResult[] {
  return plan.rows.map((row) => ({
    sourceRowIdentity: row.sourceRowIdentity,
    atomicGroupIdentity: row.atomicGroupIdentity,
    sourceLocalCardId: row.sourceLocalCardId,
    productKey: row.productKey,
    creditFamilyKey: row.creditFamilyKey,
    disposition: row.disposition,
    reason: row.reason,
    destinationCardId: row.destinationCardId,
    before: row.before,
    after: row.after,
    changes: row.changes,
  }));
}

export interface AmexSyncCardSkip {
  destinationCardId: string;
  reason: "destination_last_five_required";
  label: string;
  editHref: string;
}

function missingLastFiveCardSkips(context: Awaited<ReturnType<typeof loadAmexSyncDestinationContext>>, userId: string): AmexSyncCardSkip[] {
  return context.cards
    .filter((card) => card.userId === userId
      && isGloballyAuthorizedAmexCard(card)
      && !/^\d{5}$/.test(card.lastFourDigits ?? ""))
    .map((card) => ({
      destinationCardId: card.id,
      reason: "destination_last_five_required" as const,
      label: (card.displayName?.trim() || "American Express card").slice(0, 200),
      editHref: `/cards/${encodeURIComponent(card.id)}/edit#lastFourDigits`,
    }))
    .sort((left, right) => left.destinationCardId.localeCompare(right.destinationCardId));
}

export async function previewAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  mode: "preview" | "write";
  hmacKey: string;
  now?: Date;
}): Promise<{
  mode: "preview" | "write";
  rows: PublicAmexSyncRowResult[];
  proposalToken: string;
  proposalExpiresAt: string;
  cardSkips: AmexSyncCardSkip[];
}> {
  const now = input.now ?? new Date();
  const context = await loadAmexSyncDestinationContext(input.userId);
  const plan = planAmexSync({
    envelope: input.envelope,
    context,
    userId: input.userId,
    now,
    transitionTime: now,
  });
  const proposal = createAmexSyncProposal({
    userId: input.userId,
    mode: input.mode,
    plan,
    key: input.hmacKey,
    now,
    scanFinishedAt: input.envelope.scanFinishedAt,
  });
  return {
    mode: input.mode,
    rows: publicPreviewRows(plan),
    proposalToken: proposal.token,
    proposalExpiresAt: proposal.body.expiresAt,
    cardSkips: missingLastFiveCardSkips(context, input.userId),
  };
}

function failedStoredResult(
  row: AmexSyncPlan["rows"][number],
  reasonCode: "conflict_repreview_required" | "persistence_failed",
): StoredRowResult {
  return {
    sourceRowIdentity: row.sourceRowIdentity,
    disposition: "FAILED",
    reasonCode,
    destinationCardId: row.destinationCardId,
    beforeUsedAmount: row.before?.usedAmount ?? null,
    beforeIsCompleted: row.before?.isCompleted ?? null,
    beforeCompletedAt: row.before?.completedAt ?? null,
    beforeIsNotUsable: row.before?.isNotUsable ?? null,
    afterUsedAmount: row.after?.usedAmount ?? null,
    afterIsCompleted: row.after?.isCompleted ?? null,
    afterCompletedAt: row.after?.completedAt ?? null,
    afterIsNotUsable: row.after?.isNotUsable ?? null,
  };
}

function storedStatusProjection(
  result: StoredRowResult,
  prefix: "before" | "after",
): AmexSyncPlan["rows"][number]["before"] {
  const usedAmount = prefix === "before" ? result.beforeUsedAmount : result.afterUsedAmount;
  const isCompleted = prefix === "before" ? result.beforeIsCompleted : result.afterIsCompleted;
  const completedAt = prefix === "before" ? result.beforeCompletedAt : result.afterCompletedAt;
  const isNotUsable = prefix === "before" ? result.beforeIsNotUsable : result.afterIsNotUsable;
  if (usedAmount === null && isCompleted === null && completedAt === null && isNotUsable === null) return null;
  if (usedAmount === null || isCompleted === null || isNotUsable === null) {
    throw new Error("conflict_repreview_required");
  }
  const completedAtInstant = completedAt === null
    ? null
    : completedAt instanceof Date
      ? completedAt.toISOString()
      : new Date(completedAt).toISOString();
  return {
    usedAmount: Number(usedAmount),
    isCompleted,
    completedAt: completedAtInstant,
    isNotUsable,
  };
}

function replayResults(
  plan: AmexSyncPlan,
  stored: StoredRowResult[],
): PublicAmexSyncRowResult[] {
  const byIdentity = new Map(stored.map((result) => [result.sourceRowIdentity, result]));
  return plan.rows.map((row) => {
    const result = byIdentity.get(row.sourceRowIdentity);
    if (!result) throw new Error("conflict_repreview_required");
    const disposition = result.disposition === "UPDATED"
      ? "updated"
      : result.disposition === "UNCHANGED"
        ? "unchanged"
        : result.disposition === "FAILED"
          ? "failed"
          : "skipped";
    const before = storedStatusProjection(result, "before");
    const after = storedStatusProjection(result, "after");
    return {
      sourceRowIdentity: row.sourceRowIdentity,
      atomicGroupIdentity: row.atomicGroupIdentity,
      sourceLocalCardId: row.sourceLocalCardId,
      productKey: row.productKey,
      creditFamilyKey: row.creditFamilyKey,
      disposition,
      reason: result.reasonCode,
      destinationCardId: result.destinationCardId,
      before,
      after,
      changes: {
        amountDecrease: before !== null && after !== null && after.usedAmount < before.usedAmount,
        amountIncrease: before !== null && after !== null && after.usedAmount > before.usedAmount,
        completionSet: before !== null && after !== null && !before.isCompleted && after.isCompleted,
        completionCleared: before !== null && after !== null && before.isCompleted && !after.isCompleted,
      },
    };
  });
}

function replayCompletedAttempt(
  plan: AmexSyncPlan,
  attempt: { id: string; rowAudits: StoredRowResult[] },
) {
  const auditedIdentities = new Set(attempt.rowAudits.map((row) => row.sourceRowIdentity));
  if (attempt.rowAudits.length !== plan.rows.length
    || auditedIdentities.size !== plan.rows.length
    || plan.rows.some((row) => !auditedIdentities.has(row.sourceRowIdentity))) {
    throw new Error("conflict_repreview_required");
  }
  const rows = replayResults(plan, attempt.rowAudits);
  return {
    attemptId: attempt.id,
    replayed: true as const,
    rows,
    updatedCount: rows.filter((row) => row.disposition === "updated").length,
  };
}

function proposalMatchesRowIdentities(
  proposal: ReturnType<typeof verifyAmexSyncProposal>,
  plan: AmexSyncPlan,
): boolean {
  return proposal.envelopeDigest === plan.envelopeDigest
    && proposal.rowCount === plan.rows.length
    && proposal.sourceRowIdentitiesDigest === digestAmexSyncProposalIdentities(
      plan.rows.map((row) => row.sourceRowIdentity),
    )
    && proposal.atomicGroupIdentitiesDigest === digestAmexSyncProposalIdentities(
      plan.rows.map((row) => row.atomicGroupIdentity),
    );
}

function proposalMatchesPlan(
  proposal: ReturnType<typeof verifyAmexSyncProposal>,
  plan: AmexSyncPlan,
): boolean {
  return proposalMatchesRowIdentities(proposal, plan)
    && proposal.rowCount === plan.rows.length
    && proposal.destinationAuthorityDigest === plan.destinationAuthorityDigest
    && proposal.beforeStateDigest === plan.beforeStateDigest;
}

function proposalMatchesRetryablePlan(
  proposal: ReturnType<typeof verifyAmexSyncProposal>,
  plan: AmexSyncPlan,
  stored: StoredRowResult[],
): boolean {
  if (proposal.rowCount !== plan.rows.length) return false;
  const terminalIdentities = new Set(
    stored
      .filter((result) => result.disposition !== "FAILED")
      .map((result) => result.sourceRowIdentity),
  );
  return plan.rows.every((row, index) => terminalIdentities.has(row.sourceRowIdentity)
    || amexSyncProposalAuthorityRowDigest(proposal, index) === amexDestinationAuthorityRowDigest(row));
}

export async function confirmAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  proposalToken: string;
  hmacKey: string;
  now?: Date;
}): Promise<{
  attemptId: string;
  replayed: boolean;
  rows: PublicAmexSyncRowResult[];
  updatedCount: number;
}> {
  const now = input.now ?? new Date();
  const proposal = verifyAmexSyncProposal({
    token: input.proposalToken,
    key: input.hmacKey,
    userId: input.userId,
    expectedMode: "write",
    now,
  });
  const context = await loadAmexSyncDestinationContext(input.userId);
  const plan = planAmexSync({
    envelope: input.envelope,
    context,
    userId: input.userId,
    now,
    transitionTime: new Date(proposal.transitionTime),
  });
  // A completed attempt necessarily changed destination state/provenance, so its
  // original authority digest no longer matches a fresh plan. Authenticate the
  // exact envelope and ordered row/group identities first, then return the durable
  // result before applying the confirmation-time drift checks used by new/retry
  // writes. This keeps completed replay idempotent without allowing a changed
  // envelope or changed row expansion to bypass proposal binding.
  if (!proposalMatchesRowIdentities(proposal, plan)) throw new Error("conflict_repreview_required");

  const idempotencyKey = syncIdempotencyKey(input.userId, plan);
  const existing = await findAmexSyncAttempt(input.userId, idempotencyKey);
  if (existing?.state === "COMPLETED") return replayCompletedAttempt(plan, existing);
  const proposalMatches = existing
    ? proposalMatchesRetryablePlan(proposal, plan, existing.rowAudits)
    : proposalMatchesPlan(proposal, plan);
  if (!proposalMatches) throw new Error("conflict_repreview_required");

  let attemptId = existing?.id;
  if (!attemptId) {
    try {
      attemptId = (await createAmexSyncAttempt({
        userId: input.userId,
        idempotencyKey,
        envelopeDigest: plan.envelopeDigest,
        confirmedAt: now,
        expiresAt: new Date(proposal.expiresAt),
      })).id;
    } catch {
      const raced = await findAmexSyncAttempt(input.userId, idempotencyKey);
      if (!raced) throw new Error("attempt_unavailable");
      if (raced.state === "COMPLETED") return replayCompletedAttempt(plan, raced);
      attemptId = raced.id;
    }
  }

  const results: StoredRowResult[] = [];
  const groups = new Map<string, AmexSyncPlan["rows"]>();
  plan.rows.forEach((row) => {
    const group = groups.get(row.atomicGroupIdentity) ?? [];
    group.push(row);
    groups.set(row.atomicGroupIdentity, group);
  });
  for (const groupRows of Array.from(groups.values())) {
    const isAtomicWriteGroup = groupRows.length > 1 && groupRows.every((row) =>
      row.disposition === "proposed" || (row.disposition === "unchanged" && row.reason === "already_current"));
    if (isAtomicWriteGroup) {
      try {
        results.push(...await applyAmexSyncGroup({ attemptId, userId: input.userId, rows: groupRows }));
      } catch (error) {
        const reason = error instanceof Error && error.message === "conflict_repreview_required"
          ? "conflict_repreview_required" as const
          : "persistence_failed" as const;
        for (const row of groupRows) {
          try {
            results.push(await recordFailedAmexSyncRow(attemptId, row, reason));
          } catch {
            results.push(failedStoredResult(row, reason));
          }
        }
      }
      continue;
    }

    for (const row of groupRows) {
      try {
        if (row.disposition === "skipped" || row.reason === "unchanged_replay") {
          results.push(await recordNonAppliedAmexSyncRow(attemptId, row));
        } else {
          results.push(row.disposition === "proposed"
            ? await applyAmexSyncRow({ attemptId, userId: input.userId, row })
            : await recordCurrentAmexSyncRow({ attemptId, userId: input.userId, row }));
        }
      } catch (error) {
        const reason = error instanceof Error && error.message === "conflict_repreview_required"
          ? "conflict_repreview_required" as const
          : "persistence_failed" as const;
        try {
          results.push(await recordFailedAmexSyncRow(attemptId, row, reason));
        } catch {
          results.push(failedStoredResult(row, reason));
        }
      }
    }
  }
  await completeAmexSyncAttempt(attemptId, results, now);
  const rows = replayResults(plan, results);
  return { attemptId, replayed: false, rows, updatedCount: rows.filter((row) => row.disposition === "updated").length };
}
