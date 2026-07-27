import type { AmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import {
  canonicalManualMappings,
  planAmexSync,
  syncIdempotencyKey,
  type AmexSyncPlan,
  type ManualCardSelection,
} from "./authority";
import { createAmexSyncProposal, verifyAmexSyncProposal } from "./proposal";
import {
  applyAmexSyncRow,
  completeAmexSyncAttempt,
  createAmexSyncAttempt,
  findAmexSyncAttempt,
  loadAmexSyncDestinationContext,
  recordCurrentAmexSyncRow,
  recordFailedAmexSyncRow,
  recordNonAppliedAmexSyncRow,
  saveConfirmedManualMappings,
  type StoredRowResult,
} from "./repository";

export interface PublicAmexSyncRowResult {
  sourceRowIdentity: string;
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

export async function previewAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  manualMappings: ManualCardSelection[];
  mode: "preview" | "write";
  hmacKey: string;
  now?: Date;
}): Promise<{
  mode: "preview" | "write";
  rows: PublicAmexSyncRowResult[];
  proposalToken: string;
  proposalExpiresAt: string;
  mappingOptions: Array<{ id: string; productKey: string; label: string }>;
}> {
  const now = input.now ?? new Date();
  const context = await loadAmexSyncDestinationContext(input.userId);
  const plan = planAmexSync({
    envelope: input.envelope,
    context,
    manualMappings: input.manualMappings,
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
    mappingOptions: context.cards
      .filter((card) => card.userId === input.userId && card.lifecycleStatus === "ACTIVE" && card.productKey)
      .map((card) => ({
        id: card.id,
        productKey: card.productKey as string,
        label: `${card.displayName ?? "Card"}${card.lastFourDigits ? ` ending ${card.lastFourDigits}` : ""}`,
      })),
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
    && proposal.manualMappingsDigest === plan.manualMappingsDigest
    && proposal.beforeStateDigest === plan.beforeStateDigest
    && proposal.sourceRowIdentities.length === plan.rows.length
    && proposal.sourceRowIdentities.every((identity, index) => identity === plan.rows[index].sourceRowIdentity);
}

export async function confirmAmexSync(input: {
  userId: string;
  envelope: AmexSyncEnvelope;
  manualMappings: ManualCardSelection[];
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
    manualMappings: input.manualMappings,
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

  const validSelectedCards = new Set(plan.rows
    .filter((row) => row.destinationCardId && row.disposition !== "skipped")
    .map((row) => `${row.sourceLocalCardId}:${row.destinationCardId}`));
  const selections = canonicalManualMappings(input.manualMappings).filter((selection) =>
    validSelectedCards.has(`${selection.sourceLocalCardId}:${selection.destinationCardId}`));
  await saveConfirmedManualMappings({
    userId: input.userId,
    selections,
    productKeyBySourceCard: new Map(input.envelope.cards.map((card) => [card.sourceLocalCardId, card.productKey])),
    endingBySourceCard: new Map(input.envelope.cards.map((card) => [card.sourceLocalCardId, card.endingDigits])),
  });

  const results: StoredRowResult[] = [];
  for (const row of plan.rows) {
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
  await completeAmexSyncAttempt(attemptId, results, now);
  const rows = replayResults(plan, results);
  return { attemptId, replayed: false, rows, updatedCount: rows.filter((row) => row.disposition === "updated").length };
}
