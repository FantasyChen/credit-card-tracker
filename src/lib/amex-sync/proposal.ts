import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  amexDestinationAuthorityRowDigest,
  type AmexSyncPlan,
} from "./authority";

export const AMEX_SYNC_PROPOSAL_PURPOSE = "amex-sync-confirm" as const;
export const AMEX_SYNC_PROPOSAL_TTL_MS = 5 * 60 * 1000;
export const AMEX_SYNC_PROPOSAL_MAX_LENGTH = 16_384;
const SHA256_BYTES = 32;
const MAX_ROWS = 300;

const proposalBodySchema = z.object({
  version: z.literal(3),
  purpose: z.literal(AMEX_SYNC_PROPOSAL_PURPOSE),
  userId: z.string().min(1).max(128),
  mode: z.enum(["preview", "write"]),
  envelopeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  destinationAuthorityDigest: z.string().regex(/^[a-f0-9]{64}$/),
  destinationAuthorityRowDigests: z.string().regex(/^[A-Za-z0-9_-]*$/).max(MAX_ROWS * 43),
  beforeStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRowIdentitiesDigest: z.string().regex(/^[a-f0-9]{64}$/),
  atomicGroupIdentitiesDigest: z.string().regex(/^[a-f0-9]{64}$/),
  rowCount: z.number().int().min(0).max(MAX_ROWS),
  transitionTime: z.string().datetime({ offset: true }),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).strict().superRefine((body, context) => {
  const packed = Buffer.from(body.destinationAuthorityRowDigests, "base64url");
  if (packed.length !== body.rowCount * SHA256_BYTES) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destinationAuthorityRowDigests"],
      message: "Packed row authority digests do not match the declared row count.",
    });
  }
});
export type AmexSyncProposalBody = z.infer<typeof proposalBodySchema>;

function sign(serializedBody: string, key: string): Buffer {
  return createHmac("sha256", key).update(serializedBody).digest();
}

export function digestAmexSyncProposalIdentities(values: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

function packAuthorityRowDigests(plan: AmexSyncPlan): string {
  return Buffer.concat(plan.rows.map((row) =>
    Buffer.from(amexDestinationAuthorityRowDigest(row), "hex"))).toString("base64url");
}

export function amexSyncProposalAuthorityRowDigest(
  proposal: AmexSyncProposalBody,
  index: number,
): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= proposal.rowCount) return null;
  const packed = Buffer.from(proposal.destinationAuthorityRowDigests, "base64url");
  const start = index * SHA256_BYTES;
  return packed.subarray(start, start + SHA256_BYTES).toString("hex");
}

export function createAmexSyncProposal(input: {
  userId: string;
  mode: "preview" | "write";
  plan: AmexSyncPlan;
  key: string;
  now: Date;
  scanFinishedAt: string;
}): { token: string; body: AmexSyncProposalBody } {
  const scanDeadline = Date.parse(input.scanFinishedAt) + 30 * 60 * 1000;
  const expiresAt = Math.min(input.now.getTime() + AMEX_SYNC_PROPOSAL_TTL_MS, scanDeadline);
  if (!Number.isFinite(scanDeadline) || expiresAt <= input.now.getTime()) throw new Error("The reviewed scan has expired.");
  const body = proposalBodySchema.parse({
    version: 3,
    purpose: AMEX_SYNC_PROPOSAL_PURPOSE,
    userId: input.userId,
    mode: input.mode,
    envelopeDigest: input.plan.envelopeDigest,
    destinationAuthorityDigest: input.plan.destinationAuthorityDigest,
    destinationAuthorityRowDigests: packAuthorityRowDigests(input.plan),
    beforeStateDigest: input.plan.beforeStateDigest,
    sourceRowIdentitiesDigest: digestAmexSyncProposalIdentities(
      input.plan.rows.map((row) => row.sourceRowIdentity),
    ),
    atomicGroupIdentitiesDigest: digestAmexSyncProposalIdentities(
      input.plan.rows.map((row) => row.atomicGroupIdentity),
    ),
    rowCount: input.plan.rows.length,
    transitionTime: input.now.toISOString(),
    issuedAt: input.now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  });
  // Keep the compact JSON body directly in the opaque token. Re-encoding the
  // packed random digests as base64 a second time would exceed the public
  // 16,384-character response boundary for a valid 300-row envelope.
  const serialized = JSON.stringify(body);
  const token = `${serialized}.${sign(serialized, input.key).toString("base64url")}`;
  if (token.length > AMEX_SYNC_PROPOSAL_MAX_LENGTH) {
    throw new Error("The reviewed proposal is too large.");
  }
  return { token, body };
}

export function verifyAmexSyncProposal(input: {
  token: string;
  key: string;
  userId: string;
  expectedMode: "write";
  now: Date;
}): AmexSyncProposalBody {
  if (!input.token || input.token.length > AMEX_SYNC_PROPOSAL_MAX_LENGTH) {
    throw new Error("proposal_invalid");
  }
  const separator = input.token.lastIndexOf(".");
  if (separator <= 0 || separator === input.token.length - 1) throw new Error("proposal_invalid");
  const serialized = input.token.slice(0, separator);
  const encodedSignature = input.token.slice(separator + 1);
  let suppliedSignature: Buffer;
  let bodyValue: unknown;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
    bodyValue = JSON.parse(serialized);
  } catch {
    throw new Error("proposal_invalid");
  }
  const expectedSignature = sign(serialized, input.key);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    throw new Error("proposal_invalid");
  }
  const body = proposalBodySchema.parse(bodyValue);
  if (body.userId !== input.userId || body.mode !== input.expectedMode || Date.parse(body.expiresAt) <= input.now.getTime()) {
    throw new Error("proposal_invalid");
  }
  return body;
}
