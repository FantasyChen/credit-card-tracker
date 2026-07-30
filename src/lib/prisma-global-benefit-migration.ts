import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma";
import {
  GlobalBenefitMigrationError,
  classifyLegacyMigrationUnit,
  migrationFingerprint,
  type ClassifiedMigrationUnit,
  type ExistingMigrationLedger,
  type GlobalBenefitDefinition,
  type GlobalBenefitMigrationDatabase,
  type GlobalCardDefinition,
  type LegacyAuditRelation,
  type LegacyBenefitRecord,
  type LegacyMigrationSnapshot,
  type LegacyMigrationUnit,
  type LegacyProvenanceRelation,
  type LegacyStatusRelation,
  type MigrationWriteResult,
} from "./global-benefit-migration";

type QueryClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

interface UnitKeyRow { unitKey: string }
interface CardRow {
  id: string; name: string; issuer: string; userId: string;
  productKey: string | null; predefinedCardId: string | null;
}
interface BenefitRow {
  id: string; category: string; description: string; percentage: number;
  maxAmount: number | null; frequency: string; creditCardId: string | null;
  userId: string | null; cycleAlignment: string | null;
  fixedCycleDurationMonths: number | null; fixedCycleStartMonth: number | null;
  occurrencesInCycle: number; productKey: string | null;
  creditFamilyKey: string | null; periodKey: string | null;
}
interface StatusRow {
  id: string; benefitId: string | null; creditCardId: string | null;
  predefinedBenefitId: string | null; userId: string; cycleStartDate: Date;
  cycleEndDate: Date; occurrenceIndex: number; stateJson: unknown;
}
interface AuditRow {
  id: string; attemptUserId: string; destinationCardId: string | null;
  destinationBenefitId: string | null; destinationPredefinedBenefitId: string | null;
  destinationStatusId: string | null; destinationDefinitionFingerprint: string | null;
  stateJson: unknown;
}
interface ProvenanceRow { id: string; benefitStatusId: string; attemptUserId: string | null }
type LedgerRow = ExistingMigrationLedger;
interface DefinitionCardRow {
  id: string; catalogKey: string; name: string; issuer: string;
  productKey: string | null; retiredAt: Date | null;
}
interface DefinitionBenefitRow {
  id: string; catalogKey: string; predefinedCardId: string; category: string;
  description: string; percentage: number; maxAmount: number | null;
  frequency: string; cycleAlignment: string | null;
  fixedCycleStartMonth: number | null; fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number; productKey: string | null;
  creditFamilyKey: string | null; periodKey: string | null; retiredAt: Date | null;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function rawJsonState(value: unknown): Record<string, unknown> {
  return typeof value === "string" ? JSON.parse(value) as Record<string, unknown> : value as Record<string, unknown>;
}

function stableStatusState(row: StatusRow): string {
  const state = { ...rawJsonState(row.stateJson) };
  delete state.creditCardId;
  delete state.predefinedBenefitId;
  return migrationFingerprint(state);
}

function stableAuditState(row: AuditRow): string {
  const state = { ...rawJsonState(row.stateJson) };
  delete state.destinationPredefinedBenefitId;
  delete state.destinationDefinitionFingerprint;
  return migrationFingerprint(state);
}

async function readDefinitions(client: QueryClient): Promise<GlobalCardDefinition[]> {
  const [cards, benefits] = await Promise.all([
    client.$queryRaw<DefinitionCardRow[]>(Prisma.sql`
      SELECT "id", "catalogKey", "name", "issuer", "productKey", "retiredAt"
      FROM "PredefinedCard"
      WHERE "catalogKey" IS NOT NULL
      ORDER BY "id" ASC
    `),
    client.$queryRaw<DefinitionBenefitRow[]>(Prisma.sql`
      SELECT "id", "catalogKey", "predefinedCardId", "category", "description",
        "percentage", "maxAmount", "frequency"::text AS "frequency",
        "cycleAlignment"::text AS "cycleAlignment", "fixedCycleStartMonth",
        "fixedCycleDurationMonths", "occurrencesInCycle", "productKey",
        "creditFamilyKey", "periodKey", "retiredAt"
      FROM "PredefinedBenefit"
      WHERE "catalogKey" IS NOT NULL
      ORDER BY "id" ASC
    `),
  ]);
  const byCard = new Map<string, GlobalBenefitDefinition[]>();
  for (const row of benefits) {
    const definition: GlobalBenefitDefinition = {
      ...row,
      catalogKey: row.catalogKey,
      frequency: row.frequency,
      cycleAlignment: row.cycleAlignment,
      retiredAt: row.retiredAt === null ? null : asDate(row.retiredAt),
    };
    const current = byCard.get(row.predefinedCardId) ?? [];
    current.push(definition);
    byCard.set(row.predefinedCardId, current);
  }
  return cards.map((card) => ({
    ...card,
    retiredAt: card.retiredAt === null ? null : asDate(card.retiredAt),
    benefits: byCard.get(card.id) ?? [],
  }));
}

async function readUnitKeys(
  client: QueryClient,
  afterCursorDigest: string | null,
  limit: number,
): Promise<{ keys: string[]; hasMore: boolean }> {
  let afterPrivateKey: string | null = null;
  if (afterCursorDigest !== null) {
    const cursorRows = await client.$queryRaw<UnitKeyRow[]>(Prisma.sql`
      SELECT "unitKey"
      FROM (
        SELECT ('card:' || c."id")::text AS "unitKey"
        FROM "CreditCard" c
        WHERE EXISTS (SELECT 1 FROM "Benefit" b WHERE b."creditCardId" = c."id")
        UNION ALL
        SELECT ('standalone:' || "id")::text AS "unitKey"
        FROM "Benefit" WHERE "creditCardId" IS NULL
      ) units
      WHERE md5('global-benefit-migration/v2:' || "unitKey") = ${afterCursorDigest}
      LIMIT 2
    `);
    if (cursorRows.length !== 1) {
      throw new GlobalBenefitMigrationError("The migration cursor is invalid for the current source.");
    }
    afterPrivateKey = cursorRows[0].unitKey;
  }

  const rows = await client.$queryRaw<UnitKeyRow[]>(Prisma.sql`
    SELECT "unitKey"
    FROM (
      SELECT ('card:' || c."id")::text AS "unitKey"
      FROM "CreditCard" c
      WHERE EXISTS (SELECT 1 FROM "Benefit" b WHERE b."creditCardId" = c."id")
      UNION ALL
      SELECT ('standalone:' || "id")::text AS "unitKey"
      FROM "Benefit" WHERE "creditCardId" IS NULL
    ) units
    WHERE ${afterPrivateKey === null ? Prisma.sql`TRUE` : Prisma.sql`"unitKey" > ${afterPrivateKey}`}
    ORDER BY "unitKey" ASC
    LIMIT ${limit + 1}
  `);
  return { keys: rows.slice(0, limit).map((row) => row.unitKey), hasMore: rows.length > limit };
}

async function readUnitsByKeys(client: QueryClient, keys: readonly string[]): Promise<LegacyMigrationUnit[]> {
  if (keys.length === 0) return [];
  const cardIds = keys.filter((key) => key.startsWith("card:")).map((key) => key.slice("card:".length));
  const standaloneIds = keys.filter((key) => key.startsWith("standalone:")).map((key) => key.slice("standalone:".length));
  if (cardIds.length + standaloneIds.length !== keys.length || keys.some((key) => !key.split(":", 2)[1])) {
    throw new GlobalBenefitMigrationError("The database returned an invalid private migration key.");
  }

  const cards = cardIds.length === 0 ? [] : await client.$queryRaw<CardRow[]>(Prisma.sql`
    SELECT "id", "name", "issuer", "userId", "productKey", "predefinedCardId"
    FROM "CreditCard" WHERE "id" IN (${Prisma.join(cardIds)}) ORDER BY "id" ASC
  `);
  const benefits = await client.$queryRaw<BenefitRow[]>(Prisma.sql`
    SELECT "id", "category", "description", "percentage", "maxAmount",
      "frequency"::text AS "frequency", "creditCardId", "userId",
      "cycleAlignment"::text AS "cycleAlignment", "fixedCycleDurationMonths",
      "fixedCycleStartMonth", "occurrencesInCycle", "productKey",
      "creditFamilyKey", "periodKey"
    FROM "Benefit"
    WHERE ${Prisma.join([
      cardIds.length > 0 ? Prisma.sql`"creditCardId" IN (${Prisma.join(cardIds)})` : Prisma.sql`FALSE`,
      standaloneIds.length > 0 ? Prisma.sql`"id" IN (${Prisma.join(standaloneIds)})` : Prisma.sql`FALSE`,
    ], " OR ")}
    ORDER BY "id" ASC
  `);
  const benefitIds = benefits.map((benefit) => benefit.id);
  const statuses = benefitIds.length === 0 ? [] : await client.$queryRaw<StatusRow[]>(Prisma.sql`
    SELECT bs."id", bs."benefitId", bs."creditCardId", bs."predefinedBenefitId",
      bs."userId", bs."cycleStartDate", bs."cycleEndDate", bs."occurrenceIndex",
      to_jsonb(bs) AS "stateJson"
    FROM "BenefitStatus" bs
    WHERE bs."benefitId" IN (${Prisma.join(benefitIds)})
    ORDER BY bs."id" ASC
  `);
  const statusIds = statuses.map((status) => status.id);
  const provenance = statusIds.length === 0 ? [] : await client.$queryRaw<ProvenanceRow[]>(Prisma.sql`
    SELECT p."id", p."benefitStatusId", a."userId" AS "attemptUserId"
    FROM "BenefitStatusSourceProvenance" p
    LEFT JOIN "AmexSyncAttempt" a ON a."id" = p."attemptId"
    WHERE p."benefitStatusId" IN (${Prisma.join(statusIds)})
    ORDER BY p."id" ASC
  `);
  const auditPredicates = [
    benefitIds.length > 0 ? Prisma.sql`r."destinationBenefitId" IN (${Prisma.join(benefitIds)})` : Prisma.sql`FALSE`,
    statusIds.length > 0 ? Prisma.sql`r."destinationStatusId" IN (${Prisma.join(statusIds)})` : Prisma.sql`FALSE`,
    cardIds.length > 0 ? Prisma.sql`r."destinationCardId" IN (${Prisma.join(cardIds)})` : Prisma.sql`FALSE`,
  ];
  const audits = await client.$queryRaw<AuditRow[]>(Prisma.sql`
    SELECT r."id", a."userId" AS "attemptUserId", r."destinationCardId",
      r."destinationBenefitId", r."destinationPredefinedBenefitId",
      r."destinationStatusId", r."destinationDefinitionFingerprint", to_jsonb(r) AS "stateJson"
    FROM "AmexSyncRowAudit" r
    JOIN "AmexSyncAttempt" a ON a."id" = r."attemptId"
    WHERE ${Prisma.join(auditPredicates, " OR ")}
    ORDER BY r."id" ASC
  `);
  const ledgers = benefitIds.length === 0 ? [] : await client.$queryRaw<LedgerRow[]>(Prisma.sql`
    SELECT "legacyBenefitId", "userId", "creditCardId", "predefinedCardId",
      "predefinedBenefitId", "classification"::text AS "classification",
      "phase"::text AS "phase", "sourceFingerprint", "destinationFingerprint"
    FROM "CatalogMigrationLedger"
    WHERE "legacyBenefitId" IN (${Prisma.join(benefitIds)})
    ORDER BY "legacyBenefitId" ASC
  `);

  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const ledgerByBenefit = new Map(ledgers.map((ledger) => [ledger.legacyBenefitId, ledger]));
  const records = new Map<string, LegacyBenefitRecord>();
  for (const row of benefits) {
    const benefitStatuses: LegacyStatusRelation[] = statuses
      .filter((status) => status.benefitId === row.id)
      .map((status) => ({
        id: status.id,
        benefitId: status.benefitId,
        creditCardId: status.creditCardId,
        predefinedBenefitId: status.predefinedBenefitId,
        userId: status.userId,
        cycleStartDate: asDate(status.cycleStartDate),
        cycleEndDate: asDate(status.cycleEndDate),
        occurrenceIndex: status.occurrenceIndex,
        stateFingerprint: stableStatusState(status),
      }));
    const ownedStatusIds = new Set(benefitStatuses.map((status) => status.id));
    const benefitAudits: LegacyAuditRelation[] = audits.filter((audit) =>
      audit.destinationBenefitId === row.id
      || (audit.destinationStatusId !== null && ownedStatusIds.has(audit.destinationStatusId)))
      .map(({ stateJson: _stateJson, ...audit }) => ({
        ...audit,
        stateFingerprint: stableAuditState({ ...audit, stateJson: _stateJson }),
      }));
    const benefitProvenance: LegacyProvenanceRelation[] = provenance.filter((item) =>
      ownedStatusIds.has(item.benefitStatusId));
    records.set(row.id, {
      ...row,
      statuses: benefitStatuses,
      audits: benefitAudits,
      provenance: benefitProvenance,
      ledger: ledgerByBenefit.get(row.id) ?? null,
    });
  }

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const units = keys.map((key): LegacyMigrationUnit => {
    if (key.startsWith("card:")) {
      const id = key.slice("card:".length);
      const card = cardById.get(id);
      if (!card) throw new GlobalBenefitMigrationError("A migration unit changed while its batch was read.");
      const cardAudits: LegacyAuditRelation[] = audits
        .filter((audit) => audit.destinationCardId === id
          && audit.destinationBenefitId === null
          && audit.destinationStatusId === null)
        .map(({ stateJson: _stateJson, ...audit }) => ({
          ...audit,
          stateFingerprint: stableAuditState({ ...audit, stateJson: _stateJson }),
        }));
      return {
        key,
        card,
        benefits: benefits.filter((benefit) => benefit.creditCardId === id).map((benefit) => records.get(benefit.id)!),
        cardAudits,
      };
    }
    const id = key.slice("standalone:".length);
    const benefit = records.get(id);
    if (!benefit || benefit.creditCardId !== null) {
      throw new GlobalBenefitMigrationError("A standalone migration unit changed while its batch was read.");
    }
    return { key, card: null, benefits: [benefit] };
  });

  // Every selected audit must belong to exactly one loaded benefit/status or be
  // explicit card-only evidence. Never silently omit a malformed cross-card link.
  const attachedAuditCounts = new Map<string, number>();
  records.forEach((record) => {
    for (const audit of record.audits) {
      attachedAuditCounts.set(audit.id, (attachedAuditCounts.get(audit.id) ?? 0) + 1);
    }
  });
  for (const unit of units) {
    for (const audit of unit.cardAudits ?? []) {
      attachedAuditCounts.set(audit.id, (attachedAuditCounts.get(audit.id) ?? 0) + 1);
    }
  }
  if (audits.some((audit) => attachedAuditCounts.get(audit.id) !== 1)) {
    throw new GlobalBenefitMigrationError("An audit relationship is inconsistent with its migration unit.");
  }

  // Detect inbound provenance whose status was unexpectedly absent rather than silently omitting it.
  if (provenance.some((row) => !statusById.has(row.benefitStatusId))) {
    throw new GlobalBenefitMigrationError("A provenance relationship changed while its batch was read.");
  }
  return units;
}

async function readOneUnit(client: QueryClient, key: string): Promise<LegacyMigrationUnit> {
  const units = await readUnitsByKeys(client, [key]);
  if (units.length !== 1) throw new GlobalBenefitMigrationError("The migration unit no longer exists.");
  return units[0];
}

function emptyWriteResult(): MigrationWriteResult {
  return { standard: 0, custom: 0, cleaned: 0, rolledBack: 0, idempotent: 0 };
}

async function ensureCurrentPlan(
  client: QueryClient,
  expected: ClassifiedMigrationUnit,
): Promise<{ current: LegacyMigrationUnit; definitions: GlobalCardDefinition[]; classified: ClassifiedMigrationUnit }> {
  const [current, definitions] = await Promise.all([readOneUnit(client, expected.privateUnitKey), readDefinitions(client)]);
  const classified = classifyLegacyMigrationUnit(current, definitions);
  if (classified.unitFingerprint !== expected.unitFingerprint || classified.blocked || expected.blocked) {
    throw new GlobalBenefitMigrationError("The migration source changed; run a new dry-run.");
  }
  return { current, definitions, classified };
}

async function upsertLedger(
  client: QueryClient,
  input: {
    benefit: LegacyBenefitRecord;
    ownerId: string;
    cardId: string | null;
    predefinedCardId: string | null;
    predefinedBenefitId: string | null;
    classification: "STANDARD" | "CUSTOM";
    phase: "CLASSIFIED" | "BRIDGED";
    sourceFingerprint: string;
    destinationFingerprint: string | null;
  },
): Promise<"created" | "updated" | "idempotent"> {
  const current = input.benefit.ledger;
  if (current
    && current.userId === input.ownerId
    && current.creditCardId === input.cardId
    && current.predefinedCardId === input.predefinedCardId
    && current.predefinedBenefitId === input.predefinedBenefitId
    && current.classification === input.classification
    && current.phase === input.phase
    && current.sourceFingerprint === input.sourceFingerprint
    && current.destinationFingerprint === input.destinationFingerprint) return "idempotent";

  const result = await client.$executeRaw(Prisma.sql`
    INSERT INTO "CatalogMigrationLedger" (
      "id", "legacyBenefitId", "userId", "creditCardId", "predefinedCardId",
      "predefinedBenefitId", "classification", "phase", "sourceFingerprint",
      "destinationFingerprint", "classifiedAt", "bridgedAt", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${input.benefit.id}, ${input.ownerId}, ${input.cardId},
      ${input.predefinedCardId}, ${input.predefinedBenefitId},
      ${input.classification}::"CatalogMigrationClassification",
      ${input.phase}::"CatalogMigrationPhase", ${input.sourceFingerprint},
      ${input.destinationFingerprint}, CURRENT_TIMESTAMP,
      ${input.phase === "BRIDGED" ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`NULL`},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("legacyBenefitId") DO UPDATE SET
      "predefinedCardId" = EXCLUDED."predefinedCardId",
      "predefinedBenefitId" = EXCLUDED."predefinedBenefitId",
      "phase" = EXCLUDED."phase",
      "bridgedAt" = CASE WHEN EXCLUDED."phase" = 'BRIDGED' THEN CURRENT_TIMESTAMP ELSE "CatalogMigrationLedger"."bridgedAt" END,
      "rolledBackAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "CatalogMigrationLedger"."userId" = EXCLUDED."userId"
      AND "CatalogMigrationLedger"."creditCardId" IS NOT DISTINCT FROM EXCLUDED."creditCardId"
      AND "CatalogMigrationLedger"."classification" = EXCLUDED."classification"
      AND "CatalogMigrationLedger"."sourceFingerprint" = EXCLUDED."sourceFingerprint"
      AND "CatalogMigrationLedger"."destinationFingerprint" IS NOT DISTINCT FROM EXCLUDED."destinationFingerprint"
  `);
  if (result !== 1) throw new GlobalBenefitMigrationError("A migration ledger compare-and-set failed.");
  return current ? "updated" : "created";
}

export class PrismaGlobalBenefitMigrationDatabase implements GlobalBenefitMigrationDatabase {
  constructor(private readonly client: PrismaClient) {}

  async readBatch(input: { afterCursorDigest: string | null; limit: number }): Promise<LegacyMigrationSnapshot> {
    const [page, definitions] = await Promise.all([
      readUnitKeys(this.client, input.afterCursorDigest, input.limit),
      readDefinitions(this.client),
    ]);
    const units = await readUnitsByKeys(this.client, page.keys);
    return { definitions, units, hasMore: page.hasMore };
  }

  applyBridge(expected: ClassifiedMigrationUnit): Promise<MigrationWriteResult> {
    return this.client.$transaction(async (transaction) => {
      const { current, classified } = await ensureCurrentPlan(transaction as unknown as QueryClient, expected);
      const result = emptyWriteResult();
      const ownerId = classified.card?.userId ?? current.benefits[0]?.userId;
      if (!ownerId) throw new GlobalBenefitMigrationError("The migration unit has no exact owner.");
      if (classified.card && classified.predefinedCardId) {
        const changed = await transaction.$executeRaw(Prisma.sql`
          UPDATE "CreditCard" SET "predefinedCardId" = ${classified.predefinedCardId}
          WHERE "id" = ${classified.card.id} AND "userId" = ${ownerId}
            AND ("predefinedCardId" IS NULL OR "predefinedCardId" = ${classified.predefinedCardId})
        `);
        if (changed !== 1) throw new GlobalBenefitMigrationError("The physical-card bridge compare-and-set failed.");
      }
      for (const proposal of classified.benefits) {
        const benefit = current.benefits.find((item) => item.id === proposal.legacyBenefitId);
        if (!benefit) throw new GlobalBenefitMigrationError("A classified benefit disappeared before apply.");
        if (proposal.disposition === "custom") {
          const ledger = await upsertLedger(transaction as unknown as QueryClient, {
            benefit, ownerId, cardId: classified.card?.id ?? null,
            predefinedCardId: null, predefinedBenefitId: null,
            classification: "CUSTOM", phase: "CLASSIFIED",
            sourceFingerprint: proposal.sourceFingerprint, destinationFingerprint: null,
          });
          if (ledger === "idempotent") result.idempotent += 1;
          else result.custom += 1;
          continue;
        }
        if (proposal.disposition !== "standard" || !proposal.predefinedBenefitId || !proposal.destinationFingerprint) {
          throw new GlobalBenefitMigrationError("An unresolved benefit reached the bridge writer.");
        }
        for (const status of benefit.statuses) {
          const changed = await transaction.$executeRaw(Prisma.sql`
            UPDATE "BenefitStatus"
            SET "creditCardId" = ${classified.card!.id},
                "predefinedBenefitId" = ${proposal.predefinedBenefitId}
            WHERE "id" = ${status.id} AND "benefitId" = ${benefit.id}
              AND "userId" = ${ownerId}
              AND ("creditCardId" IS NULL OR "creditCardId" = ${classified.card!.id})
              AND ("predefinedBenefitId" IS NULL OR "predefinedBenefitId" = ${proposal.predefinedBenefitId})
          `);
          if (changed !== 1) throw new GlobalBenefitMigrationError("A status bridge compare-and-set failed.");
        }
        for (const audit of benefit.audits) {
          const changed = await transaction.$executeRaw(Prisma.sql`
            UPDATE "AmexSyncRowAudit"
            SET "destinationPredefinedBenefitId" = ${proposal.predefinedBenefitId},
                "destinationDefinitionFingerprint" = ${proposal.destinationFingerprint}
            WHERE "id" = ${audit.id}
              AND ("destinationPredefinedBenefitId" IS NULL OR "destinationPredefinedBenefitId" = ${proposal.predefinedBenefitId})
              AND ("destinationDefinitionFingerprint" IS NULL OR "destinationDefinitionFingerprint" = ${proposal.destinationFingerprint})
          `);
          if (changed !== 1) throw new GlobalBenefitMigrationError("An audit bridge compare-and-set failed.");
        }
        const ledger = await upsertLedger(transaction as unknown as QueryClient, {
          benefit, ownerId, cardId: classified.card!.id,
          predefinedCardId: classified.predefinedCardId,
          predefinedBenefitId: proposal.predefinedBenefitId,
          classification: "STANDARD", phase: "BRIDGED",
          sourceFingerprint: proposal.sourceFingerprint,
          destinationFingerprint: proposal.destinationFingerprint,
        });
        if (ledger === "idempotent"
          && benefit.statuses.every((status) => status.creditCardId === classified.card!.id
            && status.predefinedBenefitId === proposal.predefinedBenefitId)) result.idempotent += 1;
        else result.standard += 1;
      }
      const after = await readOneUnit(transaction as unknown as QueryClient, expected.privateUnitKey);
      const afterClassified = classifyLegacyMigrationUnit(after, (await readDefinitions(transaction as unknown as QueryClient)));
      if (afterClassified.blocked || afterClassified.unitFingerprint !== expected.unitFingerprint
        || afterClassified.card?.predefinedCardId !== expected.predefinedCardId
        || afterClassified.benefits.some((proposal) => {
          const row = after.benefits.find((benefit) => benefit.id === proposal.legacyBenefitId);
          if (!row) return true;
          if (proposal.disposition === "custom") return row.ledger?.phase !== "CLASSIFIED";
          if (proposal.disposition !== "standard") return true;
          return row.ledger?.phase !== "BRIDGED"
            || row.statuses.some((status) => status.creditCardId !== after.card?.id
              || status.predefinedBenefitId !== proposal.predefinedBenefitId);
        })) {
        throw new GlobalBenefitMigrationError("Post-bridge preservation verification failed.");
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  cleanupBridge(expected: ClassifiedMigrationUnit): Promise<MigrationWriteResult> {
    return this.client.$transaction(async (transaction) => {
      const { current, classified } = await ensureCurrentPlan(transaction as unknown as QueryClient, expected);
      const result = emptyWriteResult();
      for (const proposal of classified.benefits) {
        const benefit = current.benefits.find((item) => item.id === proposal.legacyBenefitId)!;
        if (proposal.disposition !== "standard") continue;
        const ledger = benefit.ledger;
        if (!ledger) throw new GlobalBenefitMigrationError("Cleanup requires an exact bridged ledger.");
        if (ledger.phase === "CLEANED") { result.idempotent += 1; continue; }
        if (ledger.phase !== "BRIDGED" || ledger.predefinedBenefitId !== proposal.predefinedBenefitId
          || benefit.statuses.some((status) => status.creditCardId !== classified.card?.id
            || status.predefinedBenefitId !== proposal.predefinedBenefitId)) {
          throw new GlobalBenefitMigrationError("Cleanup is not proven by an exact bridged ledger.");
        }
        const statuses = await transaction.$executeRaw(Prisma.sql`
          UPDATE "BenefitStatus" SET "benefitId" = NULL
          WHERE "benefitId" = ${benefit.id} AND "creditCardId" = ${classified.card!.id}
            AND "predefinedBenefitId" = ${proposal.predefinedBenefitId}
        `);
        if (statuses !== benefit.statuses.length) throw new GlobalBenefitMigrationError("Cleanup status verification failed.");
        const deleted = await transaction.$executeRaw(Prisma.sql`
          DELETE FROM "Benefit" WHERE "id" = ${benefit.id} AND "creditCardId" = ${classified.card!.id}
        `);
        if (deleted !== 1) throw new GlobalBenefitMigrationError("Cleanup did not delete exactly one ledger-proven copy.");
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE "CatalogMigrationLedger"
          SET "phase" = 'CLEANED', "cleanedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "legacyBenefitId" = ${benefit.id} AND "phase" = 'BRIDGED'
            AND "sourceFingerprint" = ${proposal.sourceFingerprint}
            AND "destinationFingerprint" = ${proposal.destinationFingerprint}
        `);
        if (updated !== 1) throw new GlobalBenefitMigrationError("Cleanup ledger compare-and-set failed.");
        const verified = await transaction.$queryRaw<Array<{ benefitCount: bigint; legacyStatusCount: bigint; ledgerCount: bigint }>>(Prisma.sql`
          SELECT
            (SELECT count(*) FROM "Benefit" WHERE "id" = ${benefit.id})::bigint AS "benefitCount",
            (SELECT count(*) FROM "BenefitStatus" WHERE "benefitId" = ${benefit.id})::bigint AS "legacyStatusCount",
            (SELECT count(*) FROM "CatalogMigrationLedger"
              WHERE "legacyBenefitId" = ${benefit.id} AND "phase" = 'CLEANED')::bigint AS "ledgerCount"
        `);
        if (Number(verified[0]?.benefitCount ?? 1) !== 0
          || Number(verified[0]?.legacyStatusCount ?? 1) !== 0
          || Number(verified[0]?.ledgerCount ?? 0) !== 1) {
          throw new GlobalBenefitMigrationError("Post-cleanup verification failed.");
        }
        result.cleaned += 1;
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  rollbackBridge(expected: ClassifiedMigrationUnit): Promise<MigrationWriteResult> {
    return this.client.$transaction(async (transaction) => {
      const { current, classified } = await ensureCurrentPlan(transaction as unknown as QueryClient, expected);
      const result = emptyWriteResult();
      for (const proposal of classified.benefits) {
        if (proposal.disposition !== "standard") continue;
        const benefit = current.benefits.find((item) => item.id === proposal.legacyBenefitId)!;
        const ledger = benefit.ledger;
        if (!ledger) throw new GlobalBenefitMigrationError("Rollback requires an exact bridged ledger.");
        if (ledger.phase === "ROLLED_BACK") { result.idempotent += 1; continue; }
        if (ledger.phase === "CLEANED") throw new GlobalBenefitMigrationError("Cleaned rows require forward repair or database recovery.");
        if (ledger.phase !== "BRIDGED") throw new GlobalBenefitMigrationError("Rollback requires an exact bridged ledger.");
        for (const status of benefit.statuses) {
          const changed = await transaction.$executeRaw(Prisma.sql`
            UPDATE "BenefitStatus" SET "creditCardId" = NULL, "predefinedBenefitId" = NULL
            WHERE "id" = ${status.id} AND "benefitId" = ${benefit.id}
              AND "creditCardId" = ${classified.card!.id}
              AND "predefinedBenefitId" = ${proposal.predefinedBenefitId}
          `);
          if (changed !== 1) throw new GlobalBenefitMigrationError("Rollback status compare-and-set failed.");
        }
        for (const audit of benefit.audits) {
          const changed = await transaction.$executeRaw(Prisma.sql`
            UPDATE "AmexSyncRowAudit"
            SET "destinationPredefinedBenefitId" = NULL,
                "destinationDefinitionFingerprint" = NULL
            WHERE "id" = ${audit.id}
              AND "destinationPredefinedBenefitId" = ${proposal.predefinedBenefitId}
              AND "destinationDefinitionFingerprint" = ${proposal.destinationFingerprint}
          `);
          if (changed !== 1) throw new GlobalBenefitMigrationError("Rollback audit compare-and-set failed.");
        }
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE "CatalogMigrationLedger"
          SET "phase" = 'ROLLED_BACK', "rolledBackAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "legacyBenefitId" = ${benefit.id} AND "phase" = 'BRIDGED'
            AND "sourceFingerprint" = ${proposal.sourceFingerprint}
            AND "destinationFingerprint" = ${proposal.destinationFingerprint}
        `);
        if (updated !== 1) throw new GlobalBenefitMigrationError("Rollback ledger compare-and-set failed.");
        result.rolledBack += 1;
      }
      if (classified.card && classified.predefinedCardId) {
        const remaining = await transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS "count" FROM "CatalogMigrationLedger"
          WHERE "creditCardId" = ${classified.card.id} AND "phase" = 'BRIDGED'
            AND "classification" = 'STANDARD'
        `);
        if (Number(remaining[0]?.count ?? 0) === 0 && classified.card.predefinedCardId !== null) {
          const changed = await transaction.$executeRaw(Prisma.sql`
            UPDATE "CreditCard" SET "predefinedCardId" = NULL
            WHERE "id" = ${classified.card.id} AND "predefinedCardId" = ${classified.predefinedCardId}
          `);
          if (changed !== 1) throw new GlobalBenefitMigrationError("Rollback card compare-and-set failed.");
        }
      }
      const after = await readOneUnit(transaction as unknown as QueryClient, expected.privateUnitKey);
      const afterClassified = classifyLegacyMigrationUnit(after, await readDefinitions(transaction as unknown as QueryClient));
      if (afterClassified.blocked || afterClassified.unitFingerprint !== expected.unitFingerprint
        || after.benefits.some((benefit) => benefit.ledger?.classification === "STANDARD"
          && benefit.ledger.phase === "ROLLED_BACK"
          && (benefit.statuses.some((status) => status.creditCardId !== null || status.predefinedBenefitId !== null)
            || benefit.audits.some((audit) => audit.destinationPredefinedBenefitId !== null
              || audit.destinationDefinitionFingerprint !== null)))) {
        throw new GlobalBenefitMigrationError("Post-rollback verification failed.");
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
