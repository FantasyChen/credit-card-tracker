import { z } from "zod";
import {
  AMEX_SYNC_HANDOFF_PATH,
  PRODUCTION_AMEX_SYNC_HANDOFF_TARGET,
  resolveAmexSyncHandoffTarget,
  type AmexSyncHandoffTargetName,
} from "./handoff-target";
import {
  AMEX_SYNC_MAX_BYTES,
  amexSyncEnvelopeSchema,
  canonicalJson,
  digestAmexSyncEnvelope,
  parseAmexSyncEnvelope,
  type AmexSyncEnvelope,
} from "./sync-contract";

export const LEGACY_AMEX_SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v1" as const;
export const AMEX_SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v2" as const;
export const AMEX_SYNC_MAILBOX_VERSION = "amex-sync-mailbox/2" as const;
export const AMEX_SYNC_HANDOFF_ORIGIN = PRODUCTION_AMEX_SYNC_HANDOFF_TARGET.origin;
export { AMEX_SYNC_HANDOFF_PATH };
export const AMEX_SYNC_MAILBOX_TTL_MS = 10 * 60 * 1000;

const opaqueIdSchema = z.string().regex(/^[a-f0-9]{32}$/);

export const amexSyncMailboxSchema = z.object({
  mailboxVersion: z.literal(AMEX_SYNC_MAILBOX_VERSION),
  transferId: opaqueIdSchema,
  nonce: opaqueIdSchema,
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  envelope: amexSyncEnvelopeSchema,
}).strict().superRefine((mailbox, context) => {
  const createdAt = Date.parse(mailbox.createdAt);
  const expiresAt = Date.parse(mailbox.expiresAt);
  const scanDeadline = Date.parse(mailbox.envelope.scanFinishedAt) + 30 * 60 * 1000;
  if (expiresAt <= createdAt || expiresAt - createdAt > AMEX_SYNC_MAILBOX_TTL_MS || expiresAt > scanDeadline) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiresAt"],
      message: "The sync mailbox expiry is outside its allowed lifetime.",
    });
  }
});
export type AmexSyncMailbox = z.infer<typeof amexSyncMailboxSchema>;

export interface MailboxStorage {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  deleteValue(key: string): Promise<void>;
}

function randomOpaqueId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAmexSyncMailbox(
  envelopeInput: AmexSyncEnvelope,
  now = new Date(),
): Promise<AmexSyncMailbox> {
  const envelope = parseAmexSyncEnvelope(envelopeInput);
  const scanDeadline = Date.parse(envelope.scanFinishedAt) + 30 * 60 * 1000;
  const expiresAt = Math.min(now.getTime() + AMEX_SYNC_MAILBOX_TTL_MS, scanDeadline);
  if (!Number.isFinite(scanDeadline) || expiresAt <= now.getTime()) throw new Error("The reviewed scan has expired.");
  return amexSyncMailboxSchema.parse({
    mailboxVersion: AMEX_SYNC_MAILBOX_VERSION,
    transferId: randomOpaqueId(),
    nonce: randomOpaqueId(),
    createdAt: now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    digest: await digestAmexSyncEnvelope(envelope),
    envelope,
  });
}

export function amexSyncHandoffUrl(
  transferId: string,
  targetName: AmexSyncHandoffTargetName = "production",
): string {
  const validated = opaqueIdSchema.parse(transferId);
  const target = resolveAmexSyncHandoffTarget(targetName);
  return `${target.origin}${target.path}?transfer=${validated}`;
}

export async function storeAmexSyncMailbox(
  storage: MailboxStorage,
  mailbox: AmexSyncMailbox,
  now = new Date(),
): Promise<void> {
  const existingValue = await storage.getValue(AMEX_SYNC_MAILBOX_KEY, null);
  if (existingValue != null) {
    const existing = amexSyncMailboxSchema.safeParse(existingValue);
    if (existing.success && Date.parse(existing.data.expiresAt) > now.getTime()) {
      throw new Error("A sync handoff is already waiting. Cancel it or wait for it to expire.");
    }
    await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
  }
  if (new TextEncoder().encode(canonicalJson(mailbox)).byteLength > AMEX_SYNC_MAX_BYTES + 2048) {
    throw new Error("The sync mailbox exceeds its byte limit.");
  }
  await storage.setValue(AMEX_SYNC_MAILBOX_KEY, amexSyncMailboxSchema.parse(mailbox));
}

export async function loadAmexSyncMailbox(
  storage: MailboxStorage,
  transferId: string,
  now = new Date(),
): Promise<AmexSyncMailbox> {
  const validatedTransferId = opaqueIdSchema.parse(transferId);
  const raw = await storage.getValue(AMEX_SYNC_MAILBOX_KEY, null);
  const parsed = amexSyncMailboxSchema.safeParse(raw);
  if (!parsed.success || parsed.data.transferId !== validatedTransferId) {
    await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
    throw new Error("The sync handoff is invalid or already consumed.");
  }
  if (Date.parse(parsed.data.expiresAt) <= now.getTime()) {
    await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
    throw new Error("The sync handoff expired.");
  }
  if (Date.parse(parsed.data.createdAt) > now.getTime() + 60_000) {
    await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
    throw new Error("The sync handoff has an invalid creation time.");
  }
  const digest = await digestAmexSyncEnvelope(parsed.data.envelope);
  if (digest !== parsed.data.digest) {
    await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
    throw new Error("The sync handoff failed its integrity check.");
  }
  return parsed.data;
}

export async function clearAmexSyncMailbox(storage: MailboxStorage): Promise<void> {
  await storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
}

export const handoffReadyMessageSchema = z.object({
  type: z.literal("perks-reminder:amex-sync-ready"),
  transferId: opaqueIdSchema,
}).strict();

export const handoffPayloadMessageSchema = z.object({
  type: z.literal("perks-reminder:amex-sync-payload"),
  transferId: opaqueIdSchema,
  nonce: opaqueIdSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  envelope: amexSyncEnvelopeSchema,
}).strict();

export const handoffAcceptedMessageSchema = z.object({
  type: z.literal("perks-reminder:amex-sync-accepted"),
  transferId: opaqueIdSchema,
  nonce: opaqueIdSchema,
}).strict();
