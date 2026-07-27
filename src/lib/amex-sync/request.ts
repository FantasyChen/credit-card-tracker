import { z } from "zod";
import { PRIMARY_SITE_URL } from "@/lib/site";
import { parseAmexSyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import type { ManualCardSelection } from "./authority";

export const AMEX_SYNC_REQUEST_MAX_BYTES = 300 * 1024;

const manualMappingSchema = z.object({
  sourceLocalCardId: z.string().uuid(),
  destinationCardId: z.string().min(1).max(128),
}).strict();

const manualMappingsSchema = z.array(manualMappingSchema).max(50).superRefine((mappings, context) => {
  const sourceIds = new Set<string>();
  mappings.forEach((mapping, index) => {
    if (sourceIds.has(mapping.sourceLocalCardId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "sourceLocalCardId"],
        message: "A source card can have only one manual mapping.",
      });
    }
    sourceIds.add(mapping.sourceLocalCardId);
  });
});

const previewRequestShape = z.object({
  envelope: z.unknown(),
  manualMappings: manualMappingsSchema.default([]),
}).strict();

const confirmRequestShape = z.object({
  envelope: z.unknown(),
  manualMappings: manualMappingsSchema.default([]),
  proposalToken: z.string().min(40).max(64_000),
}).strict();

export interface ParsedPreviewRequest {
  envelope: ReturnType<typeof parseAmexSyncEnvelope>;
  manualMappings: ManualCardSelection[];
}

export interface ParsedConfirmRequest extends ParsedPreviewRequest {
  proposalToken: string;
}

export class AmexSyncRequestError extends Error {
  constructor(readonly code: "origin_rejected" | "content_type_invalid" | "request_too_large" | "request_invalid") {
    super(code);
  }
}

export function assertSameOriginAmexSyncRequest(request: Request): void {
  const expectedOrigin = new URL(PRIMARY_SITE_URL).origin;
  if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") !== "same-origin") {
    throw new AmexSyncRequestError("origin_rejected");
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new AmexSyncRequestError("content_type_invalid");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > AMEX_SYNC_REQUEST_MAX_BYTES) {
    throw new AmexSyncRequestError("request_too_large");
  }
}

async function parseBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > AMEX_SYNC_REQUEST_MAX_BYTES) {
    throw new AmexSyncRequestError("request_too_large");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AmexSyncRequestError("request_invalid");
  }
}

export async function parsePreviewRequest(request: Request): Promise<ParsedPreviewRequest> {
  assertSameOriginAmexSyncRequest(request);
  const parsed = previewRequestShape.safeParse(await parseBody(request));
  if (!parsed.success) throw new AmexSyncRequestError("request_invalid");
  try {
    return {
      envelope: parseAmexSyncEnvelope(parsed.data.envelope),
      manualMappings: parsed.data.manualMappings,
    };
  } catch {
    throw new AmexSyncRequestError("request_invalid");
  }
}

export async function parseConfirmRequest(request: Request): Promise<ParsedConfirmRequest> {
  assertSameOriginAmexSyncRequest(request);
  const parsed = confirmRequestShape.safeParse(await parseBody(request));
  if (!parsed.success) throw new AmexSyncRequestError("request_invalid");
  try {
    return {
      envelope: parseAmexSyncEnvelope(parsed.data.envelope),
      manualMappings: parsed.data.manualMappings,
      proposalToken: parsed.data.proposalToken,
    };
  } catch {
    throw new AmexSyncRequestError("request_invalid");
  }
}
