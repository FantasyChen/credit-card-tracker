"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { z } from "zod";
import {
  AMEX_SYNC_HANDOFF_PATH,
  resolveAmexSyncHandoffTargetForOrigin,
} from "@/lib/amex-benefit-reader/handoff-target";
import { handoffPayloadMessageSchema } from "@/lib/amex-benefit-reader/sync-mailbox";
import {
  AMEX_SYNC_MAX_ROWS,
  digestAmexSyncEnvelope,
  type AmexSyncEnvelope,
} from "@/lib/amex-benefit-reader/sync-contract";
import {
  amexProductKeySchema,
  creditFamilyKeySchema,
} from "@/lib/amex-benefit-reader/contract";
import type { AmexSyncMode } from "@/lib/amex-sync/mode";
import {
  formatAmexBenefitTitle,
  formatAmexSourcePeriod,
} from "@/lib/amex-benefit-reader/presentation";
import { Button } from "@/components/ui/button";
import styles from "./AmexSyncHandoffClient.module.css";

const statusProjectionSchema = z.object({
  usedAmount: z.number().finite().nonnegative(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  isNotUsable: z.boolean(),
}).strict();

const nonAppliedReasonSchema = z.enum([
  "stale_replay",
  "source_conflict",
  "scan_expired",
  "product_not_allowlisted",
  "credit_family_not_allowlisted",
  "source_evidence_mismatch",
  "source_mapping_ambiguous",
  "source_last_five_required",
  "destination_last_five_required",
  "destination_card_missing",
  "ambiguous_card",
  "mapping_invalid",
  "destination_key_missing",
  "destination_benefit_missing",
  "destination_benefit_ambiguous",
  "destination_status_missing",
  "destination_status_ambiguous",
  "period_not_structured",
  "period_not_current",
  "period_key_mismatch",
  "enrollment_required",
  "linking_required",
  "status_unavailable",
  "amount_incompatible",
  "completion_conflict",
  "destination_not_usable",
]);

const syncRowResultFields = {
  sourceRowIdentity: z.string().regex(/^[a-f0-9]{64}$/),
  atomicGroupIdentity: z.string().regex(/^[a-f0-9]{64}$/),
  sourceLocalCardId: z.string().uuid(),
  productKey: amexProductKeySchema,
  creditFamilyKey: creditFamilyKeySchema,
  destinationCardId: z.string().min(1).max(128).nullable(),
  before: statusProjectionSchema.nullable(),
  after: statusProjectionSchema.nullable(),
  changes: z.object({
    amountDecrease: z.boolean(),
    amountIncrease: z.boolean(),
    completionSet: z.boolean(),
    completionCleared: z.boolean(),
  }).strict(),
};

const previewSyncRowResultSchema = z.discriminatedUnion("disposition", [
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("proposed"),
    reason: z.literal("proposed_update"),
  }).strict(),
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("unchanged"),
    reason: z.enum(["already_current", "unchanged_replay"]),
  }).strict(),
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("skipped"),
    reason: nonAppliedReasonSchema,
  }).strict(),
]);

const confirmationSyncRowResultSchema = z.discriminatedUnion("disposition", [
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("updated"),
    reason: z.literal("proposed_update"),
  }).strict(),
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("unchanged"),
    reason: z.enum(["already_current", "unchanged_replay"]),
  }).strict(),
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("skipped"),
    reason: nonAppliedReasonSchema,
  }).strict(),
  z.object({
    ...syncRowResultFields,
    disposition: z.literal("failed"),
    reason: z.enum(["conflict_repreview_required", "persistence_failed"]),
  }).strict(),
]);

type SyncRowResult =
  | z.infer<typeof previewSyncRowResultSchema>
  | z.infer<typeof confirmationSyncRowResultSchema>;
type StatusProjection = z.infer<typeof statusProjectionSchema>;

const previewResponseSchema = z.object({
  mode: z.enum(["preview", "write"]),
  rows: z.array(previewSyncRowResultSchema).max(AMEX_SYNC_MAX_ROWS),
  proposalToken: z.string().min(1).max(16_384),
  proposalExpiresAt: z.string().datetime({ offset: true }),
  cardSkips: z.array(z.object({
    destinationCardId: z.string().min(1).max(128),
    reason: z.literal("destination_last_five_required"),
    label: z.string().min(1).max(200),
    editHref: z.string().regex(/^\/cards\/[A-Za-z0-9_-]{1,128}\/edit#lastFourDigits$/),
  }).strict()).max(AMEX_SYNC_MAX_ROWS),
}).strict();
type PreviewResponse = z.infer<typeof previewResponseSchema>;

const confirmationResponseSchema = z.object({
  attemptId: z.string().min(1).max(128),
  replayed: z.boolean(),
  rows: z.array(confirmationSyncRowResultSchema).max(AMEX_SYNC_MAX_ROWS),
  updatedCount: z.number().int().nonnegative().max(AMEX_SYNC_MAX_ROWS),
}).strict().superRefine((response, context) => {
  const actualUpdatedCount = response.rows.filter((row) => row.disposition === "updated").length;
  if (response.updatedCount !== actualUpdatedCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedCount"],
      message: "Updated count must match the final row dispositions.",
    });
  }
});
type ConfirmationResponse = z.infer<typeof confirmationResponseSchema>;

type HandoffState =
  | "waiting"
  | "previewing"
  | "preview"
  | "confirming"
  | "result"
  | "invalid";

function reasonText(reason: string, disposition?: SyncRowResult["disposition"]): string {
  const labels: Record<string, string> = {
    proposed_update: "Ready to update",
    already_current: "Already current",
    unchanged_replay: "Already applied from this observation",
    stale_replay: "A newer Amex observation was already applied",
    source_conflict: "Conflicts with an equally recent observation",
    scan_expired: "The reviewed scan expired",
    product_not_allowlisted: "This card product is not enabled for sync",
    credit_family_not_allowlisted: "This benefit is not enabled for sync",
    source_evidence_mismatch: "The provider evidence did not independently resolve to this benefit",
    source_mapping_ambiguous: "More than one source row claimed the same reviewed benefit",
    source_last_five_required: "The Amex observation did not expose exactly five ending digits",
    destination_last_five_required: "Add exactly five ending digits to this Perks Reminder card",
    destination_card_missing: "No owned active Amex card matched this product and exact last five",
    ambiguous_card: "More than one exact card match was found",
    mapping_invalid: "The destination card identity is no longer valid",
    destination_key_missing: "The destination card is missing reviewed sync keys",
    destination_benefit_missing: "No exact destination benefit was found",
    destination_benefit_ambiguous: "More than one destination benefit matched",
    destination_status_missing: "No exact current benefit period was found",
    destination_status_ambiguous: "More than one current benefit period matched",
    period_not_structured: "Amex did not expose an exact period",
    period_not_current: "The Amex period is not the current period",
    period_key_mismatch: "The period does not match the destination benefit",
    enrollment_required: "Enrollment is required first",
    linking_required: "Card linking is required first",
    status_unavailable: "Amex did not expose enough status information",
    amount_incompatible: "The amount is not a supported USD value",
    completion_conflict: "Amount and completion status conflict",
    destination_not_usable: "This benefit was marked not usable",
    conflict_repreview_required: "Your saved data changed; preview again",
    persistence_failed: "This row could not be saved",
  };
  if (reason === "proposed_update" && disposition === "updated") return "Updated";
  return labels[reason] ?? "Skipped safely";
}

function familyLabel(key: string): string {
  const family = key.slice(key.lastIndexOf(":") + 1);
  return family.charAt(0).toUpperCase() + family.slice(1);
}

function dispositionLabel(disposition: SyncRowResult["disposition"]): string {
  const labels: Record<SyncRowResult["disposition"], string> = {
    proposed: "Proposed",
    updated: "Updated",
    unchanged: "Current",
    skipped: "Skipped",
    failed: "Failed",
  };
  return labels[disposition];
}

function exclusionText(reason: AmexSyncEnvelope["exclusions"][number]["reason"]): string {
  const labels: Record<typeof reason, string> = {
    v1_only: "Older local observation format; run a fresh scan",
    older_scan: "Observation from an older scan",
    stale: "Stale observation preserved after a scan error",
    partial: "Partial card observation",
    failed: "Card observation unavailable after a scan error",
    not_attempted_successfully: "Card was not completed in the latest scan",
    no_structured_period: "Exact source period was not exposed",
    prerequisite_only: "Enrollment or linking is still required",
    status_unavailable: "Usable source status was not exposed",
    source_mapping_ambiguous: "More than one source row mapped to the same reviewed benefit",
    source_last_five_required: "The source card did not expose exactly five ending digits",
  };
  return labels[reason];
}

function amount(value: StatusProjection | null): string {
  return value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.usedAmount) : "—";
}

interface RowContext {
  cardKey: string;
  cardLabel: string;
  title: string;
  period: string | null;
}

const PLATINUM_UBER_FAMILY = "american-express-platinum-card:uber-cash";
const PLATINUM_UBER_DECEMBER_BONUS_FAMILY = `${PLATINUM_UBER_FAMILY}-december-bonus`;

function resolveRowContext(envelope: AmexSyncEnvelope, row: SyncRowResult): RowContext {
  const card = envelope.cards.find((candidate) => candidate.sourceLocalCardId === row.sourceLocalCardId);
  if (!card) {
    return {
      cardKey: row.sourceLocalCardId,
      cardLabel: "Amex card",
      title: familyLabel(row.creditFamilyKey),
      period: null,
    };
  }
  const source = card.rows.find((candidate) =>
    candidate.creditFamilyKey === row.creditFamilyKey
    || (
      row.creditFamilyKey === PLATINUM_UBER_DECEMBER_BONUS_FAMILY
      && candidate.creditFamilyKey === PLATINUM_UBER_FAMILY
    ));
  return {
    cardKey: card.sourceLocalCardId,
    cardLabel: `${card.providerProductName} ••••• ${card.endingDigits}`,
    title: source ? formatAmexBenefitTitle(source.providerTitle) : familyLabel(row.creditFamilyKey),
    period: source?.sourcePeriod ? formatAmexSourcePeriod(source.sourcePeriod) : null,
  };
}

function RowCard({ row, context }: { row: SyncRowResult; context: RowContext }) {
  const warning = row.changes.amountDecrease || row.changes.completionCleared;
  return (
    <li className={styles.row} data-disposition={row.disposition}>
      <div className={styles.rowTop}>
        <div>
          <h4 className={styles.benefitTitle}>{context.title}</h4>
          {context.period && <p className={styles.period}>{context.period}</p>}
          <p className={styles.reason}>{reasonText(row.reason, row.disposition)}</p>
        </div>
        <span className={styles.badge} data-disposition={row.disposition}>
          {dispositionLabel(row.disposition)}
        </span>
      </div>
      {row.before && row.after && (
        <dl className={styles.comparison}>
          <div><dt>Amount used</dt><dd>{amount(row.before)} → {amount(row.after)}</dd></div>
          <div><dt>Completed</dt><dd>{row.before.isCompleted ? "Yes" : "No"} → {row.after.isCompleted ? "Yes" : "No"}</dd></div>
        </dl>
      )}
      {warning && (
        <p className={styles.warning}>
          <ExclamationTriangleIcon aria-hidden="true" />
          {row.changes.amountDecrease && row.changes.completionCleared
            ? "This newer Amex observation decreases the amount and clears completion."
            : row.changes.amountDecrease
              ? "This newer Amex observation decreases the saved amount, such as after a refund."
              : "This newer Amex observation clears completion."}
        </p>
      )}
    </li>
  );
}

function RowGroups({ rows, envelope }: { rows: SyncRowResult[]; envelope: AmexSyncEnvelope }) {
  const groups = rows.reduce<Array<{ cardKey: string; cardLabel: string; rows: Array<{ row: SyncRowResult; context: RowContext }> }>>(
    (current, row) => {
      const context = resolveRowContext(envelope, row);
      let group = current.find((candidate) => candidate.cardKey === context.cardKey);
      if (!group) {
        group = { cardKey: context.cardKey, cardLabel: context.cardLabel, rows: [] };
        current.push(group);
      }
      group.rows.push({ row, context });
      return current;
    },
    [],
  );
  return (
    <div className={styles.cardGroups}>
      {groups.map((group) => (
        <section className={styles.cardGroup} key={group.cardKey} aria-label={group.cardLabel}>
          <h3 className={styles.cardHeading}>{group.cardLabel}</h3>
          <ul className={styles.rowList}>
            {group.rows.map(({ row, context }) => <RowCard key={row.sourceRowIdentity} row={row} context={context} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function proposalFreshness(expiresAt: string, now: number) {
  const remainingMs = Date.parse(expiresAt) - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { label: "Preview expired", urgent: true, expired: true, remainingMs: 0 };
  }
  if (remainingMs > 120_000) {
    const minutes = Math.ceil(remainingMs / 60_000);
    return { label: `Ready · ${minutes} min left`, urgent: false, expired: false, remainingMs };
  }
  const seconds = Math.ceil(remainingMs / 1_000);
  return {
    label: `Expires soon · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`,
    urgent: true,
    expired: false,
    remainingMs,
  };
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; value: unknown }> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let value: unknown = null;
  try { value = await response.json(); } catch { /* A malformed response fails closed below. */ }
  return { ok: response.ok, status: response.status, value };
}

function rowsBelongToEnvelope(envelope: AmexSyncEnvelope, rows: SyncRowResult[]): boolean {
  const cardIds = new Set(envelope.cards.map((card) => card.sourceLocalCardId));
  return rows.every((row) => cardIds.has(row.sourceLocalCardId));
}

export function AmexSyncHandoffClient({
  transferId,
  initialMode,
}: {
  transferId: string | null;
  initialMode: AmexSyncMode;
}) {
  const [state, setState] = useState<HandoffState>(transferId ? "waiting" : "invalid");
  const [message, setMessage] = useState(transferId ? "Waiting for the local Amex reader…" : "This handoff link is missing or invalid.");
  const [envelope, setEnvelope] = useState<AmexSyncEnvelope | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ConfirmationResponse | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const acceptedPayload = useRef(false);
  const actionInFlight = useRef(false);

  const runPreview = useCallback(async (nextEnvelope: AmexSyncEnvelope): Promise<boolean> => {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setResult(null);
    setState("previewing");
    setMessage("Checking exact card, benefit, period, and last-five matches…");
    try {
      const response = await postJson("/api/integrations/amex-sync/preview", { envelope: nextEnvelope });
      const parsed = previewResponseSchema.safeParse(response.value);
      if (!response.ok || !parsed.success || !rowsBelongToEnvelope(nextEnvelope, parsed.data.rows)) {
        setState("invalid");
        setMessage(response.status === 503
          ? "Amex sync is currently turned off. No data was changed."
          : "The reviewed handoff could not be previewed. Return to Amex, run a fresh scan, then choose Sync reviewed again.");
        return false;
      }
      setPreview(parsed.data);
      setState("preview");
      setMessage("Review every row and card prerequisite below. Nothing has been written.");
      return true;
    } catch {
      setState("invalid");
      setMessage("The reviewed handoff could not be previewed. Return to Amex, run a fresh scan, then choose Sync reviewed again.");
      return false;
    } finally {
      actionInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!transferId) return;
    const handoffTarget = resolveAmexSyncHandoffTargetForOrigin(window.location.origin);
    if (!handoffTarget) {
      setState("invalid");
      setMessage("This Amex sync handoff is not available on the current origin.");
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active || acceptedPayload.current) return;
      setState("invalid");
      setMessage("The local handoff was not available. It may be expired or already consumed.");
    }, 15_000);

    const receivePayload = (event: MessageEvent<unknown>) => {
      if (!active || acceptedPayload.current || event.source !== window || event.origin !== handoffTarget.origin) return;
      const parsed = handoffPayloadMessageSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.transferId !== transferId) return;
      void (async () => {
        const digest = await digestAmexSyncEnvelope(parsed.data.envelope);
        if (!active || digest !== parsed.data.digest) {
          setState("invalid");
          setMessage("The local handoff failed its integrity check. No data was sent.");
          return;
        }
        acceptedPayload.current = true;
        window.clearTimeout(timeout);
        setEnvelope(parsed.data.envelope);
        window.history.replaceState(null, "", AMEX_SYNC_HANDOFF_PATH);
        if (initialMode === "off") {
          setState("invalid");
          setMessage("Amex sync is currently turned off. No data was changed.");
          return;
        }
        const previewAccepted = await runPreview(parsed.data.envelope);
        if (active && previewAccepted) {
          window.postMessage({
            type: "perks-reminder:amex-sync-accepted",
            transferId,
            nonce: parsed.data.nonce,
          }, handoffTarget.origin);
        }
      })().catch(() => {
        setState("invalid");
        setMessage("The local handoff could not be validated. No data was changed.");
      });
    };

    const announceReady = () => {
      if (!acceptedPayload.current) {
        window.postMessage({ type: "perks-reminder:amex-sync-ready", transferId }, handoffTarget.origin);
      }
    };
    window.addEventListener("message", receivePayload);
    announceReady();
    const readyInterval = window.setInterval(announceReady, 1_000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.clearInterval(readyInterval);
      window.removeEventListener("message", receivePayload);
    };
  }, [initialMode, runPreview, transferId]);

  useEffect(() => {
    if (!preview || state === "result" || state === "invalid") return;
    const freshness = proposalFreshness(preview.proposalExpiresAt, Date.now());
    if (freshness.expired) return;
    const timer = window.setTimeout(
      () => setClock(Date.now()),
      freshness.urgent ? Math.min(1_000, freshness.remainingMs) : Math.min(30_000, freshness.remainingMs - 120_000),
    );
    return () => window.clearTimeout(timer);
  }, [clock, preview, state]);

  const confirm = async () => {
    if (
      actionInFlight.current
      || !envelope
      || !preview
      || preview.mode !== "write"
      || state !== "preview"
      || Date.parse(preview.proposalExpiresAt) <= Date.now()
    ) return;
    actionInFlight.current = true;
    setState("confirming");
    setMessage("Applying each approved row independently…");
    try {
      const response = await postJson("/api/integrations/amex-sync/confirm", {
        envelope,
        proposalToken: preview.proposalToken,
      });
      if (response.status === 409) {
        setMessage("Your saved benefits changed after the preview. Creating a fresh preview now.");
        actionInFlight.current = false;
        await runPreview(envelope);
        return;
      }
      const parsed = confirmationResponseSchema.safeParse(response.value);
      if (!response.ok || !parsed.success || !rowsBelongToEnvelope(envelope, parsed.data.rows)) {
        setState("preview");
        setMessage("Confirmation failed safely. No unreported row is assumed to be updated. Retry only while this preview remains valid, or return to Amex and run a fresh scan.");
        return;
      }
      setResult(parsed.data);
      setState("result");
      setMessage(parsed.data.replayed
        ? "This exact confirmation was already processed. The recorded result is shown below."
        : `Sync finished. ${parsed.data.updatedCount} row${parsed.data.updatedCount === 1 ? "" : "s"} updated.`);
    } catch {
      setState("preview");
      setMessage("Confirmation failed safely. No unreported row is assumed to be updated. Retry only while this preview remains valid, or return to Amex and run a fresh scan.");
    } finally {
      actionInFlight.current = false;
    }
  };

  const refreshPreview = () => {
    if (!envelope || !preview || (state !== "preview" && state !== "result")) return;
    void runPreview(envelope);
  };

  const rows = result?.rows ?? preview?.rows ?? [];
  const hasProposedRows = rows.some((row) => row.disposition === "proposed");
  const proposedRows = rows.filter((row) => row.disposition === "proposed");
  const updatedRows = rows.filter((row) => row.disposition === "updated");
  const failedRows = rows.filter((row) => row.disposition === "failed");
  const unchangedRows = rows.filter((row) => row.disposition === "unchanged");
  const skippedRows = rows.filter((row) => row.disposition === "skipped");
  const primaryRows = result ? [...updatedRows, ...failedRows] : proposedRows;
  const freshness = preview ? proposalFreshness(preview.proposalExpiresAt, clock) : null;
  const exclusionCount = envelope?.exclusions.reduce((sum, exclusion) => sum + exclusion.count, 0) ?? 0;
  const heading = state === "result"
    ? failedRows.length > 0 ? "Sync finished with items to review" : "Benefit sync complete"
    : state === "preview" || state === "confirming"
      ? proposedRows.length > 0
        ? `Review ${proposedRows.length} benefit update${proposedRows.length === 1 ? "" : "s"}`
        : "Review sync details"
      : state === "invalid" ? "A fresh handoff is needed" : "Preparing your benefit review";
  const tone = state === "invalid" || failedRows.length > 0 || freshness?.expired
    ? "invalid"
    : state === "result" ? "complete"
      : preview?.cardSkips.length || freshness?.urgent ? "attention" : "ready";

  return (
    <main className={styles.shell} data-amex-sync-state={state}>
      <article className={styles.folio} data-tone={tone}>
        <header className={styles.hero}>
          <div className={styles.identity}>
            <span className={styles.mark}><ShieldCheckIcon aria-hidden="true" /></span>
            <div>
              <p className={styles.product}>American Express integration</p>
              <h1 className={styles.title}>{heading}</h1>
              <p className={styles.privacy}>
                Only reviewed, normalized observations arrive here. Your Amex login, cookies, account token, and raw responses stay out of Perks Reminder.
              </p>
            </div>
          </div>
          <p className={styles.statusLine} role="status" aria-live="polite" aria-atomic="true">
            <ShieldCheckIcon aria-hidden="true" />
            <span>{message}</span>
          </p>
        </header>

        {state !== "invalid" && (preview || result) && (
          <dl className={styles.summary} aria-label={state === "result" ? "Sync result summary" : "Sync preview summary"}>
            <div className={styles.metric}><dt>{result ? "Updated" : "Will update"}</dt><dd>{result ? updatedRows.length : proposedRows.length}</dd></div>
            <div className={styles.metric}><dt>Needs attention</dt><dd>{failedRows.length + (preview?.cardSkips.length ?? 0)}</dd></div>
            <div className={styles.metric}><dt>Already current</dt><dd>{unchangedRows.length}</dd></div>
            <div className={styles.metric}><dt>Skipped</dt><dd>{skippedRows.length}</dd></div>
            <div className={styles.metric}><dt>Local exclusions</dt><dd>{exclusionCount}</dd></div>
          </dl>
        )}

        <div className={styles.body}>
          {state !== "invalid" && <section className={styles.review} aria-labelledby="review-heading">
            <h2 className={styles.sectionHeading} id="review-heading">
              {result ? "Recorded outcomes" : "Updates to review"}
            </h2>
            <p className={styles.sectionCopy}>
              {result
                ? "Each row shows the final recorded outcome. Failed rows remain visible for follow-up."
                : "Card, benefit, and period context stay together so repeated credits are easy to distinguish."}
            </p>
            {freshness && state !== "result" && (
              <p
                className={styles.freshness}
                data-urgent={freshness.urgent}
                data-expired={freshness.expired}
              >
                {freshness.label}
              </p>
            )}

            {envelope && primaryRows.length > 0 && <RowGroups rows={primaryRows} envelope={envelope} />}
            {(state === "preview" || state === "result") && primaryRows.length === 0 && (
              <p className={styles.empty}>No eligible benefit updates need review.</p>
            )}

          </section>}

          {(state === "preview" || state === "confirming" || state === "result") && preview && (
            <aside className={styles.actionRail} aria-label="Sync action">
              {state === "result" && result ? (
                <>
                  <div className={styles.resultMark}><CheckCircleIcon aria-hidden="true" /><h2>{result.replayed ? "Result already recorded" : "Confirmation recorded"}</h2></div>
                  <p>{updatedRows.length} updated, {unchangedRows.length} unchanged, {skippedRows.length} skipped, and {failedRows.length} failed.</p>
                  <p>{failedRows.length > 0 ? "Review the failed rows and scan again when ready." : "The final row outcomes are shown beside this summary."}</p>
                </>
              ) : preview.mode === "write" ? (
                <>
                  <h2>Confirm separately</h2>
                  <p>Only the {proposedRows.length} proposed {proposedRows.length === 1 ? "row" : "rows"} can change. Unchanged and skipped benefits stay untouched.</p>
                  <Button
                    className={styles.confirm}
                    disabled={!hasProposedRows || state === "confirming" || freshness?.expired}
                    onClick={() => void confirm()}
                  >
                    {state === "confirming" ? "Applying updates…" : `Confirm ${proposedRows.length} update${proposedRows.length === 1 ? "" : "s"}`}
                  </Button>
                  <span className={styles.cancelCopy}>Close this page to cancel.</span>
                </>
              ) : (
                <>
                  <h2>Preview only</h2>
                  <p>Confirmation is disabled by the server. No writes can occur from this review.</p>
                </>
              )}
            </aside>
          )}

          <section className={styles.followup} aria-label="Additional sync details">
            {preview && preview.cardSkips.length > 0 && state !== "invalid" && (
              <section className={styles.attention} aria-labelledby="card-prerequisites-heading">
                <div className={styles.attentionHeader}>
                  <ExclamationTriangleIcon aria-hidden="true" />
                  <div>
                    <h2 className={styles.sectionHeading} id="card-prerequisites-heading">Card details needed</h2>
                    <p className={styles.sectionCopy}>Add exactly five ending digits to each card. Names and manual selections cannot bypass this identity check.</p>
                  </div>
                </div>
                <p id="card-edit-guidance" className={styles.sectionCopy}>
                  Each card opens in a new tab. Save it there, return here, then check the details again.
                </p>
                <ul className={styles.checklist}>
                  {preview.cardSkips.map((skip) => (
                    <li className={styles.checkItem} key={skip.destinationCardId}>
                      <span>{skip.label}</span>
                      <Link
                        href={skip.editHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Add five ending digits for ${skip.label}`}
                        aria-describedby="card-edit-guidance"
                      >
                        Add five ending digits
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  className={styles.checkAction}
                  disabled={!envelope || state === "previewing" || state === "confirming"}
                  onClick={refreshPreview}
                >
                  {state === "previewing" ? "Checking card details…" : state === "result" ? "Check again" : "Check card details"}
                </Button>
              </section>
            )}

            {state !== "invalid" && envelope && (
              <div className={styles.disclosures}>
                {unchangedRows.length > 0 && (
                  <details className={styles.details}>
                    <summary>Already current <span>{unchangedRows.length}</span></summary>
                    <div className={styles.detailsContent}><RowGroups rows={unchangedRows} envelope={envelope} /></div>
                  </details>
                )}
                {skippedRows.length > 0 && (
                  <details className={styles.details} open={primaryRows.length === 0}>
                    <summary>Skipped safely <span>{skippedRows.length}</span></summary>
                    <div className={styles.detailsContent}><RowGroups rows={skippedRows} envelope={envelope} /></div>
                  </details>
                )}
                {envelope.exclusions.length > 0 && (
                  <details className={styles.details}>
                    <summary>Not included from local scan <span>{exclusionCount}</span></summary>
                    <div className={styles.detailsContent}>
                      <p className={styles.sectionCopy}>These observations remain in the local reader but cannot be synchronized.</p>
                      <ul className={styles.exclusions}>
                        {envelope.exclusions.map((exclusion) => (
                          <li className={styles.exclusion} key={exclusion.reason}>
                            <span>{exclusionText(exclusion.reason)}</span>
                            <strong aria-label={`${exclusion.count} excluded`}>{exclusion.count}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )}
              </div>
            )}

            {(state === "invalid" || freshness?.expired) && (
              <p className={styles.recovery}>
                No benefit data was changed. Return to Amex, run a fresh scan, then choose <strong>Sync reviewed</strong> again.
              </p>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
