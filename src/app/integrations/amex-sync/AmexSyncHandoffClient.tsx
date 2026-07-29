"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
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
import { Button } from "@/components/ui/button";

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

function reasonText(reason: string): string {
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
  return labels[reason] ?? "Skipped safely";
}

function familyLabel(key: string): string {
  const family = key.slice(key.lastIndexOf(":") + 1);
  return family.charAt(0).toUpperCase() + family.slice(1);
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

function RowCard({ row }: { row: SyncRowResult }) {
  const warning = row.changes.amountDecrease || row.changes.completionCleared;
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/[0.03]" data-disposition={row.disposition}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{familyLabel(row.creditFamilyKey)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{reasonText(row.reason)}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">
          {row.disposition}
        </span>
      </div>
      {row.before && row.after && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Amount used</dt>
          <dd className="font-medium tabular-nums text-foreground">{amount(row.before)} → {amount(row.after)}</dd>
          <dt className="text-muted-foreground">Completed</dt>
          <dd className="font-medium text-foreground">{row.before.isCompleted ? "Yes" : "No"} → {row.after.isCompleted ? "Yes" : "No"}</dd>
        </dl>
      )}
      {warning && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
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
      if (!response.ok || !parsed.success) {
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

  const confirm = async () => {
    if (actionInFlight.current || !envelope || !preview || preview.mode !== "write" || state !== "preview") return;
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
      if (!response.ok || !parsed.success) {
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
  const counts = rows.reduce((current, row) => {
    current[row.disposition] = (current[row.disposition] ?? 0) + 1;
    return current;
  }, {} as Record<string, number>);
  const hasProposedRows = rows.some((row) => row.disposition === "proposed");

  return (
    <div className="mx-auto max-w-3xl" data-amex-sync-state={state}>
      <header className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-black/[0.03] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">American Express integration</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Review benefit sync</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The local reader shares only reviewed normalized observations. Perks Reminder never receives your Amex login, cookies, account token, or raw responses.
            </p>
          </div>
        </div>
        <p className="mt-5 rounded-xl border border-border bg-muted/50 p-4 text-sm text-foreground" role="status" aria-live="polite">
          {message}
        </p>
      </header>

      {envelope && envelope.exclusions.length > 0 && state !== "previewing" && state !== "invalid" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6" aria-labelledby="excluded-heading">
          <h2 id="excluded-heading" className="text-lg font-semibold text-foreground">Excluded local observations</h2>
          <p className="mt-2 text-sm text-muted-foreground">These observations remain available in the local reader but cannot be synchronized.</p>
          <ul className="mt-4 grid gap-2 text-sm text-foreground">
            {envelope.exclusions.map((exclusion) => (
              <li key={exclusion.reason} className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
                <span>{exclusionText(exclusion.reason)}</span>
                <span className="font-semibold tabular-nums" aria-label={`${exclusion.count} excluded`}>{exclusion.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview && preview.cardSkips.length > 0 && state !== "invalid" && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30" aria-labelledby="card-prerequisites-heading">
          <h2 id="card-prerequisites-heading" className="text-lg font-semibold text-foreground">Card details needed for Amex sync</h2>
          <p className="mt-2 text-sm text-muted-foreground">Exactly five ending digits are required. Card names and manual selections cannot bypass this identity check.</p>
          <p id="card-edit-guidance" className="mt-2 text-sm text-muted-foreground">
            Editing opens in a new tab. Save the card there, return to this page, then refresh the preview.
          </p>
          <ul className="mt-4 grid gap-3">
            {preview.cardSkips.map((skip) => (
              <li key={skip.destinationCardId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-background p-3 dark:border-amber-900">
                <span className="text-sm font-medium text-foreground">{skip.label}</span>
                <a
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  href={skip.editHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Add five ending digits for ${skip.label}`}
                  aria-describedby="card-edit-guidance"
                >
                  Add five ending digits
                </a>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={!envelope || state === "previewing" || state === "confirming"}
            onClick={refreshPreview}
          >
            {state === "previewing" ? "Refreshing preview…" : "Refresh after editing cards"}
          </Button>
        </section>
      )}

      {(state === "preview" || state === "confirming" || state === "result") && rows.length > 0 && (
        <section className="mt-6" aria-labelledby="rows-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="rows-heading" className="text-lg font-semibold text-foreground">Benefit rows</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {Object.entries(counts).map(([label, count]) => `${count} ${label}`).join(" · ")}
              </p>
            </div>
            {preview && <p className="text-xs text-muted-foreground">Preview expires {new Date(preview.proposalExpiresAt).toLocaleTimeString()}</p>}
          </div>
          <ul className="mt-4 grid gap-3">
            {rows.map((row) => <RowCard key={row.sourceRowIdentity} row={row} />)}
          </ul>
        </section>
      )}

      {state === "preview" && preview && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          {preview.mode === "write" ? (
            <>
              <h2 className="text-lg font-semibold text-foreground">Confirm separately</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Only rows marked proposed can change benefit status. Cards are matched by owned active Amex product and exact last five; there is no manual override. Unchanged and skipped benefit statuses remain untouched. You can close this page to cancel.
              </p>
              <Button className="mt-5" disabled={!hasProposedRows} onClick={() => void confirm()}>
                Confirm proposed updates
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Server mode is preview-only. Confirmation is disabled and no writes can occur.</p>
          )}
        </section>
      )}

      {state === "result" && result && (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CheckCircleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <div><h2 className="font-semibold">Confirmation recorded</h2><p className="mt-1 text-sm">Review row results above. Failed rows were isolated from successful rows.</p></div>
        </section>
      )}

      {state === "invalid" && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          No benefit data was changed. Return to Amex, run a fresh scan, then choose Sync reviewed again when ready.
        </section>
      )}
    </div>
  );
}
