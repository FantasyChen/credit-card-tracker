import {
  benefitTrackingKey,
  buildBenefitTrackingModeMap,
  excludeIgnoredBenefits,
  initialStatusFieldsForTrackingMode,
  isBenefitTrackingMode,
  resolveBenefitTrackingMode,
  type BenefitTrackingPreferenceRecord,
} from '@/lib/benefit-tracking-modes';

const NOW = new Date('2026-08-27T12:00:00.000Z');

describe('benefitTrackingKey', () => {
  it('keys standard benefits by card and predefined benefit', () => {
    expect(
      benefitTrackingKey({ creditCardId: 'card_1', predefinedBenefitId: 'pb_1', benefitId: null })
    ).toBe('standard:card_1:pb_1');
  });

  it('keys custom benefits by their own id', () => {
    expect(
      benefitTrackingKey({ creditCardId: null, predefinedBenefitId: null, benefitId: 'b_1' })
    ).toBe('custom:b_1');
  });

  it('prefers the predefined benefit when a bridge benefitId is also present', () => {
    // Standard status rows carry both ids; the planner rows carry only the
    // predefined id. Both must resolve to the same key.
    const fromStatus = benefitTrackingKey({
      creditCardId: 'card_1',
      predefinedBenefitId: 'pb_1',
      benefitId: 'legacy_1',
    });
    const fromPlannedInsert = benefitTrackingKey({
      creditCardId: 'card_1',
      predefinedBenefitId: 'pb_1',
      benefitId: null,
    });
    expect(fromStatus).toBe(fromPlannedInsert);
  });

  it('separates the same predefined benefit held on two physical cards', () => {
    expect(benefitTrackingKey({ creditCardId: 'card_1', predefinedBenefitId: 'pb_1' })).not.toBe(
      benefitTrackingKey({ creditCardId: 'card_2', predefinedBenefitId: 'pb_1' })
    );
  });

  it('returns null when nothing identifies the benefit', () => {
    expect(benefitTrackingKey({ creditCardId: 'card_1' })).toBeNull();
  });
});

describe('buildBenefitTrackingModeMap', () => {
  const preferences: BenefitTrackingPreferenceRecord[] = [
    { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber', benefitId: null, mode: 'AUTO_CLAIM' },
    { creditCardId: 'card_1', predefinedBenefitId: 'pb_hotel', benefitId: null, mode: 'IGNORE' },
    { creditCardId: null, predefinedBenefitId: null, benefitId: 'b_custom', mode: 'IGNORE' },
  ];

  it('indexes every non-default preference', () => {
    const modes = buildBenefitTrackingModeMap(preferences);
    expect(modes.get('standard:card_1:pb_uber')).toBe('AUTO_CLAIM');
    expect(modes.get('standard:card_1:pb_hotel')).toBe('IGNORE');
    expect(modes.get('custom:b_custom')).toBe('IGNORE');
  });

  it('omits TRACK rows and unidentifiable rows', () => {
    const modes = buildBenefitTrackingModeMap([
      ...preferences,
      { creditCardId: 'card_9', predefinedBenefitId: 'pb_9', benefitId: null, mode: 'TRACK' },
      { creditCardId: 'card_8', predefinedBenefitId: null, benefitId: null, mode: 'IGNORE' },
    ]);
    expect(modes.size).toBe(3);
  });
});

describe('resolveBenefitTrackingMode', () => {
  const modes = buildBenefitTrackingModeMap([
    { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber', benefitId: null, mode: 'AUTO_CLAIM' },
  ]);

  it('returns the stored mode for a matching benefit', () => {
    expect(
      resolveBenefitTrackingMode(modes, { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber' })
    ).toBe('AUTO_CLAIM');
  });

  it('defaults to TRACK for benefits with no preference', () => {
    expect(
      resolveBenefitTrackingMode(modes, { creditCardId: 'card_1', predefinedBenefitId: 'pb_other' })
    ).toBe('TRACK');
  });

  it('defaults to TRACK when no preferences were loaded at all', () => {
    expect(
      resolveBenefitTrackingMode(undefined, { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber' })
    ).toBe('TRACK');
  });
});

describe('excludeIgnoredBenefits', () => {
  const modes = buildBenefitTrackingModeMap([
    { creditCardId: 'card_1', predefinedBenefitId: 'pb_hotel', benefitId: null, mode: 'IGNORE' },
    { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber', benefitId: null, mode: 'AUTO_CLAIM' },
  ]);

  it('drops ignored benefits and keeps everything else', () => {
    const rows = [
      { creditCardId: 'card_1', predefinedBenefitId: 'pb_hotel', benefitId: null },
      { creditCardId: 'card_1', predefinedBenefitId: 'pb_uber', benefitId: null },
      { creditCardId: 'card_1', predefinedBenefitId: 'pb_dining', benefitId: null },
    ];
    expect(excludeIgnoredBenefits(rows, modes).map((row) => row.predefinedBenefitId)).toEqual([
      'pb_uber',
      'pb_dining',
    ]);
  });

  it('keeps auto-claimed benefits so they still count toward ROI', () => {
    const rows = [{ creditCardId: 'card_1', predefinedBenefitId: 'pb_uber', benefitId: null }];
    expect(excludeIgnoredBenefits(rows, modes)).toHaveLength(1);
  });

  it('returns every row when no preferences exist', () => {
    const rows = [{ creditCardId: 'card_1', predefinedBenefitId: 'pb_hotel', benefitId: null }];
    expect(excludeIgnoredBenefits(rows, undefined)).toHaveLength(1);
  });
});

describe('initialStatusFieldsForTrackingMode', () => {
  it('opens a tracked cycle unclaimed', () => {
    expect(initialStatusFieldsForTrackingMode('TRACK', 10, NOW)).toEqual({
      isCompleted: false,
      completedAt: null,
      usedAmount: 0,
    });
  });

  it('opens an ignored cycle unclaimed, since it is hidden rather than claimed', () => {
    expect(initialStatusFieldsForTrackingMode('IGNORE', 10, NOW)).toEqual({
      isCompleted: false,
      completedAt: null,
      usedAmount: 0,
    });
  });

  it('opens an auto-claimed cycle at the benefit maximum', () => {
    expect(initialStatusFieldsForTrackingMode('AUTO_CLAIM', 10, NOW)).toEqual({
      isCompleted: true,
      completedAt: NOW,
      usedAmount: 10,
    });
  });

  it('claims zero rather than inventing a value when no maximum is stored', () => {
    expect(initialStatusFieldsForTrackingMode('AUTO_CLAIM', null, NOW)).toEqual({
      isCompleted: true,
      completedAt: NOW,
      usedAmount: 0,
    });
    expect(initialStatusFieldsForTrackingMode('AUTO_CLAIM', Number.NaN, NOW).usedAmount).toBe(0);
    expect(initialStatusFieldsForTrackingMode('AUTO_CLAIM', -5, NOW).usedAmount).toBe(0);
  });
});

describe('isBenefitTrackingMode', () => {
  it('accepts the three supported modes', () => {
    expect(isBenefitTrackingMode('TRACK')).toBe(true);
    expect(isBenefitTrackingMode('AUTO_CLAIM')).toBe(true);
    expect(isBenefitTrackingMode('IGNORE')).toBe(true);
  });

  it('rejects anything else submitted through a form', () => {
    expect(isBenefitTrackingMode('DELETE_EVERYTHING')).toBe(false);
    expect(isBenefitTrackingMode(null)).toBe(false);
    expect(isBenefitTrackingMode(undefined)).toBe(false);
  });
});
