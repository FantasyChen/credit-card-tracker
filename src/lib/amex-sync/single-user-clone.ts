import type {
  AmexSyncAttempt,
  AmexSyncRowAudit,
  Benefit,
  BenefitStatus,
  BenefitStatusSourceProvenance,
  CreditCard,
  CreditCardEvent,
  ExternalCardMapping,
  LoyaltyAccount,
  LoyaltyCertificate,
  User,
} from "@/generated/prisma";

export const PRODUCTION_DATABASE_HOST_PREFIX = "ep-falling-butterfly" as const;
export const DEVELOPMENT_DATABASE_HOST_PREFIX = "ep-frosty-snowflake" as const;

export const USER_CLONE_TABLES = [
  "User",
  "CreditCard",
  "Benefit",
  "BenefitStatus",
  "CreditCardEvent",
  "LoyaltyAccount",
  "LoyaltyCertificate",
  "ExternalCardMapping",
  "AmexSyncAttempt",
  "BenefitStatusSourceProvenance",
  "AmexSyncRowAudit",
] as const;

export type UserCloneTable = (typeof USER_CLONE_TABLES)[number];
export type UserCloneCounts = Record<UserCloneTable, number>;

export type CloneUser = Omit<User, "password"> & { password: null };
export type CloneCreditCard = Omit<CreditCard, "cardNumber"> & { cardNumber: null };
export type CloneLoyaltyAccount = Omit<LoyaltyAccount, "accountNumber" | "loyaltyProgramId"> & {
  accountNumber: null;
  loyaltyProgramName: string;
};

export interface UserCloneSnapshot {
  user: CloneUser;
  creditCards: CloneCreditCard[];
  benefits: Benefit[];
  benefitStatuses: BenefitStatus[];
  creditCardEvents: CreditCardEvent[];
  loyaltyAccounts: CloneLoyaltyAccount[];
  loyaltyCertificates: LoyaltyCertificate[];
  externalCardMappings: ExternalCardMapping[];
  amexSyncAttempts: AmexSyncAttempt[];
  benefitStatusSourceProvenance: BenefitStatusSourceProvenance[];
  amexSyncRowAudits: AmexSyncRowAudit[];
}

export interface InternalDatabaseIdentity {
  host: string;
  database: string;
  schema: string;
  fingerprint: string;
  branchIdFingerprint: string | null;
}

export interface SourceAccountRead {
  matchCount: number;
  snapshot: UserCloneSnapshot | null;
}

export interface UserCloneSourcePort {
  identify(): Promise<InternalDatabaseIdentity>;
  readAccountSnapshot(normalizedEmail: string): Promise<SourceAccountRead>;
}

export interface DestinationPreflight {
  blockingCollisionModels: UserCloneTable[];
}

export interface UserCloneDestinationPort {
  identify(): Promise<InternalDatabaseIdentity>;
  findUsersByNormalizedEmail(normalizedEmail: string): Promise<Array<{ id: string }>>;
  preflight(snapshot: UserCloneSnapshot, replaceableUserId: string | null): Promise<DestinationPreflight>;
  apply(input: {
    snapshot: UserCloneSnapshot;
    normalizedEmail: string;
    replaceableUserId: string | null;
    expectedIdentity: InternalDatabaseIdentity;
  }): Promise<UserCloneCounts>;
}

export interface UserCloneReport {
  mode: "dry-run" | "apply";
  targets: {
    source: "production";
    destination: "development";
  };
  tables: Array<{
    table: UserCloneTable;
    sourceCount: number;
    destinationCount: number;
  }>;
}

export class UserCloneOperatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserCloneOperatorError";
  }
}

export function normalizeCloneEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function userCloneApplyConfirmation(normalizedEmail: string): string {
  return `CLONE PRODUCTION USER ${normalizedEmail} TO DEVELOPMENT`;
}

export function userCloneReplacementConfirmation(normalizedEmail: string): string {
  return `REPLACE DEVELOPMENT USER ${normalizedEmail}`;
}

export function emptyUserCloneCounts(): UserCloneCounts {
  return Object.fromEntries(USER_CLONE_TABLES.map((table) => [table, 0])) as UserCloneCounts;
}

export function countUserCloneSnapshot(snapshot: UserCloneSnapshot): UserCloneCounts {
  return {
    User: 1,
    CreditCard: snapshot.creditCards.length,
    Benefit: snapshot.benefits.length,
    BenefitStatus: snapshot.benefitStatuses.length,
    CreditCardEvent: snapshot.creditCardEvents.length,
    LoyaltyAccount: snapshot.loyaltyAccounts.length,
    LoyaltyCertificate: snapshot.loyaltyCertificates.length,
    ExternalCardMapping: snapshot.externalCardMappings.length,
    AmexSyncAttempt: snapshot.amexSyncAttempts.length,
    BenefitStatusSourceProvenance: snapshot.benefitStatusSourceProvenance.length,
    AmexSyncRowAudit: snapshot.amexSyncRowAudits.length,
  };
}

function requireExactNormalizedEmail(email: string): string {
  const normalized = normalizeCloneEmail(email);
  if (!normalized || email !== normalized || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new UserCloneOperatorError("The clone email must be a valid, already-normalized lowercase email address.");
  }
  return normalized;
}

function isReviewedNeonHost(host: string, endpointPrefix: string): boolean {
  const normalizedHost = host.toLowerCase();
  return normalizedHost.startsWith(`${endpointPrefix}-`)
    && normalizedHost.endsWith(".aws.neon.tech")
    && !normalizedHost.includes("..");
}

function assertTargetIdentities(source: InternalDatabaseIdentity, destination: InternalDatabaseIdentity): void {
  if (!isReviewedNeonHost(source.host, PRODUCTION_DATABASE_HOST_PREFIX)) {
    throw new UserCloneOperatorError("The source database did not match the reviewed production target.");
  }
  if (!isReviewedNeonHost(destination.host, DEVELOPMENT_DATABASE_HOST_PREFIX)) {
    throw new UserCloneOperatorError("The destination database did not match the reviewed development target.");
  }
  if (!source.database || !source.schema || !source.fingerprint
    || !destination.database || !destination.schema || !destination.fingerprint
    || !source.branchIdFingerprint || !destination.branchIdFingerprint) {
    throw new UserCloneOperatorError("Database-side target verification returned an incomplete identity.");
  }
  if (source.fingerprint === destination.fingerprint
    || source.branchIdFingerprint === destination.branchIdFingerprint) {
    throw new UserCloneOperatorError("Source and destination resolve to the same database target.");
  }
}

function assertUniqueIds(values: Array<{ id: string }>, model: UserCloneTable): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) {
    throw new UserCloneOperatorError(`The source ${model} graph contains duplicate identifiers.`);
  }
}

export function validateUserCloneSnapshot(snapshot: UserCloneSnapshot, normalizedEmail: string): void {
  const userId = snapshot.user.id;
  if (snapshot.user.email !== normalizedEmail || snapshot.user.password !== null) {
    throw new UserCloneOperatorError("The source user projection violates the sanitized clone policy.");
  }
  if (snapshot.creditCards.some((card) => card.userId !== userId || card.cardNumber !== null)) {
    throw new UserCloneOperatorError("The source CreditCard graph is inconsistent or unsanitized.");
  }
  if (snapshot.loyaltyAccounts.some((account) => account.userId !== userId || account.accountNumber !== null || !account.loyaltyProgramName)) {
    throw new UserCloneOperatorError("The source LoyaltyAccount graph is inconsistent or unsanitized.");
  }

  const cardIds = new Set(snapshot.creditCards.map((card) => card.id));
  const benefitIds = new Set(snapshot.benefits.map((benefit) => benefit.id));
  const statusIds = new Set(snapshot.benefitStatuses.map((status) => status.id));
  const loyaltyAccountIds = new Set(snapshot.loyaltyAccounts.map((account) => account.id));
  const attemptIds = new Set(snapshot.amexSyncAttempts.map((attempt) => attempt.id));

  for (const benefit of snapshot.benefits) {
    const cardOwned = benefit.creditCardId !== null && cardIds.has(benefit.creditCardId) && benefit.userId === null;
    const standaloneOwned = benefit.creditCardId === null && benefit.userId === userId;
    if (!cardOwned && !standaloneOwned) {
      throw new UserCloneOperatorError("The source Benefit graph contains a cross-user or ambiguous owner.");
    }
  }
  if (snapshot.benefitStatuses.some((status) => status.userId !== userId || !benefitIds.has(status.benefitId))) {
    throw new UserCloneOperatorError("The source BenefitStatus graph contains a cross-user link.");
  }
  if (snapshot.creditCardEvents.some((event) => event.userId !== userId || !cardIds.has(event.creditCardId))) {
    throw new UserCloneOperatorError("The source CreditCardEvent graph contains a cross-user link.");
  }
  if (snapshot.loyaltyCertificates.some((certificate) => certificate.userId !== userId || !loyaltyAccountIds.has(certificate.loyaltyAccountId))) {
    throw new UserCloneOperatorError("The source LoyaltyCertificate graph contains a cross-user link.");
  }
  if (snapshot.externalCardMappings.some((mapping) => mapping.userId !== userId || !cardIds.has(mapping.creditCardId))) {
    throw new UserCloneOperatorError("The source ExternalCardMapping graph contains a cross-user link.");
  }
  if (snapshot.amexSyncAttempts.some((attempt) => attempt.userId !== userId)) {
    throw new UserCloneOperatorError("The source AmexSyncAttempt graph contains a cross-user owner.");
  }
  if (snapshot.benefitStatusSourceProvenance.some((provenance) =>
    !statusIds.has(provenance.benefitStatusId)
    || (provenance.attemptId !== null && !attemptIds.has(provenance.attemptId)))) {
    throw new UserCloneOperatorError("The source provenance graph contains an invalid destination link.");
  }
  if (snapshot.amexSyncRowAudits.some((audit) =>
    !attemptIds.has(audit.attemptId)
    || (audit.destinationCardId !== null && !cardIds.has(audit.destinationCardId))
    || (audit.destinationBenefitId !== null && !benefitIds.has(audit.destinationBenefitId))
    || (audit.destinationStatusId !== null && !statusIds.has(audit.destinationStatusId)))) {
    throw new UserCloneOperatorError("The source audit graph contains an invalid destination link.");
  }

  assertUniqueIds([snapshot.user], "User");
  assertUniqueIds(snapshot.creditCards, "CreditCard");
  assertUniqueIds(snapshot.benefits, "Benefit");
  assertUniqueIds(snapshot.benefitStatuses, "BenefitStatus");
  assertUniqueIds(snapshot.creditCardEvents, "CreditCardEvent");
  assertUniqueIds(snapshot.loyaltyAccounts, "LoyaltyAccount");
  assertUniqueIds(snapshot.loyaltyCertificates, "LoyaltyCertificate");
  assertUniqueIds(snapshot.externalCardMappings, "ExternalCardMapping");
  assertUniqueIds(snapshot.amexSyncAttempts, "AmexSyncAttempt");
  assertUniqueIds(snapshot.benefitStatusSourceProvenance, "BenefitStatusSourceProvenance");
  assertUniqueIds(snapshot.amexSyncRowAudits, "AmexSyncRowAudit");
}

export async function runSingleUserCloneOperator(input: {
  email: string;
  mode?: "dry-run" | "apply";
  targetVerified?: boolean;
  applyConfirmation?: string;
  replacementConfirmation?: string;
  source: UserCloneSourcePort;
  destination: UserCloneDestinationPort;
}): Promise<UserCloneReport> {
  const normalizedEmail = requireExactNormalizedEmail(input.email);
  const mode = input.mode ?? "dry-run";

  if (mode === "apply") {
    if (input.targetVerified !== true) {
      throw new UserCloneOperatorError("Apply requires the explicit target-verification attestation.");
    }
    if (input.applyConfirmation !== userCloneApplyConfirmation(normalizedEmail)) {
      throw new UserCloneOperatorError("Apply requires the exact single-user clone confirmation phrase.");
    }
  }

  const [sourceIdentity, destinationIdentity] = await Promise.all([
    input.source.identify(),
    input.destination.identify(),
  ]);
  assertTargetIdentities(sourceIdentity, destinationIdentity);

  const sourceRead = await input.source.readAccountSnapshot(normalizedEmail);
  if (sourceRead.matchCount === 0 || !sourceRead.snapshot) {
    throw new UserCloneOperatorError("The source account match was not exactly one user.");
  }
  if (sourceRead.matchCount !== 1) {
    throw new UserCloneOperatorError("The source account match was not exactly one user.");
  }
  const snapshot = sourceRead.snapshot;
  validateUserCloneSnapshot(snapshot, normalizedEmail);

  const destinationUsers = await input.destination.findUsersByNormalizedEmail(normalizedEmail);
  if (destinationUsers.length > 1) {
    throw new UserCloneOperatorError("The destination email match was not unique.");
  }
  const replaceableUserId = destinationUsers[0]?.id ?? null;
  if (replaceableUserId !== null
    && input.replacementConfirmation !== userCloneReplacementConfirmation(normalizedEmail)) {
    throw new UserCloneOperatorError("An existing development user requires the separate exact replacement confirmation phrase.");
  }

  const preflight = await input.destination.preflight(snapshot, replaceableUserId);
  if (preflight.blockingCollisionModels.length > 0) {
    throw new UserCloneOperatorError("Destination identifier or unique-key collisions block the clone.");
  }

  const sourceCounts = countUserCloneSnapshot(snapshot);
  const destinationCounts = mode === "apply"
    ? await input.destination.apply({
      snapshot,
      normalizedEmail,
      replaceableUserId,
      expectedIdentity: destinationIdentity,
    })
    : sourceCounts;

  for (const table of USER_CLONE_TABLES) {
    if (destinationCounts[table] !== sourceCounts[table]) {
      throw new UserCloneOperatorError("Post-write table counts did not match the source snapshot.");
    }
  }

  return {
    mode,
    targets: {
      source: "production",
      destination: "development",
    },
    tables: USER_CLONE_TABLES.map((table) => ({
      table,
      sourceCount: sourceCounts[table],
      destinationCount: destinationCounts[table],
    })),
  };
}
