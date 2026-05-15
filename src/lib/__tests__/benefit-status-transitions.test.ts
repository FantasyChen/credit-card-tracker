import {
  transitionAddPartialCompletion,
  transitionFullCompletion,
  transitionResetCompletion,
  transitionSetUsedAmount,
  transitionToggleNotUsable,
} from '../benefit-status-transitions';

const baseStatus = {
  isCompleted: false,
  isNotUsable: false,
  completedAt: null,
  usedAmount: 25,
  benefit: { maxAmount: 100 },
};

describe('benefit status transitions', () => {
  it('adds partial completion and completes when reaching max amount', () => {
    expect(transitionAddPartialCompletion(baseStatus, 50)).toMatchObject({
      usedAmount: 75,
      isCompleted: false,
      completedAt: null,
    });

    expect(transitionAddPartialCompletion(baseStatus, 100)).toMatchObject({
      usedAmount: 100,
      isCompleted: true,
    });
  });

  it('sets full completion and reset states', () => {
    expect(transitionFullCompletion(baseStatus, new Date('2026-05-01T00:00:00.000Z'))).toEqual({
      usedAmount: 100,
      isCompleted: true,
      completedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(transitionResetCompletion()).toEqual({
      usedAmount: 0,
      isCompleted: false,
      completedAt: null,
    });
  });

  it('clamps direct used amount edits and clears completedAt when reducing', () => {
    expect(transitionSetUsedAmount({
      ...baseStatus,
      isCompleted: true,
      completedAt: new Date('2026-05-01T00:00:00.000Z'),
    }, 50)).toEqual({
      usedAmount: 50,
      isCompleted: false,
      completedAt: null,
    });

    expect(transitionSetUsedAmount(baseStatus, 150)).toMatchObject({
      usedAmount: 100,
      isCompleted: true,
    });
  });

  it('marks not usable as mutually exclusive with completion', () => {
    expect(transitionToggleNotUsable({
      ...baseStatus,
      isCompleted: true,
      completedAt: new Date('2026-05-01T00:00:00.000Z'),
    })).toEqual({
      isNotUsable: true,
      isCompleted: false,
      completedAt: null,
    });
  });
});
