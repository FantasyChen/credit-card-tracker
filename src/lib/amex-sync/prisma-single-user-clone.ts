import { createHash } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  type AmexSyncAttempt,
  type AmexSyncRowAudit,
  type Benefit,
  type BenefitStatus,
  type BenefitStatusSourceProvenance,
  type CreditCardEvent,
  type ExternalCardMapping,
  type LoyaltyCertificate,
} from "@/generated/prisma";
import { migrationFingerprint } from "@/lib/global-benefit-migration";
import {
  countUserCloneSnapshot,
  planCloneGlobalCatalogRebindings,
  planCloneCategoryRepairRebindings,
  type CloneCategoryRepair,
  type CloneCategoryRepairOccurrence,
  type CloneCategoryRepairStateFingerprints,
  type CloneCreditCard,
  type CloneGlobalCatalogBindings,
  type CloneLoyaltyAccount,
  type CloneUser,
  type DestinationPreflight,
  type InternalDatabaseIdentity,
  type SourceAccountRead,
  type UserCloneCounts,
  type UserCloneDestinationPort,
  type UserCloneSnapshot,
  type UserCloneSourcePort,
  type UserCloneTable,
  UserCloneOperatorError,
  validateUserCloneSnapshot,
} from "./single-user-clone";

interface IdentityRow {
  database_name: string;
  schema_name: string;
  branch_id: string | null;
}

interface RawQueryClient {
  $queryRawUnsafe<T>(query: string): Promise<T>;
}

function shortFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function canonicalCloneEvidence(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalCloneEvidence);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalCloneEvidence(item)]));
  }
  return value;
}

function cloneEvidenceMatches(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalCloneEvidence(left)) === JSON.stringify(canonicalCloneEvidence(right));
}

function parseConfiguredTarget(databaseUrl: string): { host: string; canonicalHost: string } {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new UserCloneOperatorError("A configured database target URL is invalid.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new UserCloneOperatorError("A configured database target must use PostgreSQL.");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) throw new UserCloneOperatorError("A configured database target has no host.");
  return { host, canonicalHost: host.replace("-pooler.", ".") };
}

async function queryDatabaseIdentity(
  client: RawQueryClient,
  databaseUrl: string,
): Promise<InternalDatabaseIdentity> {
  const configured = parseConfiguredTarget(databaseUrl);
  const rows = await client.$queryRawUnsafe<IdentityRow[]>(
    "SELECT current_database() AS database_name, current_schema() AS schema_name, current_setting('neon.branch_id', true) AS branch_id",
  );
  const row = rows[0];
  if (!row || typeof row.database_name !== "string" || typeof row.schema_name !== "string") {
    throw new UserCloneOperatorError("Database-side target verification returned no identity.");
  }
  const branchId = typeof row.branch_id === "string" && row.branch_id.length > 0 ? row.branch_id : null;
  const identityMaterial = [
    configured.canonicalHost,
    row.database_name,
    row.schema_name,
    branchId ?? "branch-unavailable",
  ].join("|");
  return {
    host: configured.host,
    database: row.database_name,
    schema: row.schema_name,
    fingerprint: shortFingerprint(identityMaterial),
    branchIdFingerprint: branchId === null ? null : shortFingerprint(branchId),
  };
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  notifyNewBenefit: true,
  notifyBenefitExpiration: true,
  notifyExpirationDays: true,
  createdAt: true,
  updatedAt: true,
  notifyPointsExpiration: true,
  pointsExpirationDays: true,
  role: true,
  subscriptionTier: true,
  isBetaUser: true,
  betaEnrolledAt: true,
  emailAlertsUsed: true,
  emailAlertsResetAt: true,
} as const;

const creditCardSelect = {
  id: true,
  name: true,
  issuer: true,
  expiryDate: true,
  openedDate: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  lastFourDigits: true,
  nickname: true,
  lifecycleStatus: true,
  closedDate: true,
  annualFeeAmount: true,
  annualFeeDueDate: true,
  signupBonusDeadline: true,
  spendDeadline: true,
  productChangedFrom: true,
  productChangedTo: true,
  lifecycleNotes: true,
  productKey: true,
} as const;

const loyaltyAccountSelect = {
  id: true,
  userId: true,
  pointsBalance: true,
  lastActivityDate: true,
  expirationDate: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  loyaltyProgram: { select: { name: true } },
} as const;

type ReadTransaction = Prisma.TransactionClient;

interface CloneCardBindingRow { creditCardId: string; catalogKey: string }
interface CloneStatusBindingRow { benefitStatusId: string; creditCardId: string; catalogKey: string }
interface CloneAuditBindingRow { auditId: string; catalogKey: string; definitionFingerprint: string | null }
interface CloneLedgerBindingRow {
  id: string;
  legacyBenefitId: string;
  userId: string;
  creditCardId: string | null;
  predefinedCardCatalogKey: string | null;
  predefinedBenefitCatalogKey: string | null;
  classification: "STANDARD" | "CUSTOM";
  phase: "CLASSIFIED" | "BRIDGED" | "CLEANED" | "ROLLED_BACK";
  sourceFingerprint: string;
  destinationFingerprint: string | null;
  classifiedAt: Date;
  bridgedAt: Date | null;
  cleanedAt: Date | null;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

async function readGlobalCatalogBindings(
  transaction: ReadTransaction,
  userId: string,
): Promise<CloneGlobalCatalogBindings> {
  const [cards, statuses, audits, ledger] = await Promise.all([
    transaction.$queryRaw<CloneCardBindingRow[]>(Prisma.sql`
      SELECT c."id" AS "creditCardId", pc."catalogKey"
      FROM "CreditCard" c
      JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
      WHERE c."userId" = ${userId}
      ORDER BY c."id"
    `),
    transaction.$queryRaw<CloneStatusBindingRow[]>(Prisma.sql`
      SELECT bs."id" AS "benefitStatusId", bs."creditCardId", pb."catalogKey"
      FROM "BenefitStatus" bs
      JOIN "PredefinedBenefit" pb ON pb."id" = bs."predefinedBenefitId"
      WHERE bs."userId" = ${userId}
      ORDER BY bs."id"
    `),
    transaction.$queryRaw<CloneAuditBindingRow[]>(Prisma.sql`
      SELECT r."id" AS "auditId", pb."catalogKey",
        r."destinationDefinitionFingerprint" AS "definitionFingerprint"
      FROM "AmexSyncRowAudit" r
      JOIN "AmexSyncAttempt" a ON a."id" = r."attemptId"
      JOIN "PredefinedBenefit" pb ON pb."id" = r."destinationPredefinedBenefitId"
      WHERE a."userId" = ${userId}
      ORDER BY r."id"
    `),
    transaction.$queryRaw<CloneLedgerBindingRow[]>(Prisma.sql`
      SELECT l."id", l."legacyBenefitId", l."userId", l."creditCardId",
        pc."catalogKey" AS "predefinedCardCatalogKey",
        pb."catalogKey" AS "predefinedBenefitCatalogKey",
        l."classification"::text AS "classification", l."phase"::text AS "phase",
        l."sourceFingerprint", l."destinationFingerprint", l."classifiedAt",
        l."bridgedAt", l."cleanedAt", l."rolledBackAt", l."createdAt", l."updatedAt"
      FROM "CatalogMigrationLedger" l
      LEFT JOIN "PredefinedCard" pc ON pc."id" = l."predefinedCardId"
      LEFT JOIN "PredefinedBenefit" pb ON pb."id" = l."predefinedBenefitId"
      WHERE l."userId" = ${userId}
      ORDER BY l."id"
    `),
  ]);
  return { cards, statuses, audits, ledger };
}

interface CloneStateFingerprintRow {
  id: string;
  stateJson: unknown;
}

async function readCategoryRepairStateFingerprints(
  transaction: ReadTransaction,
  userId: string,
): Promise<CloneCategoryRepairStateFingerprints> {
  const [statuses, audits, provenance] = await Promise.all([
    transaction.$queryRaw<CloneStateFingerprintRow[]>(Prisma.sql`
      SELECT bs."id", to_jsonb(bs) - 'creditCardId' - 'predefinedBenefitId' AS "stateJson"
      FROM "BenefitStatus" bs
      WHERE bs."userId" = ${userId}
      ORDER BY bs."id"
    `),
    transaction.$queryRaw<CloneStateFingerprintRow[]>(Prisma.sql`
      SELECT r."id",
        to_jsonb(r) - 'destinationPredefinedBenefitId' - 'destinationDefinitionFingerprint' AS "stateJson"
      FROM "AmexSyncRowAudit" r
      JOIN "AmexSyncAttempt" a ON a."id" = r."attemptId"
      WHERE a."userId" = ${userId}
      ORDER BY r."id"
    `),
    transaction.$queryRaw<CloneStateFingerprintRow[]>(Prisma.sql`
      SELECT p."id", to_jsonb(p) AS "stateJson"
      FROM "BenefitStatusSourceProvenance" p
      JOIN "BenefitStatus" bs ON bs."id" = p."benefitStatusId"
      WHERE bs."userId" = ${userId}
      ORDER BY p."id"
    `),
  ]);
  const project = (rows: CloneStateFingerprintRow[]) => rows.map((row) => ({
    id: row.id,
    stateFingerprint: migrationFingerprint(row.stateJson),
  }));
  return {
    statuses: project(statuses),
    audits: project(audits),
    provenance: project(provenance),
  };
}

async function readSourceGraph(
  transaction: ReadTransaction,
  normalizedEmail: string,
): Promise<SourceAccountRead> {
  const users = await transaction.user.findMany({
    where: { email: normalizedEmail },
    select: userSelect,
    take: 2,
  });
  if (users.length !== 1 || users[0].email !== normalizedEmail) {
    return { matchCount: users.length, snapshot: null };
  }
  const projectedUser: CloneUser = { ...users[0], password: null };
  const userId = projectedUser.id;

  const [
    rawCards,
    benefits,
    benefitStatuses,
    creditCardEvents,
    rawLoyaltyAccounts,
    loyaltyCertificates,
    externalCardMappings,
    amexSyncAttempts,
    benefitStatusSourceProvenance,
    amexSyncRowAudits,
  ] = await Promise.all([
    transaction.creditCard.findMany({ where: { userId }, select: creditCardSelect }),
    transaction.benefit.findMany({
      where: { OR: [{ userId }, { creditCard: { userId } }] },
    }),
    transaction.benefitStatus.findMany({
      where: {
        OR: [
          { userId },
          { benefit: { OR: [{ userId }, { creditCard: { userId } }] } },
        ],
      },
    }),
    transaction.creditCardEvent.findMany({
      where: { OR: [{ userId }, { creditCard: { userId } }] },
    }),
    transaction.loyaltyAccount.findMany({ where: { userId }, select: loyaltyAccountSelect }),
    transaction.loyaltyCertificate.findMany({
      where: { OR: [{ userId }, { loyaltyAccount: { userId } }] },
    }),
    transaction.externalCardMapping.findMany({
      where: { OR: [{ userId }, { creditCard: { userId } }] },
    }),
    transaction.amexSyncAttempt.findMany({ where: { userId } }),
    transaction.benefitStatusSourceProvenance.findMany({
      where: {
        OR: [
          { benefitStatus: { userId } },
          { benefitStatus: { benefit: { OR: [{ userId }, { creditCard: { userId } }] } } },
          { attempt: { userId } },
        ],
      },
    }),
    transaction.amexSyncRowAudit.findMany({
      where: {
        OR: [
          { attempt: { userId } },
          { destinationCard: { userId } },
          { destinationBenefit: { OR: [{ userId }, { creditCard: { userId } }] } },
          { destinationStatus: { userId } },
          { destinationStatus: { benefit: { OR: [{ userId }, { creditCard: { userId } }] } } },
        ],
      },
    }),
  ]);

  const [
    globalCatalogBindings,
    categoryRepairStateFingerprints,
    categoryRepairs,
    categoryRepairOccurrences,
  ] = await Promise.all([
    readGlobalCatalogBindings(transaction, userId),
    readCategoryRepairStateFingerprints(transaction, userId),
    transaction.$queryRaw<CloneCategoryRepair[]>(Prisma.sql`
      SELECT r.*, pc."catalogKey" AS "resolvedPredefinedCardCatalogKey",
        pb."catalogKey" AS "resolvedPredefinedBenefitCatalogKey",
        (pb."predefinedCardId" = r."predefinedCardId") AS "predefinedBenefitParentMatchesCard"
      FROM "GlobalBenefitCategoryRepair" r
      JOIN "PredefinedCard" pc ON pc."id" = r."predefinedCardId"
      JOIN "PredefinedBenefit" pb ON pb."id" = r."predefinedBenefitId"
      WHERE r."userId" = ${userId}
      ORDER BY r."id"
    `),
    transaction.$queryRaw<CloneCategoryRepairOccurrence[]>(Prisma.sql`
      SELECT *, "removedStatusPreimage" IS NULL AS "removedStatusPreimageIsSqlNull",
        jsonb_typeof("removedStatusPreimage") AS "removedStatusPreimageJsonType"
      FROM "GlobalBenefitCategoryRepairOccurrence"
      WHERE "userId" = ${userId}
      ORDER BY "cycleStartDate", "cycleEndDate", "occurrenceIndex", "keeperStatusId", "id"
    `),
  ]);
  const legacyStatuses = benefitStatuses.map((row) => {
    const projected = { ...row } as Record<string, unknown>;
    delete projected.creditCardId;
    delete projected.predefinedBenefitId;
    return projected as unknown as BenefitStatus;
  });
  const legacyAudits = amexSyncRowAudits.map((row) => {
    const projected = { ...row } as Record<string, unknown>;
    delete projected.destinationPredefinedBenefitId;
    delete projected.destinationDefinitionFingerprint;
    return projected as unknown as AmexSyncRowAudit;
  });
  const snapshot: UserCloneSnapshot = {
    user: projectedUser,
    creditCards: rawCards.map((card): CloneCreditCard => ({
      ...card,
      cardNumber: null,
      predefinedCardId: null,
    })),
    benefits: benefits as Benefit[],
    benefitStatuses: legacyStatuses,
    creditCardEvents: creditCardEvents as CreditCardEvent[],
    loyaltyAccounts: rawLoyaltyAccounts.map((account): CloneLoyaltyAccount => ({
      id: account.id,
      userId: account.userId,
      accountNumber: null,
      pointsBalance: account.pointsBalance,
      lastActivityDate: account.lastActivityDate,
      expirationDate: account.expirationDate,
      isActive: account.isActive,
      notes: account.notes,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      loyaltyProgramName: account.loyaltyProgram.name,
    })),
    loyaltyCertificates: loyaltyCertificates as LoyaltyCertificate[],
    externalCardMappings: externalCardMappings as ExternalCardMapping[],
    amexSyncAttempts: amexSyncAttempts as AmexSyncAttempt[],
    benefitStatusSourceProvenance: benefitStatusSourceProvenance as BenefitStatusSourceProvenance[],
    amexSyncRowAudits: legacyAudits,
    globalCatalogBindings,
    categoryRepairStateFingerprints,
    categoryRepairs,
    categoryRepairOccurrences,
  };
  validateUserCloneSnapshot(snapshot, normalizedEmail);
  return { matchCount: 1, snapshot };
}

export class PrismaUserCloneSource implements UserCloneSourcePort {
  constructor(
    private readonly client: PrismaClient,
    private readonly databaseUrl: string,
  ) {}

  identify(): Promise<InternalDatabaseIdentity> {
    return queryDatabaseIdentity(this.client, this.databaseUrl);
  }

  readAccountSnapshot(normalizedEmail: string): Promise<SourceAccountRead> {
    return this.client.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return readSourceGraph(transaction, normalizedEmail);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

interface CollisionRecord {
  model: UserCloneTable;
  ownerUserId: string | null;
}

function ownerForBenefit(row: { userId: string | null; creditCard: { userId: string } | null }): string | null {
  const cardOwner = row.creditCard?.userId ?? null;
  if (row.userId !== null && cardOwner !== null) return row.userId === cardOwner ? row.userId : null;
  return row.userId ?? cardOwner;
}

async function findIdCollisions(
  client: Prisma.TransactionClient | PrismaClient,
  snapshot: UserCloneSnapshot,
): Promise<CollisionRecord[]> {
  const ids = <T extends { id: string }>(rows: T[]) => rows.map((row) => row.id);
  const copiedStatusIds = new Set(ids(snapshot.benefitStatuses));
  const allRemovedStatusIds = Array.from(new Set((snapshot.categoryRepairOccurrences ?? [])
    .flatMap((row) => row.removedStatusId === null ? [] : [row.removedStatusId])));
  const removedStatusIds = allRemovedStatusIds.filter((id) => !copiedStatusIds.has(id));
  const [
    users,
    cards,
    benefits,
    statuses,
    removedStatuses,
    events,
    loyaltyAccounts,
    certificates,
    mappings,
    attempts,
    provenance,
    audits,
    ledgerRows,
    categoryRepairs,
    categoryRepairOccurrences,
  ] = await Promise.all([
    client.user.findMany({ where: { id: snapshot.user.id }, select: { id: true } }),
    client.creditCard.findMany({ where: { id: { in: ids(snapshot.creditCards) } }, select: { userId: true } }),
    client.benefit.findMany({
      where: { id: { in: ids(snapshot.benefits) } },
      select: { userId: true, creditCard: { select: { userId: true } } },
    }),
    client.benefitStatus.findMany({ where: { id: { in: ids(snapshot.benefitStatuses) } }, select: { userId: true } }),
    removedStatusIds.length > 0
      ? client.benefitStatus.findMany({ where: { id: { in: removedStatusIds } }, select: { userId: true } })
      : Promise.resolve([]),
    client.creditCardEvent.findMany({ where: { id: { in: ids(snapshot.creditCardEvents) } }, select: { userId: true } }),
    client.loyaltyAccount.findMany({ where: { id: { in: ids(snapshot.loyaltyAccounts) } }, select: { userId: true } }),
    client.loyaltyCertificate.findMany({ where: { id: { in: ids(snapshot.loyaltyCertificates) } }, select: { userId: true } }),
    client.externalCardMapping.findMany({ where: { id: { in: ids(snapshot.externalCardMappings) } }, select: { userId: true } }),
    client.amexSyncAttempt.findMany({ where: { id: { in: ids(snapshot.amexSyncAttempts) } }, select: { userId: true } }),
    client.benefitStatusSourceProvenance.findMany({
      where: { id: { in: ids(snapshot.benefitStatusSourceProvenance) } },
      select: { benefitStatus: { select: { userId: true } } },
    }),
    client.amexSyncRowAudit.findMany({
      where: { id: { in: ids(snapshot.amexSyncRowAudits) } },
      select: { attempt: { select: { userId: true } } },
    }),
    snapshot.globalCatalogBindings?.ledger.length
      ? client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId" FROM "CatalogMigrationLedger"
        WHERE "id" IN (${Prisma.join(snapshot.globalCatalogBindings.ledger.map((row) => row.id))})
      `)
      : Promise.resolve([]),
    snapshot.categoryRepairs?.length
      ? client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId" FROM "GlobalBenefitCategoryRepair"
        WHERE "id" IN (${Prisma.join(snapshot.categoryRepairs.map((row) => row.id))})
          OR "legacyBenefitId" IN (${Prisma.join(snapshot.categoryRepairs.map((row) => row.legacyBenefitId))})
          OR "catalogMigrationLedgerId" IN (${Prisma.join(snapshot.categoryRepairs.map((row) => row.catalogMigrationLedgerId))})
      `)
      : Promise.resolve([]),
    snapshot.categoryRepairOccurrences?.length
      ? client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId" FROM "GlobalBenefitCategoryRepairOccurrence"
        WHERE "id" IN (${Prisma.join(snapshot.categoryRepairOccurrences.map((row) => row.id))})
          OR "keeperStatusId" IN (${Prisma.join(snapshot.categoryRepairOccurrences.map((row) => row.keeperStatusId))})
          OR ${allRemovedStatusIds.length > 0
            ? Prisma.sql`"removedStatusId" IN (${Prisma.join(allRemovedStatusIds)})`
            : Prisma.sql`FALSE`}
      `)
      : Promise.resolve([]),
  ]);
  return [
    ...users.map(() => ({ model: "User" as const, ownerUserId: snapshot.user.id })),
    ...cards.map((row) => ({ model: "CreditCard" as const, ownerUserId: row.userId })),
    ...benefits.map((row) => ({ model: "Benefit" as const, ownerUserId: ownerForBenefit(row) })),
    ...statuses.map((row) => ({ model: "BenefitStatus" as const, ownerUserId: row.userId })),
    ...removedStatuses.map((row) => ({ model: "BenefitStatus" as const, ownerUserId: row.userId })),
    ...events.map((row) => ({ model: "CreditCardEvent" as const, ownerUserId: row.userId })),
    ...loyaltyAccounts.map((row) => ({ model: "LoyaltyAccount" as const, ownerUserId: row.userId })),
    ...certificates.map((row) => ({ model: "LoyaltyCertificate" as const, ownerUserId: row.userId })),
    ...mappings.map((row) => ({ model: "ExternalCardMapping" as const, ownerUserId: row.userId })),
    ...attempts.map((row) => ({ model: "AmexSyncAttempt" as const, ownerUserId: row.userId })),
    ...provenance.map((row) => ({ model: "BenefitStatusSourceProvenance" as const, ownerUserId: row.benefitStatus.userId })),
    ...audits.map((row) => ({ model: "AmexSyncRowAudit" as const, ownerUserId: row.attempt.userId })),
    ...ledgerRows.map((row) => ({ model: "CatalogMigrationLedger" as const, ownerUserId: row.userId })),
    ...categoryRepairs.map((row) => ({ model: "GlobalBenefitCategoryRepair" as const, ownerUserId: row.userId })),
    ...categoryRepairOccurrences.map((row) => ({ model: "GlobalBenefitCategoryRepairOccurrence" as const, ownerUserId: row.userId })),
  ];
}

async function resolveLoyaltyPrograms(
  client: Prisma.TransactionClient | PrismaClient,
  snapshot: UserCloneSnapshot,
): Promise<Map<string, string>> {
  const names = Array.from(new Set(snapshot.loyaltyAccounts.map((account) => account.loyaltyProgramName)));
  if (names.length === 0) return new Map();
  const programs = await client.loyaltyProgram.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  const mapping = new Map(programs.map((program) => [program.name, program.id]));
  if (mapping.size !== names.length || names.some((name) => !mapping.has(name))) {
    throw new UserCloneOperatorError("A source loyalty program does not have one unique destination name match.");
  }
  return mapping;
}

interface DestinationGlobalCatalogMappings {
  cards: Map<string, string>;
  benefits: Map<string, string>;
  benefitParents: Map<string, string>;
}

async function resolveDestinationGlobalCatalog(
  client: Prisma.TransactionClient | PrismaClient,
  snapshot: UserCloneSnapshot,
): Promise<DestinationGlobalCatalogMappings> {
  const bindings = snapshot.globalCatalogBindings;
  if (!bindings) return { cards: new Map(), benefits: new Map(), benefitParents: new Map() };
  const repairs = snapshot.categoryRepairs ?? [];
  const cardKeys = Array.from(new Set([
    ...bindings.cards.map((row) => row.catalogKey),
    ...bindings.ledger.flatMap((row) => row.predefinedCardCatalogKey ? [row.predefinedCardCatalogKey] : []),
    ...repairs.map((row) => row.targetPredefinedCardCatalogKey),
  ]));
  const benefitKeys = Array.from(new Set([
    ...bindings.statuses.map((row) => row.catalogKey),
    ...bindings.audits.map((row) => row.catalogKey),
    ...bindings.ledger.flatMap((row) => row.predefinedBenefitCatalogKey ? [row.predefinedBenefitCatalogKey] : []),
    ...repairs.map((row) => row.targetPredefinedBenefitCatalogKey),
  ]));
  const [cards, benefits] = await Promise.all([
    cardKeys.length === 0 ? [] : client.$queryRaw<Array<{ id: string; catalogKey: string }>>(Prisma.sql`
      SELECT "id", "catalogKey" FROM "PredefinedCard"
      WHERE "catalogKey" IN (${Prisma.join(cardKeys)}) ORDER BY "catalogKey"
    `),
    benefitKeys.length === 0 ? [] : client.$queryRaw<Array<{ id: string; catalogKey: string; predefinedCardId: string }>>(Prisma.sql`
      SELECT "id", "catalogKey", "predefinedCardId" FROM "PredefinedBenefit"
      WHERE "catalogKey" IN (${Prisma.join(benefitKeys)}) ORDER BY "catalogKey"
    `),
  ]);
  const cardMap = new Map(cards.map((row) => [row.catalogKey, row.id]));
  const benefitMap = new Map(benefits.map((row) => [row.catalogKey, row.id]));
  if (cardMap.size !== cardKeys.length || benefitMap.size !== benefitKeys.length) {
    throw new UserCloneOperatorError("A global definition has no exact destination catalog-key match.");
  }
  planCloneGlobalCatalogRebindings(bindings, { cards, benefits });
  planCloneCategoryRepairRebindings(
    repairs,
    snapshot.categoryRepairOccurrences ?? [],
    { cards, benefits },
  );
  return {
    cards: cardMap,
    benefits: benefitMap,
    benefitParents: new Map(benefits.map((row) => [row.catalogKey, row.predefinedCardId])),
  };
}

async function findGlobalLedgerCollisions(
  client: Prisma.TransactionClient | PrismaClient,
  snapshot: UserCloneSnapshot,
  replaceableUserId: string | null,
): Promise<boolean> {
  const ledger = snapshot.globalCatalogBindings?.ledger ?? [];
  if (ledger.length === 0) return false;
  const rows = await client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT "userId" FROM "CatalogMigrationLedger"
    WHERE "id" IN (${Prisma.join(ledger.map((row) => row.id))})
      OR "legacyBenefitId" IN (${Prisma.join(ledger.map((row) => row.legacyBenefitId))})
  `);
  return rows.some((row) => replaceableUserId === null || row.userId !== replaceableUserId);
}

async function destinationPreflight(
  client: Prisma.TransactionClient | PrismaClient,
  snapshot: UserCloneSnapshot,
  replaceableUserId: string | null,
): Promise<DestinationPreflight> {
  await Promise.all([
    resolveLoyaltyPrograms(client, snapshot),
    resolveDestinationGlobalCatalog(client, snapshot),
  ]);
  const [collisions, ledgerCollision] = await Promise.all([
    findIdCollisions(client, snapshot),
    findGlobalLedgerCollisions(client, snapshot, replaceableUserId),
  ]);
  const blocking = collisions
    .filter((collision) => replaceableUserId === null || collision.ownerUserId !== replaceableUserId)
    .map((collision) => collision.model);
  if (ledgerCollision) blocking.push("CatalogMigrationLedger");
  return { blockingCollisionModels: Array.from(new Set(blocking)) };
}

export interface CloneWriteOperations {
  deleteCatalogMigrationLedger(userId: string): Promise<void>;
  deleteBenefitStatuses(userId: string): Promise<void>;
  deleteCreditCards(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  createUser(row: CloneUser): Promise<void>;
  createCreditCards(rows: CloneCreditCard[]): Promise<void>;
  createBenefits(rows: Benefit[]): Promise<void>;
  createBenefitStatuses(rows: BenefitStatus[]): Promise<void>;
  createCreditCardEvents(rows: CreditCardEvent[]): Promise<void>;
  createLoyaltyAccounts(rows: Array<Omit<CloneLoyaltyAccount, "loyaltyProgramName"> & { loyaltyProgramId: string }>): Promise<void>;
  createLoyaltyCertificates(rows: LoyaltyCertificate[]): Promise<void>;
  createExternalCardMappings(rows: ExternalCardMapping[]): Promise<void>;
  createAmexSyncAttempts(rows: AmexSyncAttempt[]): Promise<void>;
  createBenefitStatusSourceProvenance(rows: BenefitStatusSourceProvenance[]): Promise<void>;
  createAmexSyncRowAudits(rows: AmexSyncRowAudit[]): Promise<void>;
}

export async function writeUserCloneGraph(input: {
  snapshot: UserCloneSnapshot;
  replaceableUserId: string | null;
  loyaltyProgramIds: Map<string, string>;
  operations: CloneWriteOperations;
}): Promise<void> {
  const { snapshot, operations } = input;
  if (input.replaceableUserId !== null) {
    await operations.deleteCatalogMigrationLedger(input.replaceableUserId);
    // Global statuses hold restrictive card references and must be removed before
    // the established cards-before-user replacement order can proceed.
    await operations.deleteBenefitStatuses(input.replaceableUserId);
    await operations.deleteCreditCards(input.replaceableUserId);
    await operations.deleteUser(input.replaceableUserId);
  }
  await operations.createUser(snapshot.user);
  await operations.createCreditCards(snapshot.creditCards);
  await operations.createBenefits(snapshot.benefits);
  await operations.createBenefitStatuses(snapshot.benefitStatuses);
  await operations.createCreditCardEvents(snapshot.creditCardEvents);
  await operations.createLoyaltyAccounts(snapshot.loyaltyAccounts.map(({ loyaltyProgramName, ...account }) => {
    const loyaltyProgramId = input.loyaltyProgramIds.get(loyaltyProgramName);
    if (!loyaltyProgramId) throw new UserCloneOperatorError("A destination loyalty-program mapping disappeared during apply.");
    return { ...account, loyaltyProgramId };
  }));
  await operations.createLoyaltyCertificates(snapshot.loyaltyCertificates);
  await operations.createExternalCardMappings(snapshot.externalCardMappings);
  await operations.createAmexSyncAttempts(snapshot.amexSyncAttempts);
  await operations.createBenefitStatusSourceProvenance(snapshot.benefitStatusSourceProvenance);
  await operations.createAmexSyncRowAudits(snapshot.amexSyncRowAudits);
}

async function createManyIfPresent<T>(rows: T[], create: (rows: T[]) => Promise<{ count: number }>): Promise<void> {
  if (rows.length === 0) return;
  const result = await create(rows);
  if (result.count !== rows.length) throw new UserCloneOperatorError("A destination insert count did not match its source table.");
}

function prismaWriteOperations(transaction: Prisma.TransactionClient): CloneWriteOperations {
  return {
    async deleteCatalogMigrationLedger(userId) {
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "GlobalBenefitCategoryRepairOccurrence" WHERE "userId" = ${userId}
      `);
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "GlobalBenefitCategoryRepair" WHERE "userId" = ${userId}
      `);
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "CatalogMigrationLedger" WHERE "userId" = ${userId}
      `);
    },
    async deleteBenefitStatuses(userId) {
      await transaction.benefitStatus.deleteMany({ where: { userId } });
    },
    async deleteCreditCards(userId) {
      await transaction.creditCard.deleteMany({ where: { userId } });
    },
    async deleteUser(userId) {
      const result = await transaction.user.deleteMany({ where: { id: userId } });
      if (result.count !== 1) throw new UserCloneOperatorError("The replaceable development user changed before apply.");
    },
    async createUser(row) {
      await transaction.user.create({ data: row });
    },
    async createCreditCards(rows) {
      await createManyIfPresent(rows, (data) => transaction.creditCard.createMany({ data }));
    },
    async createBenefits(rows) {
      await createManyIfPresent(rows, (data) => transaction.benefit.createMany({ data }));
    },
    async createBenefitStatuses(rows) {
      await createManyIfPresent(rows, (data) => transaction.benefitStatus.createMany({ data }));
    },
    async createCreditCardEvents(rows) {
      const data: Prisma.CreditCardEventCreateManyInput[] = rows.map((row) => ({
        ...row,
        metadata: row.metadata === null ? Prisma.DbNull : row.metadata as Prisma.InputJsonValue,
      }));
      await createManyIfPresent(data, (values) => transaction.creditCardEvent.createMany({ data: values }));
    },
    async createLoyaltyAccounts(rows) {
      await createManyIfPresent(rows, (data) => transaction.loyaltyAccount.createMany({ data }));
    },
    async createLoyaltyCertificates(rows) {
      await createManyIfPresent(rows, (data) => transaction.loyaltyCertificate.createMany({ data }));
    },
    async createExternalCardMappings(rows) {
      await createManyIfPresent(rows, (data) => transaction.externalCardMapping.createMany({ data }));
    },
    async createAmexSyncAttempts(rows) {
      await createManyIfPresent(rows, (data) => transaction.amexSyncAttempt.createMany({ data }));
    },
    async createBenefitStatusSourceProvenance(rows) {
      await createManyIfPresent(rows, (data) => transaction.benefitStatusSourceProvenance.createMany({ data }));
    },
    async createAmexSyncRowAudits(rows) {
      await createManyIfPresent(rows, (data) => transaction.amexSyncRowAudit.createMany({ data }));
    },
  };
}

async function applyGlobalCatalogBindings(
  transaction: Prisma.TransactionClient,
  snapshot: UserCloneSnapshot,
  mappings: DestinationGlobalCatalogMappings,
): Promise<void> {
  const bindings = snapshot.globalCatalogBindings;
  if (!bindings) return;
  const cardId = (key: string | null): string | null => {
    if (key === null) return null;
    const id = mappings.cards.get(key);
    if (!id) throw new UserCloneOperatorError("A destination global-card binding disappeared during apply.");
    return id;
  };
  const benefitId = (key: string | null): string | null => {
    if (key === null) return null;
    const id = mappings.benefits.get(key);
    if (!id) throw new UserCloneOperatorError("A destination global-benefit binding disappeared during apply.");
    return id;
  };
  for (const row of bindings.cards) {
    const result = await transaction.$executeRaw(Prisma.sql`
      UPDATE "CreditCard" SET "predefinedCardId" = ${cardId(row.catalogKey)}
      WHERE "id" = ${row.creditCardId} AND "predefinedCardId" IS NULL
    `);
    if (result !== 1) throw new UserCloneOperatorError("A cloned card global binding failed.");
  }
  for (const row of bindings.statuses) {
    const result = await transaction.$executeRaw(Prisma.sql`
      UPDATE "BenefitStatus"
      SET "creditCardId" = ${row.creditCardId}, "predefinedBenefitId" = ${benefitId(row.catalogKey)}
      WHERE "id" = ${row.benefitStatusId}
        AND "creditCardId" IS NULL AND "predefinedBenefitId" IS NULL
    `);
    if (result !== 1) throw new UserCloneOperatorError("A cloned status global binding failed.");
  }
  for (const row of bindings.audits) {
    const result = await transaction.$executeRaw(Prisma.sql`
      UPDATE "AmexSyncRowAudit"
      SET "destinationPredefinedBenefitId" = ${benefitId(row.catalogKey)},
          "destinationDefinitionFingerprint" = ${row.definitionFingerprint}
      WHERE "id" = ${row.auditId} AND "destinationPredefinedBenefitId" IS NULL
    `);
    if (result !== 1) throw new UserCloneOperatorError("A cloned audit global binding failed.");
  }
  for (const row of bindings.ledger) {
    const result = await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "CatalogMigrationLedger" (
        "id", "legacyBenefitId", "userId", "creditCardId", "predefinedCardId",
        "predefinedBenefitId", "classification", "phase", "sourceFingerprint",
        "destinationFingerprint", "classifiedAt", "bridgedAt", "cleanedAt",
        "rolledBackAt", "createdAt", "updatedAt"
      ) VALUES (
        ${row.id}, ${row.legacyBenefitId}, ${row.userId}, ${row.creditCardId},
        ${cardId(row.predefinedCardCatalogKey)}, ${benefitId(row.predefinedBenefitCatalogKey)},
        ${row.classification}::"CatalogMigrationClassification",
        ${row.phase}::"CatalogMigrationPhase", ${row.sourceFingerprint},
        ${row.destinationFingerprint}, ${row.classifiedAt}, ${row.bridgedAt},
        ${row.cleanedAt}, ${row.rolledBackAt}, ${row.createdAt}, ${row.updatedAt}
      )
    `);
    if (result !== 1) throw new UserCloneOperatorError("A cloned migration-ledger insert failed.");
  }

  const categoryPlan = planCloneCategoryRepairRebindings(
    snapshot.categoryRepairs ?? [],
    snapshot.categoryRepairOccurrences ?? [],
    {
      cards: Array.from(mappings.cards, ([catalogKey, id]) => ({ id, catalogKey })),
      benefits: Array.from(mappings.benefits, ([catalogKey, id]) => ({
        id,
        catalogKey,
        predefinedCardId: mappings.benefitParents.get(catalogKey),
      })),
    },
  );
  for (const row of categoryPlan.repairs) {
    const result = await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "GlobalBenefitCategoryRepair" (
        "id", "legacyBenefitId", "catalogMigrationLedgerId", "userId",
        "creditCardId", "predefinedCardId", "predefinedBenefitId",
        "targetPredefinedCardCatalogKey", "targetPredefinedBenefitCatalogKey",
        "definitionFingerprint", "inventoryFingerprint", "graphFingerprint",
        "reviewedCurrentGraphFingerprint", "destinationFingerprint", "manifestFingerprint", "manifestEntryFingerprint",
        "planFingerprint", "postimageFingerprint", "evidenceVersion", "phase",
        "appliedAt", "rolledBackAt", "createdAt", "updatedAt"
      ) VALUES (
        ${row.id}, ${row.legacyBenefitId}, ${row.catalogMigrationLedgerId}, ${row.userId},
        ${row.creditCardId}, ${row.predefinedCardId}, ${row.predefinedBenefitId},
        ${row.targetPredefinedCardCatalogKey}, ${row.targetPredefinedBenefitCatalogKey},
        ${row.definitionFingerprint}, ${row.inventoryFingerprint}, ${row.graphFingerprint},
        ${row.reviewedCurrentGraphFingerprint}, ${row.destinationFingerprint}, ${row.manifestFingerprint}, ${row.manifestEntryFingerprint},
        ${row.planFingerprint}, ${row.postimageFingerprint}, ${row.evidenceVersion},
        ${row.phase}::"GlobalBenefitCategoryRepairPhase", ${row.appliedAt},
        ${row.rolledBackAt}, ${row.createdAt}, ${row.updatedAt}
      )
    `);
    if (result !== 1) throw new UserCloneOperatorError('A cloned category-repair insert failed.');
  }
  for (const row of categoryPlan.occurrences) {
    const result = await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "GlobalBenefitCategoryRepairOccurrence" (
        "id", "repairId", "userId", "creditCardId", "predefinedBenefitId",
        "targetPredefinedBenefitCatalogKey", "action", "keeperSource",
        "keeperStatusId", "cycleStartDate", "cycleEndDate", "occurrenceIndex",
        "keeperBaselineVersion", "keeperBaseline", "removedStatusId",
        "removedStatusSource", "removedStatusPreimageVersion", "removedStatusPreimage",
        "repairAddedAuditMetadataVersion", "repairAddedAuditMetadata",
        "planFingerprint", "postimageFingerprint", "createdAt", "updatedAt"
      ) VALUES (
        ${row.id}, ${row.repairId}, ${row.userId}, ${row.creditCardId},
        ${row.predefinedBenefitId}, ${row.targetPredefinedBenefitCatalogKey},
        ${row.action}::"GlobalBenefitCategoryRepairAction",
        ${row.keeperSource}::"GlobalBenefitCategoryRepairStatusSource",
        ${row.keeperStatusId}, ${row.cycleStartDate}, ${row.cycleEndDate},
        ${row.occurrenceIndex}, ${row.keeperBaselineVersion},
        ${JSON.stringify(row.keeperBaseline)}::jsonb, ${row.removedStatusId},
        ${row.removedStatusSource === null
          ? Prisma.sql`NULL`
          : Prisma.sql`${row.removedStatusSource}::"GlobalBenefitCategoryRepairStatusSource"`},
        ${row.removedStatusPreimageVersion}, ${row.removedStatusPreimage === null
          ? Prisma.sql`NULL`
          : Prisma.sql`${JSON.stringify(row.removedStatusPreimage)}::jsonb`},
        ${row.repairAddedAuditMetadataVersion},
        ${JSON.stringify(row.repairAddedAuditMetadata)}::jsonb, ${row.planFingerprint},
        ${row.postimageFingerprint}, ${row.createdAt}, ${row.updatedAt}
      )
    `);
    if (result !== 1) throw new UserCloneOperatorError('A cloned category-repair occurrence insert failed.');
  }
}

async function countDestinationGraph(
  transaction: Prisma.TransactionClient,
  snapshot: UserCloneSnapshot,
): Promise<UserCloneCounts> {
  const userId = snapshot.user.id;
  const [
    user,
    creditCards,
    benefits,
    benefitStatuses,
    creditCardEvents,
    loyaltyAccounts,
    loyaltyCertificates,
    externalCardMappings,
    amexSyncAttempts,
    benefitStatusSourceProvenance,
    amexSyncRowAudits,
    catalogMigrationLedger,
    categoryRepairs,
    categoryRepairOccurrences,
  ] = await Promise.all([
    transaction.user.count({ where: { id: userId } }),
    transaction.creditCard.count({ where: { userId } }),
    transaction.benefit.count({ where: { OR: [{ userId }, { creditCard: { userId } }] } }),
    transaction.benefitStatus.count({ where: { userId } }),
    transaction.creditCardEvent.count({ where: { userId } }),
    transaction.loyaltyAccount.count({ where: { userId } }),
    transaction.loyaltyCertificate.count({ where: { userId } }),
    transaction.externalCardMapping.count({ where: { userId } }),
    transaction.amexSyncAttempt.count({ where: { userId } }),
    transaction.benefitStatusSourceProvenance.count({ where: { benefitStatus: { userId } } }),
    transaction.amexSyncRowAudit.count({ where: { attempt: { userId } } }),
    transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count" FROM "CatalogMigrationLedger" WHERE "userId" = ${userId}
    `).then((rows) => Number(rows[0]?.count ?? 0)),
    transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count" FROM "GlobalBenefitCategoryRepair" WHERE "userId" = ${userId}
    `).then((rows) => Number(rows[0]?.count ?? 0)),
    transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count" FROM "GlobalBenefitCategoryRepairOccurrence" WHERE "userId" = ${userId}
    `).then((rows) => Number(rows[0]?.count ?? 0)),
  ]);
  return {
    User: user,
    CreditCard: creditCards,
    Benefit: benefits,
    BenefitStatus: benefitStatuses,
    CreditCardEvent: creditCardEvents,
    LoyaltyAccount: loyaltyAccounts,
    LoyaltyCertificate: loyaltyCertificates,
    ExternalCardMapping: externalCardMappings,
    AmexSyncAttempt: amexSyncAttempts,
    BenefitStatusSourceProvenance: benefitStatusSourceProvenance,
    AmexSyncRowAudit: amexSyncRowAudits,
    CatalogMigrationLedger: catalogMigrationLedger,
    GlobalBenefitCategoryRepair: categoryRepairs,
    GlobalBenefitCategoryRepairOccurrence: categoryRepairOccurrences,
  };
}

async function verifyDestinationGraph(
  transaction: Prisma.TransactionClient,
  snapshot: UserCloneSnapshot,
  loyaltyProgramIds: Map<string, string>,
): Promise<UserCloneCounts> {
  const expected = countUserCloneSnapshot(snapshot);
  const actual = await countDestinationGraph(transaction, snapshot);
  for (const table of Object.keys(expected) as UserCloneTable[]) {
    if (actual[table] !== expected[table]) {
      throw new UserCloneOperatorError("Destination verification found a table-count mismatch.");
    }
  }

  const [
    user,
    cards,
    benefits,
    statuses,
    events,
    accounts,
    certificates,
    mappings,
    provenance,
    audits,
  ] = await Promise.all([
    transaction.user.findUnique({
      where: { id: snapshot.user.id },
      select: { email: true, emailVerified: true, password: true },
    }),
    transaction.creditCard.findMany({
      where: { id: { in: snapshot.creditCards.map((card) => card.id) } },
      select: { id: true, userId: true, cardNumber: true },
    }),
    transaction.benefit.findMany({
      where: { id: { in: snapshot.benefits.map((benefit) => benefit.id) } },
      select: { id: true, userId: true, creditCardId: true },
    }),
    transaction.benefitStatus.findMany({
      where: { id: { in: snapshot.benefitStatuses.map((status) => status.id) } },
    }),
    transaction.creditCardEvent.findMany({
      where: { id: { in: snapshot.creditCardEvents.map((event) => event.id) } },
      select: { id: true, userId: true, creditCardId: true },
    }),
    transaction.loyaltyAccount.findMany({
      where: { id: { in: snapshot.loyaltyAccounts.map((account) => account.id) } },
      select: { id: true, userId: true, accountNumber: true, loyaltyProgramId: true },
    }),
    transaction.loyaltyCertificate.findMany({
      where: { id: { in: snapshot.loyaltyCertificates.map((certificate) => certificate.id) } },
      select: { id: true, userId: true, loyaltyAccountId: true },
    }),
    transaction.externalCardMapping.findMany({
      where: { id: { in: snapshot.externalCardMappings.map((mapping) => mapping.id) } },
      select: { id: true, userId: true, creditCardId: true },
    }),
    transaction.benefitStatusSourceProvenance.findMany({
      where: { id: { in: snapshot.benefitStatusSourceProvenance.map((row) => row.id) } },
      select: { id: true, benefitStatusId: true, attemptId: true },
    }),
    transaction.amexSyncRowAudit.findMany({
      where: { id: { in: snapshot.amexSyncRowAudits.map((audit) => audit.id) } },
      select: {
        id: true,
        attemptId: true,
        destinationCardId: true,
        destinationBenefitId: true,
        destinationStatusId: true,
      },
    }),
  ]);
  if (!user || user.email !== snapshot.user.email || user.emailVerified?.getTime() !== snapshot.user.emailVerified?.getTime() || user.password !== null) {
    throw new UserCloneOperatorError("Destination user verification failed the sanitized copy policy.");
  }
  if (cards.some((card) => card.userId !== snapshot.user.id || card.cardNumber !== null)) {
    throw new UserCloneOperatorError("Destination card verification failed the sanitized copy policy.");
  }
  const byId = <T extends { id: string }>(rows: T[]): Map<string, T> => new Map(rows.map((row) => [row.id, row]));
  const copiedBenefits = byId(benefits);
  const copiedStatuses = byId(statuses);
  const copiedEvents = byId(events);
  const copiedCertificates = byId(certificates);
  const copiedMappings = byId(mappings);
  const copiedProvenance = byId(provenance);
  const copiedAudits = byId(audits);
  if (snapshot.benefits.some((source) => {
    const copied = copiedBenefits.get(source.id);
    return !copied || copied.userId !== source.userId || copied.creditCardId !== source.creditCardId;
  }) || snapshot.benefitStatuses.some((source) => {
    const copied = copiedStatuses.get(source.id);
    return !copied || copied.userId !== source.userId || copied.benefitId !== source.benefitId;
  }) || snapshot.creditCardEvents.some((source) => {
    const copied = copiedEvents.get(source.id);
    return !copied || copied.userId !== source.userId || copied.creditCardId !== source.creditCardId;
  }) || snapshot.loyaltyCertificates.some((source) => {
    const copied = copiedCertificates.get(source.id);
    return !copied || copied.userId !== source.userId || copied.loyaltyAccountId !== source.loyaltyAccountId;
  }) || snapshot.externalCardMappings.some((source) => {
    const copied = copiedMappings.get(source.id);
    return !copied || copied.userId !== source.userId || copied.creditCardId !== source.creditCardId;
  }) || snapshot.benefitStatusSourceProvenance.some((source) => {
    const copied = copiedProvenance.get(source.id);
    return !copied || copied.benefitStatusId !== source.benefitStatusId || copied.attemptId !== source.attemptId;
  }) || snapshot.amexSyncRowAudits.some((source) => {
    const copied = copiedAudits.get(source.id);
    return !copied
      || copied.attemptId !== source.attemptId
      || copied.destinationCardId !== source.destinationCardId
      || copied.destinationBenefitId !== source.destinationBenefitId
      || copied.destinationStatusId !== source.destinationStatusId;
  })) {
    throw new UserCloneOperatorError("Destination referential verification found a changed relationship.");
  }
  const sourceAccountById = new Map(snapshot.loyaltyAccounts.map((account) => [account.id, account]));
  if (accounts.some((account) => {
    const source = sourceAccountById.get(account.id);
    return account.userId !== snapshot.user.id
      || account.accountNumber !== null
      || !source
      || loyaltyProgramIds.get(source.loyaltyProgramName) !== account.loyaltyProgramId;
  })) {
    throw new UserCloneOperatorError("Destination loyalty verification failed its ownership or mapping invariant.");
  }

  const reboundGlobalCatalogBindings = snapshot.globalCatalogBindings
    ? await readGlobalCatalogBindings(transaction, snapshot.user.id)
    : undefined;
  if (reboundGlobalCatalogBindings
    && JSON.stringify(reboundGlobalCatalogBindings) !== JSON.stringify(snapshot.globalCatalogBindings)) {
    throw new UserCloneOperatorError("Destination global-catalog rebinding verification failed.");
  }

  const globalMappings = await resolveDestinationGlobalCatalog(transaction, snapshot);
  const expectedCategoryEvidence = planCloneCategoryRepairRebindings(
    snapshot.categoryRepairs ?? [],
    snapshot.categoryRepairOccurrences ?? [],
    {
      cards: Array.from(globalMappings.cards, ([catalogKey, id]) => ({ id, catalogKey })),
      benefits: Array.from(globalMappings.benefits, ([catalogKey, id]) => ({
        id,
        catalogKey,
        predefinedCardId: globalMappings.benefitParents.get(catalogKey),
      })),
    },
  );
  const [
    copiedCategoryRepairs,
    copiedCategoryOccurrences,
    copiedCategoryStateFingerprints,
  ] = await Promise.all([
    transaction.$queryRaw<CloneCategoryRepair[]>(Prisma.sql`
      SELECT r.*, pc."catalogKey" AS "resolvedPredefinedCardCatalogKey",
        pb."catalogKey" AS "resolvedPredefinedBenefitCatalogKey",
        (pb."predefinedCardId" = r."predefinedCardId") AS "predefinedBenefitParentMatchesCard"
      FROM "GlobalBenefitCategoryRepair" r
      JOIN "PredefinedCard" pc ON pc."id" = r."predefinedCardId"
      JOIN "PredefinedBenefit" pb ON pb."id" = r."predefinedBenefitId"
      WHERE r."userId" = ${snapshot.user.id}
      ORDER BY r."id"
    `),
    transaction.$queryRaw<CloneCategoryRepairOccurrence[]>(Prisma.sql`
      SELECT *, "removedStatusPreimage" IS NULL AS "removedStatusPreimageIsSqlNull",
        jsonb_typeof("removedStatusPreimage") AS "removedStatusPreimageJsonType"
      FROM "GlobalBenefitCategoryRepairOccurrence"
      WHERE "userId" = ${snapshot.user.id}
      ORDER BY "cycleStartDate", "cycleEndDate", "occurrenceIndex", "keeperStatusId", "id"
    `),
    readCategoryRepairStateFingerprints(transaction, snapshot.user.id),
  ]);
  if (!cloneEvidenceMatches(copiedCategoryRepairs, expectedCategoryEvidence.repairs)
    || !cloneEvidenceMatches(copiedCategoryOccurrences, expectedCategoryEvidence.occurrences)
    || (snapshot.categoryRepairStateFingerprints !== undefined
      && !cloneEvidenceMatches(
        copiedCategoryStateFingerprints,
        snapshot.categoryRepairStateFingerprints,
      ))) {
    throw new UserCloneOperatorError("Destination category-repair rebinding verification failed.");
  }
  const legacyDestinationStatuses = statuses.map((status) => {
    const projected = { ...status } as Record<string, unknown>;
    delete projected.creditCardId;
    delete projected.predefinedBenefitId;
    return projected as unknown as BenefitStatus;
  });
  validateUserCloneSnapshot({
    ...snapshot,
    benefitStatuses: legacyDestinationStatuses,
    globalCatalogBindings: reboundGlobalCatalogBindings,
    categoryRepairStateFingerprints: copiedCategoryStateFingerprints,
    categoryRepairs: copiedCategoryRepairs,
    categoryRepairOccurrences: copiedCategoryOccurrences,
  }, snapshot.user.email);

  const collisions = await findIdCollisions(transaction, snapshot);
  if (collisions.length !== Object.values(expected).reduce((sum, count) => sum + count, 0)) {
    throw new UserCloneOperatorError("Destination referential verification did not recover every copied row.");
  }
  if (collisions.some((collision) => collision.ownerUserId !== snapshot.user.id)) {
    throw new UserCloneOperatorError("Destination referential verification found a cross-user row.");
  }
  return actual;
}

export class PrismaUserCloneDestination implements UserCloneDestinationPort {
  constructor(
    private readonly client: PrismaClient,
    private readonly databaseUrl: string,
  ) {}

  identify(): Promise<InternalDatabaseIdentity> {
    return queryDatabaseIdentity(this.client, this.databaseUrl);
  }

  async findUsersByNormalizedEmail(normalizedEmail: string): Promise<Array<{ id: string }>> {
    const users = await this.client.user.findMany({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true },
      take: 2,
    });
    return users.filter((user) => user.email.toLowerCase() === normalizedEmail).map(({ id }) => ({ id }));
  }

  preflight(snapshot: UserCloneSnapshot, replaceableUserId: string | null): Promise<DestinationPreflight> {
    return destinationPreflight(this.client, snapshot, replaceableUserId);
  }

  apply(input: {
    snapshot: UserCloneSnapshot;
    normalizedEmail: string;
    replaceableUserId: string | null;
    expectedIdentity: InternalDatabaseIdentity;
  }): Promise<UserCloneCounts> {
    validateUserCloneSnapshot(input.snapshot, input.normalizedEmail);
    return this.client.$transaction(async (transaction) => {
      const transactionIdentity = await queryDatabaseIdentity(transaction, this.databaseUrl);
      if (transactionIdentity.fingerprint !== input.expectedIdentity.fingerprint) {
        throw new UserCloneOperatorError("The destination target identity changed before apply.");
      }
      const currentUsers = await transaction.user.findMany({
        where: { email: { equals: input.normalizedEmail, mode: "insensitive" } },
        select: { id: true, email: true },
        take: 2,
      });
      const exactUsers = currentUsers.filter((user) => user.email.toLowerCase() === input.normalizedEmail);
      const currentReplaceId = exactUsers.length === 1 ? exactUsers[0].id : null;
      if (exactUsers.length > 1 || currentReplaceId !== input.replaceableUserId) {
        throw new UserCloneOperatorError("The destination user changed after preflight.");
      }
      const preflight = await destinationPreflight(transaction, input.snapshot, input.replaceableUserId);
      if (preflight.blockingCollisionModels.length > 0) {
        throw new UserCloneOperatorError("Destination collisions appeared after preflight.");
      }
      const [loyaltyProgramIds, globalCatalogMappings] = await Promise.all([
        resolveLoyaltyPrograms(transaction, input.snapshot),
        resolveDestinationGlobalCatalog(transaction, input.snapshot),
      ]);
      await writeUserCloneGraph({
        snapshot: input.snapshot,
        replaceableUserId: input.replaceableUserId,
        loyaltyProgramIds,
        operations: prismaWriteOperations(transaction),
      });
      await applyGlobalCatalogBindings(transaction, input.snapshot, globalCatalogMappings);
      return verifyDestinationGraph(transaction, input.snapshot, loyaltyProgramIds);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export function createIndependentUserCloneClients(input: {
  sourceDatabaseUrl: string;
  destinationDatabaseUrl: string;
}): {
  sourceClient: PrismaClient;
  destinationClient: PrismaClient;
  source: PrismaUserCloneSource;
  destination: PrismaUserCloneDestination;
} {
  const sourceClient = new PrismaClient({ datasourceUrl: input.sourceDatabaseUrl });
  const destinationClient = new PrismaClient({ datasourceUrl: input.destinationDatabaseUrl });
  return {
    sourceClient,
    destinationClient,
    source: new PrismaUserCloneSource(sourceClient, input.sourceDatabaseUrl),
    destination: new PrismaUserCloneDestination(destinationClient, input.destinationDatabaseUrl),
  };
}
