import type { StoredCardRecordV1 } from "./contract";

const CARD_FINGERPRINT_DOMAIN = "amex-us-card-v1\0";

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    else if (point <= 0xffff) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 0x3f), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("The installation identity secret is invalid.");
  }
  return new Uint8Array(value.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
}

export function createInstallationSecret(cryptoApi: Crypto = crypto): string {
  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function fingerprintCardToken(
  secret: string,
  rawToken: string,
  cryptoApi: Crypto = crypto,
): Promise<string> {
  if (!rawToken) throw new Error("A stable card token is required.");
  const key = await cryptoApi.subtle.importKey(
    "raw",
    hexToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await cryptoApi.subtle.sign(
    "HMAC",
    key,
    utf8Bytes(`${CARD_FINGERPRINT_DOMAIN}${rawToken}`),
  );
  return bytesToHex(new Uint8Array(signature));
}

export function createLocalCardId(cryptoApi: Crypto = crypto): string {
  return cryptoApi.randomUUID();
}

function normalizeIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export type IdentityResolution =
  | { kind: "exact"; localCardId: string; record: StoredCardRecordV1 }
  | { kind: "reconciled"; localCardId: string; record: StoredCardRecordV1 }
  | { kind: "new"; localCardId: string }
  | { kind: "ambiguous"; reason: string }
  | { kind: "conflict"; reason: string };

export function reconcileCardIdentity(input: {
  sourceFingerprint: string;
  productName: string;
  endingDigits: string;
  records: Record<string, StoredCardRecordV1>;
  claimedLocalCardIds?: ReadonlySet<string>;
  cryptoApi?: Crypto;
}): IdentityResolution {
  const records = Object.values(input.records);
  const claimed = input.claimedLocalCardIds ?? new Set<string>();
  const exact = records.filter(
    (record) => record.identity.sourceFingerprint === input.sourceFingerprint,
  );
  if (exact.length > 1) {
    return { kind: "conflict", reason: "More than one local card has the same source identity." };
  }
  if (exact.length === 1) {
    if (claimed.has(exact[0].localCardId)) {
      return { kind: "conflict", reason: "A source identity appeared more than once in this scan." };
    }
    if (exact[0].identity.endingDigits !== input.endingDigits) {
      return { kind: "conflict", reason: "A source identity changed its displayed card ending." };
    }
    return { kind: "exact", localCardId: exact[0].localCardId, record: exact[0] };
  }

  const displayMatches = records.filter((record) =>
    !claimed.has(record.localCardId)
    && normalizeIdentityText(record.identity.productName) === normalizeIdentityText(input.productName)
    && record.identity.endingDigits === input.endingDigits,
  );
  if (displayMatches.length > 1) {
    return { kind: "ambiguous", reason: "Multiple local cards share this display identity." };
  }
  if (displayMatches.length === 1) {
    return {
      kind: "reconciled",
      localCardId: displayMatches[0].localCardId,
      record: displayMatches[0],
    };
  }
  return { kind: "new", localCardId: createLocalCardId(input.cryptoApi) };
}

// A deterministic non-secret key for already-approved semantic fields. It is not
// used for issuer identity and intentionally contains no list position.
export function createBenefitKey(input: {
  title: string;
  category?: string;
  activityKind: string;
  hashedDiscriminator?: string;
}): string {
  if (input.hashedDiscriminator && !/^[a-f0-9]{64}$/.test(input.hashedDiscriminator)) {
    throw new Error("A benefit discriminator must already be an approved SHA-256 digest.");
  }
  const value = [
    normalizeIdentityText(input.title),
    normalizeIdentityText(input.category ?? ""),
    input.activityKind,
    input.hashedDiscriminator ?? "",
  ].join("\0");
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `benefit-${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}
