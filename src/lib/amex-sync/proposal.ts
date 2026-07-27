import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AmexSyncPlan } from "./authority";

export const AMEX_SYNC_PROPOSAL_PURPOSE = "amex-sync-confirm" as const;
export const AMEX_SYNC_PROPOSAL_TTL_MS = 5 * 60 * 1000;

const proposalBodySchema = z.object({
  version: z.literal(1),
  purpose: z.literal(AMEX_SYNC_PROPOSAL_PURPOSE),
  userId: z.string().min(1).max(128),
  mode: z.enum(["preview", "write"]),
  envelopeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  manualMappingsDigest: z.string().regex(/^[a-f0-9]{64}$/),
  beforeStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRowIdentities: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(300),
  transitionTime: z.string().datetime({ offset: true }),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();
export type AmexSyncProposalBody = z.infer<typeof proposalBodySchema>;

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedBody: string, key: string): Buffer {
  return createHmac("sha256", key).update(encodedBody).digest();
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
    version: 1,
    purpose: AMEX_SYNC_PROPOSAL_PURPOSE,
    userId: input.userId,
    mode: input.mode,
    envelopeDigest: input.plan.envelopeDigest,
    manualMappingsDigest: input.plan.manualMappingsDigest,
    beforeStateDigest: input.plan.beforeStateDigest,
    sourceRowIdentities: input.plan.rows.map((row) => row.sourceRowIdentity),
    transitionTime: input.now.toISOString(),
    issuedAt: input.now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  });
  const encoded = encode(JSON.stringify(body));
  return { token: `${encoded}.${sign(encoded, input.key).toString("base64url")}`, body };
}

export function verifyAmexSyncProposal(input: {
  token: string;
  key: string;
  userId: string;
  expectedMode: "write";
  now: Date;
}): AmexSyncProposalBody {
  const parts = input.token.split(".");
  if (parts.length !== 2 || parts.some((part) => !part)) throw new Error("proposal_invalid");
  let suppliedSignature: Buffer;
  let bodyValue: unknown;
  try {
    suppliedSignature = Buffer.from(parts[1], "base64url");
    bodyValue = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new Error("proposal_invalid");
  }
  const expectedSignature = sign(parts[0], input.key);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    throw new Error("proposal_invalid");
  }
  const body = proposalBodySchema.parse(bodyValue);
  if (body.userId !== input.userId || body.mode !== input.expectedMode || Date.parse(body.expiresAt) <= input.now.getTime()) {
    throw new Error("proposal_invalid");
  }
  return body;
}
