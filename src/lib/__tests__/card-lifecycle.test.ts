import {
  buildCardCalendarEvents,
  deriveNextAnnualFeeDueDate,
  parseDateInput,
  parseIsoDateOnly,
} from '../card-lifecycle';

describe('card lifecycle helpers', () => {
  it('derives the next annual fee date from the card anniversary', () => {
    const result = deriveNextAnnualFeeDueDate(
      new Date('2024-03-15T00:00:00Z'),
      new Date('2026-06-20T00:00:00Z')
    );

    expect(result?.toISOString()).toBe('2027-03-15T00:00:00.000Z');
  });

  it('strictly parses real date-only values', () => {
    expect(parseIsoDateOnly('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(parseIsoDateOnly('2026-02-30')).toBeNull();
    expect(parseIsoDateOnly('2026-13-01')).toBeNull();
    expect(parseIsoDateOnly('not-a-date')).toBeNull();
    expect(parseDateInput('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(parseDateInput('2025-02-29')).toBeNull();
  });

  it('projects annual fees, deadlines, events, and unclaimed benefit expirations', () => {
    const events = buildCardCalendarEvents([
      {
        id: 'card-1',
        name: 'Test Premium Card',
        issuer: 'Test Bank',
        openedDate: new Date('2025-07-01T00:00:00Z'),
        annualFeeAmount: 550,
        annualFeeDueDate: new Date('2026-07-01T00:00:00Z'),
        signupBonusDeadline: new Date('2026-08-01T00:00:00Z'),
        spendDeadline: new Date('2026-09-01T00:00:00Z'),
        benefits: [
          {
            id: 'benefit-1',
            description: '$25 monthly dining credit',
            benefitStatuses: [
              {
                id: 'status-1',
                cycleEndDate: new Date('2026-07-31T00:00:00Z'),
                isCompleted: false,
                isNotUsable: false,
              },
              {
                id: 'status-2',
                cycleEndDate: new Date('2026-07-31T00:00:00Z'),
                isCompleted: true,
                isNotUsable: false,
              },
            ],
          },
        ],
        events: [
          {
            id: 'event-1',
            eventType: 'RETENTION',
            eventDate: new Date('2026-07-15T00:00:00Z'),
            description: 'Retention offer accepted',
          },
        ],
      },
    ], {
      referenceDate: new Date('2026-06-20T00:00:00Z'),
      daysAhead: 120,
    });

    expect(events.map((event) => event.kind)).toEqual([
      'anniversary',
      'annual_fee',
      'card_event',
      'benefit_expires',
      'signup_bonus_deadline',
      'spend_deadline',
    ]);
    expect(events.find((event) => event.kind === 'annual_fee')?.amount).toBe(550);
    expect(events.some((event) => event.id === 'status-2-benefit-expires')).toBe(false);
  });
});
