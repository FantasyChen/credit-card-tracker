import {
  classifyGlobalBenefitCategoryRepairAuthority,
  type RuntimeCategoryRepairAuthorityInput,
} from '../global-benefit-category-repair-authority';
import {
  globalDefinitionFingerprint,
  type GlobalBenefitDefinition,
  type GlobalCardDefinition,
} from '../global-benefit-migration';

const START = new Date('2026-07-01T00:00:00.000Z');
const END = new Date('2026-09-30T23:59:59.999Z');

function validInput(action: 'PROMOTE_LEGACY_STATUS' | 'RETAIN_CANONICAL_STATUS' = 'PROMOTE_LEGACY_STATUS'):
RuntimeCategoryRepairAuthorityInput {
  const benefit: GlobalBenefitDefinition = {
    id: 'global-benefit-1',
    catalogKey: 'benefit:card-1:credit-1',
    predefinedCardId: 'global-card-1',
    category: 'Dining',
    description: 'Current reviewed definition',
    percentage: 100,
    maxAmount: 50,
    frequency: 'QUARTERLY',
    cycleAlignment: 'CALENDAR_FIXED',
    fixedCycleStartMonth: 7,
    fixedCycleDurationMonths: null,
    occurrencesInCycle: 1,
    productKey: 'product-1',
    creditFamilyKey: 'product-1:credit-1',
    periodKey: 'calendar-quarter-q3',
    retiredAt: null,
  };
  const product: GlobalCardDefinition = {
    id: 'global-card-1',
    catalogKey: 'card:card-1',
    name: 'Card 1',
    issuer: 'Issuer',
    productKey: 'product-1',
    retiredAt: null,
    benefits: [benefit],
  };
  return {
    sourceBenefitId: 'legacy-benefit-1',
    ledger: {
      id: 'ledger-1',
      legacyBenefitId: 'legacy-benefit-1',
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedCardId: null,
      predefinedBenefitId: null,
      classification: 'CUSTOM',
      phase: 'CLASSIFIED',
      destinationFingerprint: null,
    },
    repair: {
      id: 'repair-1',
      legacyBenefitId: 'legacy-benefit-1',
      catalogMigrationLedgerId: 'ledger-1',
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedCardId: 'global-card-1',
      predefinedBenefitId: 'global-benefit-1',
      targetPredefinedCardCatalogKey: 'card:card-1',
      targetPredefinedBenefitCatalogKey: 'benefit:card-1:credit-1',
      definitionFingerprint: globalDefinitionFingerprint(benefit),
      evidenceVersion: 1,
      phase: 'APPLIED',
      rolledBackAt: null,
    },
    card: { id: 'card-1', userId: 'user-1', predefinedCardId: 'global-card-1' },
    product,
    benefit,
    status: {
      id: 'status-1',
      benefitId: action === 'PROMOTE_LEGACY_STATUS' ? 'legacy-benefit-1' : null,
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      userId: 'user-1',
      cycleStartDate: START,
      cycleEndDate: END,
      occurrenceIndex: 0,
    },
    occurrence: {
      repairId: 'repair-1',
      userId: 'user-1',
      creditCardId: 'card-1',
      predefinedBenefitId: 'global-benefit-1',
      targetPredefinedBenefitCatalogKey: 'benefit:card-1:credit-1',
      action,
      keeperSource: action === 'PROMOTE_LEGACY_STATUS' ? 'LEGACY_CUSTOM' : 'CANONICAL_STANDARD',
      keeperStatusId: 'status-1',
      cycleStartDate: START,
      cycleEndDate: END,
      occurrenceIndex: 0,
      keeperBaselineVersion: 1,
      removedStatusPreimageVersion: action === 'RETAIN_CANONICAL_STATUS' ? 1 : null,
      repairAddedAuditMetadataVersion: 1,
    },
  };
}

function classify(input: RuntimeCategoryRepairAuthorityInput) {
  return classifyGlobalBenefitCategoryRepairAuthority(input);
}

describe('global benefit category-repair runtime authority', () => {
  it('distinguishes missing, rolled-back, and exact applied parent evidence', () => {
    const valid = validInput();
    expect(classify({ ...valid, repair: null })).toBe('NONE');
    expect(classify({
      ...valid,
      repair: { ...valid.repair!, phase: 'ROLLED_BACK', rolledBackAt: new Date() },
    })).toBe('ROLLED_BACK');
    expect(classify({ ...valid, status: undefined, occurrence: undefined })).toBe('APPLIED_VALID');
  });

  it.each([
    ['unsupported parent evidence version', (input: RuntimeCategoryRepairAuthorityInput) => { input.repair!.evidenceVersion = 2; }],
    ['changed historical ledger classification', (input: RuntimeCategoryRepairAuthorityInput) => { input.ledger!.classification = 'STANDARD'; }],
    ['changed historical ledger phase', (input: RuntimeCategoryRepairAuthorityInput) => { input.ledger!.phase = 'BRIDGED'; }],
    ['cross-owner repair', (input: RuntimeCategoryRepairAuthorityInput) => { input.repair!.userId = 'other-user'; }],
    ['cross-card repair', (input: RuntimeCategoryRepairAuthorityInput) => { input.repair!.creditCardId = 'other-card'; }],
    ['cross-product target', (input: RuntimeCategoryRepairAuthorityInput) => { input.benefit.predefinedCardId = 'other-global-card'; }],
    ['card catalog-key drift', (input: RuntimeCategoryRepairAuthorityInput) => { input.product.catalogKey = 'card:changed'; }],
    ['benefit catalog-key drift', (input: RuntimeCategoryRepairAuthorityInput) => { input.benefit.catalogKey = 'benefit:changed'; }],
    ['definition fingerprint drift', (input: RuntimeCategoryRepairAuthorityInput) => { input.benefit.maxAmount = 75; }],
    ['applied evidence with rollback time', (input: RuntimeCategoryRepairAuthorityInput) => { input.repair!.rolledBackAt = new Date(); }],
  ])('rejects %s', (_label, mutate) => {
    const input = validInput();
    mutate(input);
    expect(classify(input)).toBe('APPLIED_INVALID');
  });

  it('accepts exact PROMOTE and RETAIN keeper semantics', () => {
    expect(classify(validInput('PROMOTE_LEGACY_STATUS'))).toBe('APPLIED_VALID');
    expect(classify(validInput('RETAIN_CANONICAL_STATUS'))).toBe('APPLIED_VALID');
  });

  it.each([
    ['keeper source', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.keeperSource = 'CANONICAL_STANDARD'; }],
    ['retained legacy benefit', (input: RuntimeCategoryRepairAuthorityInput) => { input.status!.benefitId = null; }],
    ['keeper identity', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.keeperStatusId = 'other-status'; }],
    ['owner identity', (input: RuntimeCategoryRepairAuthorityInput) => { input.status!.userId = 'other-user'; }],
    ['target identity', (input: RuntimeCategoryRepairAuthorityInput) => { input.status!.predefinedBenefitId = 'other-benefit'; }],
    ['cycle start', (input: RuntimeCategoryRepairAuthorityInput) => { input.status!.cycleStartDate = new Date('2026-07-02T00:00:00.000Z'); }],
    ['cycle end', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.cycleEndDate = new Date('2026-09-29T23:59:59.999Z'); }],
    ['occurrence index', (input: RuntimeCategoryRepairAuthorityInput) => { input.status!.occurrenceIndex = 1; }],
    ['keeper baseline version', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.keeperBaselineVersion = 2; }],
    ['removed preimage version', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.removedStatusPreimageVersion = 2; }],
    ['audit metadata version', (input: RuntimeCategoryRepairAuthorityInput) => { input.occurrence!.repairAddedAuditMetadataVersion = 2; }],
  ])('rejects occurrence drift in %s', (_label, mutate) => {
    const input = validInput();
    mutate(input);
    expect(classify(input)).toBe('APPLIED_INVALID');
  });
});
