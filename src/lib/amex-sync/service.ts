import { type AmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  planAmexSync,
  syncIdempotencyKey,
  type AmexSyncPlan,
} from "./authority";
import { createAmexSyncProposal, verifyAmexSyncProposal } from "./proposal";
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
      && card.issuer === "American Express"
      && card.lifecycleStatus === "ACTIVE"
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

function replayResults(
  plan: AmexSyncPlan,
  stored: StoredRowResult[],
): PublicAmexSyncRowResult[] {
  const byIdentity = new Map(stored.map((result) => [result.sourceRowIdentity, result]));
  return plan.rows.map((row) => {
    const result = byIdentity.get(row.sourceRowIdentity);
    const disposition = result?.disposition === "UPDATED"
      ? "updated"
      : result?.disposition === "UNCHANGED"
        ? "unchanged"
        : result?.disposition === "FAILED"
          ? "failed"
          : "skipped";
    return {
      sourceRowIdentity: row.sourceRowIdentity,
      atomicGroupIdentity: row.atomicGroupIdentity,
      sourceLocalCardId: row.sourceLocalCardId,
      productKey: row.productKey,
      creditFamilyKey: row.creditFamilyKey,
      disposition,
      reason: result?.reasonCode ?? "persistence_failed",
      destinationCardId: row.destinationCardId,
      before: row.before,
      after: row.after,
      changes: row.changes,
    };
  });
}

function proposalMatchesPlan(
  proposal: ReturnType<typeof verifyAmexSyncProposal>,
  plan: AmexSyncPlan,
): boolean {
  return proposal.envelopeDigest === plan.envelopeDigest
    && proposal.beforeStateDigest === plan.beforeStateDigest
    && proposal.sourceRowIdentities.length === plan.rows.length
    && proposal.atomicGroupIdentities.length === plan.rows.length
    && proposal.sourceRowIdentities.every((identity, index) => identity === plan.rows[index].sourceRowIdentity)
    && proposal.atomicGroupIdentities.every((identity, index) => identity === plan.rows[index].atomicGroupIdentity);
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
  if (!proposalMatchesPlan(proposal, plan)) throw new Error("conflict_repreview_required");

  const idempotencyKey = syncIdempotencyKey(input.userId, plan);
  const existing = await findAmexSyncAttempt(input.userId, idempotencyKey);
  if (existing?.state === "COMPLETED") {
    const rows = replayResults(plan, existing.rowAudits);
    return { attemptId: existing.id, replayed: true, rows, updatedCount: rows.filter((row) => row.disposition === "updated").length };
  }

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
      if (raced.state === "COMPLETED") {
        const rows = replayResults(plan, raced.rowAudits);
        return { attemptId: raced.id, replayed: true, rows, updatedCount: rows.filter((row) => row.disposition === "updated").length };
      }
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
            results.push({ sourceRowIdentity: row.sourceRowIdentity, disposition: "FAILED", reasonCode: reason });
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
          results.push({ sourceRowIdentity: row.sourceRowIdentity, disposition: "FAILED", reasonCode: reason });
        }
      }
    }
  }
  await completeAmexSyncAttempt(attemptId, results, now);
  const rows = replayResults(plan, results);
  return { attemptId, replayed: false, rows, updatedCount: rows.filter((row) => row.disposition === "updated").length };
}
