import type { BenefitStatus, CardEventType, CreditCardEvent } from '@/generated/prisma';

export type CalendarEventKind =
  | 'annual_fee'
  | 'anniversary'
  | 'signup_bonus_deadline'
  | 'spend_deadline'
  | 'benefit_expires'
  | 'card_event';

export interface CardCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  date: Date;
  cardId: string;
  cardName: string;
  cardIssuer: string;
  amount?: number | null;
  description?: string | null;
}

export interface LifecycleCardProjection {
  id: string;
  name: string;
  issuer: string;
  openedDate: Date | string | null;
  annualFeeAmount: number | null;
  annualFeeDueDate: Date | string | null;
  signupBonusDeadline: Date | string | null;
  spendDeadline: Date | string | null;
  benefits?: Array<{
    id: string;
    description: string;
    benefitStatuses?: Pick<BenefitStatus, 'id' | 'cycleEndDate' | 'isCompleted' | 'isNotUsable'>[];
  }>;
  events?: Pick<CreditCardEvent, 'id' | 'eventType' | 'eventDate' | 'description'>[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toUtcDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateInput(value: Date | string | null | undefined): string {
  const date = toUtcDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

export function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseDateInput(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return parseIsoDateOnly(value);
}

export function deriveNextAnnualFeeDueDate(
  openedDate: Date | string | null | undefined,
  referenceDate: Date = new Date()
): Date | null {
  const opened = toUtcDate(openedDate);
  if (!opened) return null;

  const reference = toUtcDate(referenceDate) ?? new Date();
  let dueDate = new Date(Date.UTC(
    reference.getUTCFullYear(),
    opened.getUTCMonth(),
    opened.getUTCDate()
  ));

  if (dueDate.getTime() < reference.getTime()) {
    dueDate = new Date(Date.UTC(
      reference.getUTCFullYear() + 1,
      opened.getUTCMonth(),
      opened.getUTCDate()
    ));
  }

  return dueDate;
}

export function isWithinDays(date: Date, referenceDate: Date, daysAhead: number): boolean {
  const normalizedDate = toUtcDate(date);
  const normalizedReference = toUtcDate(referenceDate);
  if (!normalizedDate || !normalizedReference) return false;

  const diffDays = Math.floor((normalizedDate.getTime() - normalizedReference.getTime()) / MS_PER_DAY);
  return diffDays >= 0 && diffDays <= daysAhead;
}

export function getCardEventLabel(eventType: CardEventType | string): string {
  switch (eventType) {
    case 'OPENED':
      return 'Opened';
    case 'ANNUAL_FEE':
      return 'Annual fee';
    case 'RETENTION':
      return 'Retention';
    case 'PRODUCT_CHANGE':
      return 'Product change';
    case 'CLOSED':
      return 'Closed';
    case 'SIGNUP_BONUS':
      return 'Sign-up bonus';
    case 'SPEND_DEADLINE':
      return 'Spend deadline';
    default:
      return 'Note';
  }
}

export function buildCardCalendarEvents(
  cards: LifecycleCardProjection[],
  options: {
    referenceDate?: Date;
    daysAhead?: number;
  } = {}
): CardCalendarEvent[] {
  const referenceDate = options.referenceDate ?? new Date();
  const daysAhead = options.daysAhead ?? 120;
  const events: CardCalendarEvent[] = [];

  for (const card of cards) {
    const cardLabel = card.name;
    const annualFeeDate = toUtcDate(card.annualFeeDueDate);
    if (annualFeeDate && isWithinDays(annualFeeDate, referenceDate, daysAhead)) {
      events.push({
        id: `${card.id}-annual-fee`,
        kind: 'annual_fee',
        title: `${cardLabel} annual fee`,
        date: annualFeeDate,
        cardId: card.id,
        cardName: card.name,
        cardIssuer: card.issuer,
        amount: card.annualFeeAmount,
      });
    }

    const openedDate = toUtcDate(card.openedDate);
    const anniversaryDate = deriveNextAnnualFeeDueDate(openedDate, referenceDate);
    if (anniversaryDate && isWithinDays(anniversaryDate, referenceDate, daysAhead)) {
      events.push({
        id: `${card.id}-anniversary`,
        kind: 'anniversary',
        title: `${cardLabel} anniversary`,
        date: anniversaryDate,
        cardId: card.id,
        cardName: card.name,
        cardIssuer: card.issuer,
      });
    }

    const signupBonusDeadline = toUtcDate(card.signupBonusDeadline);
    if (signupBonusDeadline && isWithinDays(signupBonusDeadline, referenceDate, daysAhead)) {
      events.push({
        id: `${card.id}-signup-bonus`,
        kind: 'signup_bonus_deadline',
        title: `${cardLabel} sign-up bonus deadline`,
        date: signupBonusDeadline,
        cardId: card.id,
        cardName: card.name,
        cardIssuer: card.issuer,
      });
    }

    const spendDeadline = toUtcDate(card.spendDeadline);
    if (spendDeadline && isWithinDays(spendDeadline, referenceDate, daysAhead)) {
      events.push({
        id: `${card.id}-spend-deadline`,
        kind: 'spend_deadline',
        title: `${cardLabel} spend deadline`,
        date: spendDeadline,
        cardId: card.id,
        cardName: card.name,
        cardIssuer: card.issuer,
      });
    }

    for (const benefit of card.benefits ?? []) {
      for (const status of benefit.benefitStatuses ?? []) {
        const cycleEndDate = toUtcDate(status.cycleEndDate);
        if (!cycleEndDate || status.isCompleted || status.isNotUsable) continue;
        if (!isWithinDays(cycleEndDate, referenceDate, daysAhead)) continue;

        events.push({
          id: `${status.id}-benefit-expires`,
          kind: 'benefit_expires',
          title: `${benefit.description} expires`,
          date: cycleEndDate,
          cardId: card.id,
          cardName: card.name,
          cardIssuer: card.issuer,
          description: benefit.description,
        });
      }
    }

    for (const cardEvent of card.events ?? []) {
      const eventDate = toUtcDate(cardEvent.eventDate);
      if (!eventDate || !isWithinDays(eventDate, referenceDate, daysAhead)) continue;

      events.push({
        id: cardEvent.id,
        kind: 'card_event',
        title: `${getCardEventLabel(cardEvent.eventType)}: ${cardLabel}`,
        date: eventDate,
        cardId: card.id,
        cardName: card.name,
        cardIssuer: card.issuer,
        description: cardEvent.description,
      });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}
