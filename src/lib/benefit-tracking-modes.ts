/**
 * Cycle-independent tracking choices for a single benefit.
 *
 * `isNotUsable` on BenefitStatus only describes one Benefit Cycle, so a benefit
 * the user always uses (or never wants to see) has to be re-confirmed every
 * cycle. These preferences live outside the cycle instead:
 *
 * - `TRACK` keeps the original per-cycle workflow and is the default whenever
 *   no preference row exists.
 * - `AUTO_CLAIM` materializes each new cycle already claimed, so the benefit
 *   leaves the to-do list but still counts toward claimed value and ROI.
 * - `IGNORE` moves the benefit to the dashboard's Ignored tab and excludes it
 *   from tracked tabs, claimed value, and ROI.
 *
 * Every function here is pure so the behaviour can be tested without a
 * database.
 */

export type BenefitTrackingMode = 'TRACK' | 'AUTO_CLAIM' | 'IGNORE';

export const BENEFIT_TRACKING_MODES: readonly BenefitTrackingMode[] = [
  'TRACK',
  'AUTO_CLAIM',
  'IGNORE',
] as const;

export const DEFAULT_BENEFIT_TRACKING_MODE: BenefitTrackingMode = 'TRACK';

export function isBenefitTrackingMode(value: unknown): value is BenefitTrackingMode {
  return typeof value === 'string'
    && (BENEFIT_TRACKING_MODES as readonly string[]).includes(value);
}

/**
 * The addressable identity of a benefit, in the same shape BenefitStatus and
 * the materialization planner already use.
 */
export interface BenefitTrackingTarget {
  creditCardId?: string | null;
  predefinedBenefitId?: string | null;
  benefitId?: string | null;
}

export interface BenefitTrackingPreferenceRecord extends BenefitTrackingTarget {
  mode: BenefitTrackingMode;
}

export type BenefitTrackingModeMap = ReadonlyMap<string, BenefitTrackingMode>;

/**
 * Standard benefits are keyed by the (card, predefined benefit) pair; custom
 * benefits are keyed by their own id.
 *
 * A standard status row also carries a bridge `benefitId`, so
 * `predefinedBenefitId` is checked first. Planned inserts for standard benefits
 * carry no `benefitId` at all, which lands on the same key from either side.
 *
 * Returns null when the target identifies no benefit, so callers never collapse
 * unrelated rows onto a shared key.
 */
export function benefitTrackingKey(target: BenefitTrackingTarget): string | null {
  if (target.predefinedBenefitId) {
    return `standard:${target.creditCardId ?? ''}:${target.predefinedBenefitId}`;
  }
  if (target.benefitId) {
    return `custom:${target.benefitId}`;
  }
  return null;
}

export function buildBenefitTrackingModeMap(
  preferences: readonly BenefitTrackingPreferenceRecord[]
): Map<string, BenefitTrackingMode> {
  const modes = new Map<string, BenefitTrackingMode>();
  for (const preference of preferences) {
    const key = benefitTrackingKey(preference);
    // TRACK is the default, so storing it would only add lookup noise.
    if (key === null || preference.mode === DEFAULT_BENEFIT_TRACKING_MODE) continue;
    modes.set(key, preference.mode);
  }
  return modes;
}

export function resolveBenefitTrackingMode(
  modes: BenefitTrackingModeMap | undefined,
  target: BenefitTrackingTarget
): BenefitTrackingMode {
  if (!modes || modes.size === 0) return DEFAULT_BENEFIT_TRACKING_MODE;
  const key = benefitTrackingKey(target);
  if (key === null) return DEFAULT_BENEFIT_TRACKING_MODE;
  return modes.get(key) ?? DEFAULT_BENEFIT_TRACKING_MODE;
}

/**
 * Drops the benefits the user chose to ignore from tracked projections. The
 * dashboard keeps a separate Ignored tab for review and restoration.
 */
export function excludeIgnoredBenefits<T extends BenefitTrackingTarget>(
  rows: readonly T[],
  modes: BenefitTrackingModeMap | undefined
): T[] {
  if (!modes || modes.size === 0) return [...rows];
  return rows.filter((row) => resolveBenefitTrackingMode(modes, row) !== 'IGNORE');
}

/**
 * Who last set a status row's claim state. 'AUTO' marks a claim this feature
 * made on the user's behalf; 'USER' marks a manual or user-confirmed mutation.
 * null means the row is untouched since materialization. Mode changes may only
 * ever undo 'AUTO' rows.
 */
export type BenefitClaimSource = 'AUTO' | 'USER';

export interface AutoClaimStatusFields {
  isCompleted: boolean;
  completedAt: Date | null;
  usedAmount: number;
  claimSource: BenefitClaimSource | null;
}

/**
 * The status fields a freshly materialized cycle should start with.
 *
 * AUTO_CLAIM opens the cycle already claimed at the benefit's full value, which
 * is what "I always use this one" means for claimed-value and ROI totals. An
 * unknown or absent maximum claims 0 rather than inventing a value.
 */
export function initialStatusFieldsForTrackingMode(
  mode: BenefitTrackingMode,
  maxAmount: number | null | undefined,
  now: Date
): AutoClaimStatusFields {
  if (mode !== 'AUTO_CLAIM') {
    return { isCompleted: false, completedAt: null, usedAmount: 0, claimSource: null };
  }
  const claimable = typeof maxAmount === 'number' && Number.isFinite(maxAmount) && maxAmount > 0
    ? maxAmount
    : 0;
  return { isCompleted: true, completedAt: now, usedAmount: claimable, claimSource: 'AUTO' };
}
