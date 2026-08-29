import type { PrismaClient } from '@/generated/prisma';
import {
  fetchEffectiveBenefitStatuses,
  type EffectiveBenefitStatus,
  type EffectiveBenefitStatusFilters,
} from '@/lib/effective-benefit';
import {
  benefitTrackingKey,
  buildBenefitTrackingModeMap,
  excludeIgnoredBenefits,
  initialStatusFieldsForTrackingMode,
  resolveBenefitTrackingMode,
  type BenefitTrackingModeMap,
  type BenefitTrackingPreferenceRecord,
  type BenefitTrackingTarget,
} from '@/lib/benefit-tracking-modes';

/**
 * The single database-aware entry point for cycle-independent tracking modes.
 *
 * Read surfaces (dashboard, home, calendar, APIs, notification digest) call
 * `fetchTrackedBenefitStatuses` instead of `fetchEffectiveBenefitStatuses`, so
 * IGNORE is honoured in exactly one place rather than being re-implemented per
 * surface. Write surfaces call `applyTrackingModesToPlannedRows`, so AUTO_CLAIM
 * is honoured in every materialization path for the same reason.
 *
 * Integrity and repair tooling deliberately keeps using the unfiltered readers:
 * a user's display preference must never hide a row from a consistency check.
 */

export type TrackingPreferenceDatabase = Pick<PrismaClient, 'benefitTrackingPreference'>;
type StatusReadDatabase = Pick<PrismaClient, '$queryRaw'>;

type PreferenceRow = BenefitTrackingPreferenceRecord & { userId: string };

const PREFERENCE_SELECT = {
  userId: true,
  creditCardId: true,
  predefinedBenefitId: true,
  benefitId: true,
  mode: true,
} as const;

/** Tracking modes for one user. Users with no preferences get an empty map. */
export async function loadBenefitTrackingModes(
  database: TrackingPreferenceDatabase,
  userId: string
): Promise<BenefitTrackingModeMap> {
  const preferences = await database.benefitTrackingPreference.findMany({
    where: { userId, mode: { not: 'TRACK' } },
    select: PREFERENCE_SELECT,
  }) as unknown as PreferenceRow[];
  return buildBenefitTrackingModeMap(preferences);
}

/**
 * Tracking modes for several users at once, keyed by user id. The notification
 * digest fans out across users in one query, so it must not resolve one user's
 * preference against another user's rows.
 */
export async function loadBenefitTrackingModesByUser(
  database: TrackingPreferenceDatabase,
  userIds: readonly string[]
): Promise<Map<string, BenefitTrackingModeMap>> {
  const byUser = new Map<string, BenefitTrackingModeMap>();
  if (userIds.length === 0) return byUser;

  const preferences = await database.benefitTrackingPreference.findMany({
    where: { userId: { in: [...userIds] }, mode: { not: 'TRACK' } },
    select: PREFERENCE_SELECT,
  }) as unknown as PreferenceRow[];

  const grouped = new Map<string, PreferenceRow[]>();
  for (const preference of preferences) {
    const existing = grouped.get(preference.userId);
    if (existing) existing.push(preference);
    else grouped.set(preference.userId, [preference]);
  }
  for (const [userId, rows] of Array.from(grouped.entries())) {
    byUser.set(userId, buildBenefitTrackingModeMap(rows));
  }
  return byUser;
}

/**
 * The canonical read for every user-facing surface: effective statuses with the
 * user's ignored benefits removed.
 *
 * Supports both the single-user and multi-user filter shapes, and resolves each
 * row against its own owner's preferences.
 */
export async function fetchTrackedBenefitStatuses(
  database: StatusReadDatabase & TrackingPreferenceDatabase,
  filters: EffectiveBenefitStatusFilters
): Promise<EffectiveBenefitStatus[]> {
  const statuses = await fetchEffectiveBenefitStatuses(database, filters);
  if (statuses.length === 0) return statuses;

  if (filters.userIds) {
    const modesByUser = await loadBenefitTrackingModesByUser(database, filters.userIds);
    if (modesByUser.size === 0) return statuses;
    return statuses.filter(
      (status) => resolveBenefitTrackingMode(modesByUser.get(status.userId), status) !== 'IGNORE'
    );
  }

  const modes = await loadBenefitTrackingModes(database, filters.userId!);
  return excludeIgnoredBenefits(statuses, modes);
}

/** A planned status insert, in the shape every materialization path produces. */
export interface PlannedStatusRow extends BenefitTrackingTarget {
  userId: string;
}

export interface MaterializedStatusDefaults {
  isCompleted: boolean;
  completedAt: Date | null;
  usedAmount: number;
}

/**
 * The canonical write helper: resolves each planned row against its owner's
 * tracking mode and returns the status fields that row should be created with.
 *
 * AUTO_CLAIM rows open already claimed at the benefit's full value; every other
 * mode opens unclaimed. Returned in the same order as `rows`.
 *
 * Rows whose benefit has no stored maximum claim 0 rather than inventing value.
 */
export async function applyTrackingModesToPlannedRows<T extends PlannedStatusRow>(
  database: TrackingPreferenceDatabase & Pick<PrismaClient, 'predefinedBenefit' | 'benefit'>,
  rows: readonly T[],
  now: Date = new Date()
): Promise<MaterializedStatusDefaults[]> {
  if (rows.length === 0) return [];

  const modesByUser = await loadBenefitTrackingModesByUser(
    database,
    Array.from(new Set(rows.map((row) => row.userId)))
  );
  // Nothing is auto-claimed, so no amount lookup is needed at all.
  if (modesByUser.size === 0) {
    return rows.map(() => ({ isCompleted: false, completedAt: null, usedAmount: 0 }));
  }

  const autoClaimRows = rows.filter(
    (row) => resolveBenefitTrackingMode(modesByUser.get(row.userId), row) === 'AUTO_CLAIM'
  );
  const amounts = await loadClaimableAmounts(database, autoClaimRows);

  return rows.map((row) =>
    initialStatusFieldsForTrackingMode(
      resolveBenefitTrackingMode(modesByUser.get(row.userId), row),
      amounts.get(benefitTrackingKey(row) ?? ''),
      now
    )
  );
}

/** Full value of each auto-claimed benefit, keyed the way preferences are. */
async function loadClaimableAmounts(
  database: Pick<PrismaClient, 'predefinedBenefit' | 'benefit'>,
  rows: readonly PlannedStatusRow[]
): Promise<Map<string, number | null>> {
  const amounts = new Map<string, number | null>();
  if (rows.length === 0) return amounts;

  const predefinedBenefitIds = Array.from(
    new Set(rows.map((row) => row.predefinedBenefitId).filter((id): id is string => Boolean(id)))
  );
  const benefitIds = Array.from(
    new Set(
      rows
        .filter((row) => !row.predefinedBenefitId)
        .map((row) => row.benefitId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [predefinedBenefits, benefits] = await Promise.all([
    predefinedBenefitIds.length > 0
      ? database.predefinedBenefit.findMany({
          where: { id: { in: predefinedBenefitIds } },
          select: { id: true, maxAmount: true },
        })
      : Promise.resolve([]),
    benefitIds.length > 0
      ? database.benefit.findMany({
          where: { id: { in: benefitIds } },
          select: { id: true, maxAmount: true },
        })
      : Promise.resolve([]),
  ]);

  const predefinedAmounts = new Map(predefinedBenefits.map((row) => [row.id, row.maxAmount]));
  const customAmounts = new Map(benefits.map((row) => [row.id, row.maxAmount]));
  for (const row of rows) {
    const key = benefitTrackingKey(row);
    if (key === null) continue;
    amounts.set(
      key,
      row.predefinedBenefitId
        ? predefinedAmounts.get(row.predefinedBenefitId) ?? null
        : customAmounts.get(row.benefitId ?? '') ?? null
    );
  }
  return amounts;
}
