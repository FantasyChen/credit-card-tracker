import { inferBenefitUsageWaySlug } from './benefit-usage-matching';

export type StaticBenefitFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type StaticBenefitCycleAlignment = 'CARD_ANNIVERSARY' | 'CALENDAR_FIXED';

export interface StaticPredefinedBenefit {
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: StaticBenefitFrequency;
  cycleAlignment?: StaticBenefitCycleAlignment;
  fixedCycleStartMonth?: number;
  fixedCycleDurationMonths?: number;
  occurrencesInCycle?: number;
}

export interface StaticPredefinedCard {
  name: string;
  issuer: string;
  annualFee: number;
  imageUrl: string | null;
  benefits: readonly StaticPredefinedBenefit[];
}

export interface StaticBenefitUsageWay {
  title: string;
  slug: string;
  description: string;
  category: string;
  content: string;
  tips: readonly string[];
}

export interface PublicStaticBenefit extends StaticPredefinedBenefit {
  id: string;
  usageWay: Pick<StaticBenefitUsageWay, 'slug' | 'title'> | null;
}

export interface PublicStaticCard extends Omit<StaticPredefinedCard, 'benefits'> {
  id: string;
  benefits: PublicStaticBenefit[];
  updatedAt: string;
}

export const STATIC_CATALOG_UPDATED_AT = '2026-06-26';

export const predefinedCardsData = [
    {
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-sapphire-preferred.png',
      benefits: [
        {
          description: '$100 Annual Hotel Credit (Booked through Chase Travel)',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          // cycleAlignment: 'CARD_ANNIVERSARY' (default)
        },
        {
          description: '$10 Monthly DoorDash Credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$120 Global Entry, TSA PreCheck, or NEXUS Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 48,
        },
      ],
    },
    {
      name: 'American Express Gold Card',
      issuer: 'American Express',
      annualFee: 325,
      imageUrl: '/images/cards/american-express-gold-card.png',
      benefits: [
        {
          description: '$10 Monthly Uber Cash',
          category: 'Travel',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Dining Credit (e.g., Grubhub, Cheesecake Factory)',
          category: 'Dining',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$7 Monthly Dunkin Credit',
          category: 'Dining',
          maxAmount: 7,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$50 Resy Credit (Jan-Jun)',
          category: 'Dining',
          maxAmount: 50,
          frequency: 'YEARLY', // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Resy Credit (Jul-Dec)',
          category: 'Dining',
          maxAmount: 50,
          frequency: 'YEARLY', // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
      ],
    },
    {
      name: 'Capital One Venture X',
      issuer: 'Capital One',
      annualFee: 395,
      imageUrl: '/images/cards/capital-one-venture-x.png',
      benefits: [
        {
          description: '$300 Annual Travel Credit (via Capital One Travel)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '10,000 Anniversary Bonus Miles',
          category: 'Bonus',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Sapphire Reserve',
      issuer: 'Chase',
      annualFee: 795,
      imageUrl: '/images/cards/chase-sapphire-reserve.jpg',
      benefits: [
        {
          description: '$300 Annual Travel Credit',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
        },
        {
          description: '$150 Semi-Annual Fine Dining Credit (Select Restaurants - Jan-Jun)',
          category: 'Dining',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$150 Semi-Annual Fine Dining Credit (Select Restaurants - Jul-Dec)',
          category: 'Dining',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$250 The Edit Credit (up to 2 prepaid bookings annually)',
          category: 'Travel',
          maxAmount: 250,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          occurrencesInCycle: 2,
        },
        {
          description: '$250 Select Chase Travel Hotel Credit (through 12/31/2026)',
          category: 'Travel',
          maxAmount: 250,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 12,
        },
        {
          description: '$150 Semi-Annual StubHub Credit (Event Tickets - Jan-Jun)',
          category: 'Entertainment',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$150 Semi-Annual StubHub Credit (Event Tickets - Jul-Dec)',
          category: 'Entertainment',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$25 Monthly DoorDash Promo Credits',
          category: 'Food Delivery',
          maxAmount: 25,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Lyft Credit',
          category: 'Transportation',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$20.83 Monthly Apple Subscriptions (TV+ and Music)',
          category: 'Entertainment',
          maxAmount: 20.83,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Peloton Credit',
          category: 'Fitness',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$120 Global Entry, TSA PreCheck, or NEXUS Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 48,
        },
        {
          description: 'Points Boost: Up to 2¢ per point on select Chase Travel bookings',
          category: 'Travel',
          maxAmount: 0, // Value varies based on usage
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Ink Business Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-ink-business-preferred.jpg',
      benefits: [],
    },
    {
      name: 'American Express Platinum Card',
      issuer: 'American Express',
      annualFee: 895,
      imageUrl: '/images/cards/american-express-platinum-card.png',
      benefits: [
        // Existing benefits that remain unchanged
        {
          description: '$200 Airline Fee Credit (Incidental Fees, select one airline)',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$15 Monthly Uber Cash ($35 in December)',
          category: 'Travel',
          maxAmount: 15,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$20 Additional Uber Cash (December)',
          category: 'Travel',
          maxAmount: 20,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED', // Specific to December
          fixedCycleStartMonth: 12, // December
          fixedCycleDurationMonths: 1, // For the month of December
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jan-Jun)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jul-Dec)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        // NEW 2025 BENEFITS - Quarterly benefits split by quarter
        {
          description: '$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)',
          category: 'Dining',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Q1: Jan-Mar
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q2: Apr-Jun)',
          category: 'Dining',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 4, // April
          fixedCycleDurationMonths: 3, // Q2: Apr-Jun
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
          category: 'Dining',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 3, // Q3: Jul-Sep
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q4: Oct-Dec)',
          category: 'Dining',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 10, // October
          fixedCycleDurationMonths: 3, // Q4: Oct-Dec
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q1: Jan-Mar)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Q1: Jan-Mar
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q2: Apr-Jun)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 4, // April
          fixedCycleDurationMonths: 3, // Q2: Apr-Jun
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q3: Jul-Sep)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 3, // Q3: Jul-Sep
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q4: Oct-Dec)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 10, // October
          fixedCycleDurationMonths: 3, // Q4: Oct-Dec
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$25 Monthly Digital Entertainment Credit',
          category: 'Entertainment',
          maxAmount: 25,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$120 Annual Uber One Membership Credit',
          category: 'Membership',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$200 Annual Oura Ring Credit',
          category: 'Wellness',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$12.95 Monthly Walmart+ Membership Credit',
          category: 'Membership',
          maxAmount: 12.95,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'American Express Business Platinum Card',
      issuer: 'American Express',
      annualFee: 895,
      imageUrl: '/images/cards/american-express-business-platinum-card.png',
      benefits: [
        // Existing benefits that remain unchanged
        {
          description: '$200 Airline Fee Credit',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // NEW 2025 BENEFITS
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$1,150 Annual Dell Technologies Credit',
          category: 'Electronics',
          maxAmount: 1150,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$250 Annual Adobe Credit (after $600 spend)',
          category: 'Software',
          maxAmount: 250,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // High-spending benefits for $250K+ annual spenders
        {
          description: '$1,200 Annual Amex Travel Flight Credit (High Spender Benefit)',
          category: 'Travel',
          maxAmount: 1200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$2,400 Annual One AP Statement Credit (High Spender Benefit)',
          category: 'Business Services',
          maxAmount: 2400,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // NEW BENEFIT: Quarterly Hilton Credit
        {
          description: '$50 Quarterly Hilton Credit (Hilton properties)',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'QUARTERLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          occurrencesInCycle: 1,
        },
        {
          description: '$90 Quarterly Indeed Credit (Job Postings)',
          category: 'Business Services',
          maxAmount: 90,
          frequency: 'QUARTERLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$10 Monthly Wireless Bill Credit',
          category: 'Business Services',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'American Express Business Gold Card',
      issuer: 'American Express',
      annualFee: 375,
      imageUrl: '/images/cards/american-express-business-gold-card.png',
      benefits: [
        {
          description: '$20 Monthly Flexible Business Credit (FedEx, Grubhub, Office Supply)',
          category: 'Business',
          maxAmount: 20,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$12.95 Monthly Walmart+ Membership Credit',
          category: 'Membership',
          maxAmount: 12.95,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Hilton Honors American Express Aspire Card',
      issuer: 'American Express',
      annualFee: 550,
      imageUrl: '/images/cards/hilton-honors-american-express-aspire-card.png',
      benefits: [
        {
          description: 'Annual Free Night Reward',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$50 Quarterly Flight Credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'QUARTERLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jan-Jun)',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jul-Dec)',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$189 CLEAR Plus Credit',
          category: 'Travel',
          maxAmount: 189,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
      ],
    },
    {
      name: 'Hilton Honors American Express Surpass Card',
      issuer: 'American Express',
      annualFee: 150,
      imageUrl: '/images/cards/hilton-honors-american-express-surpass-card.png',
      benefits: [
        {
          description: '$50 Quarterly Hilton Credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'QUARTERLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
      ],
    },
    {
      name: 'Hilton Honors American Express Business Card',
      issuer: 'American Express',
      annualFee: 195,
      imageUrl: '/images/cards/hilton-honors-american-express-business-card.png',
      benefits: [
        {
          description: '$60 Quarterly Hilton Credit ($240 annual)',
          category: 'Travel',
          maxAmount: 60,
          frequency: 'QUARTERLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Delta SkyMiles Gold American Express Card',
      issuer: 'American Express',
      annualFee: 150,
      imageUrl: '/images/cards/delta-skymiles-gold-american-express-card.png',
      benefits: [
        {
          description: '$200 Delta Flight Credit (after $10k spend)',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 Delta Stays Credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Delta SkyMiles Platinum American Express Card',
      issuer: 'American Express',
      annualFee: 350,
      imageUrl: '/images/cards/delta-skymiles-platinum-american-express-card.png',
      benefits: [
        {
          description: '$150 Delta Stays Credit',
          category: 'Travel',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Resy Credit',
          category: 'Dining',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Travel',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Delta SkyMiles Reserve American Express Card',
      issuer: 'American Express',
      annualFee: 650,
      imageUrl: '/images/cards/delta-skymiles-reserve-american-express-card.png',
      benefits: [
        {
          description: '$200 Delta Stays Credit',
          category: 'Travel',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$20 Monthly Resy Credit',
          category: 'Dining',
          maxAmount: 20,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Travel',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'IHG One Rewards Premier Credit Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/ihg-one-rewards-premier-credit-card.jpg',
      benefits: [
        {
          description: 'Annual Anniversary Free Night (up to 40k points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'IHG One Rewards Premier Business Credit Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/ihg-one-rewards-premier-business-credit-card.jpg',
      benefits: [
        {
          description: 'Annual Anniversary Free Night (up to 40k points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Marriott Bonvoy Brilliant American Express Card',
      issuer: 'American Express',
      annualFee: 650,
      imageUrl: '/images/cards/marriott-bonvoy-brilliant-american-express-card.png',
      benefits: [
        {
          description: 'Annual Free Night Award (up to 85k points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$25 Monthly Dining Credit',
          category: 'Dining',
          maxAmount: 25,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase United Explorer Card',
      issuer: 'Chase',
      annualFee: 150,
      imageUrl: '/images/cards/chase-united-explorer-card.avif',
      benefits: [
        {
          description: '2 United Club one-time passes',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$50 United Hotels credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
          occurrencesInCycle: 2,
        },
        {
          description: '$5 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 5,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase United Quest Card',
      issuer: 'Chase',
      annualFee: 250,
      imageUrl: '/images/cards/chase-united-quest-card.png',
      benefits: [
        {
          description: '$125 annual United purchase credit',
          category: 'Travel',
          maxAmount: 125,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '5,000-mile anniversary award flight credit',
          category: 'Bonus',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$150 Renowned Hotels credit',
          category: 'Travel',
          maxAmount: 150,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$8 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 8,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$15 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 15,
          frequency: 'MONTHLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Southwest Rapid Rewards Plus Card',
      issuer: 'Chase',
      annualFee: 69,
      imageUrl: '/images/cards/chase-southwest-rapid-rewards-plus-card.png',
      benefits: [
        {
          description: '3,000 anniversary bonus points',
          category: 'Bonus',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Two EarlyBird Check-In credits per year',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Southwest Rapid Rewards Priority Credit Card',
      issuer: 'Chase',
      annualFee: 149,
      imageUrl: '/images/cards/chase-southwest-rapid-rewards-priority-card.png',
      benefits: [
        {
          description: '$75 Southwest annual travel credit',
          category: 'Travel',
          maxAmount: 75,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '4 Upgraded Boardings per year',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Southwest Rapid Rewards Premier Credit Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/chase-southwest-rapid-rewards-premier-card.png',
      benefits: [
        {
          description: '6,000 anniversary points',
          category: 'Travel',
          maxAmount: 78,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '2 EarlyBird Check-In credits per year',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Marriott Bonvoy Boundless Credit Card',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-marriott-bonvoy-boundless.jpg',
      benefits: [
        {
          description: 'Annual Free Night Award (up to 35k points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Alaska Airlines Visa Signature® credit card',
      issuer: 'Bank of America',
      annualFee: 95,
      imageUrl: '/images/cards/alaska-airlines-visa-signature-credit-card.png',
      benefits: [
        {
          description: "Alaska\'s Famous Companion Fare™ (from $122)",
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Atmos Rewards Summit Visa Infinite Card',
      issuer: 'Bank of America',
      annualFee: 395,
      imageUrl: '/images/cards/atmos-rewards-summit-visa-infinite-card.png',
      benefits: [
        {
          description: '8 Alaska Lounge Passes (Annual)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$50 Travel Delay Credit (Per Qualifying Delay)',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'ONE_TIME',
          percentage: 0,
        },
        {
          description: '10,000 Annual Bonus Atmos Points',
          category: 'Bonus',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Global Companion Award (Annual)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Atmos Rewards Ascent Visa Signature Card',
      issuer: 'Bank of America',
      annualFee: 95,
      imageUrl: '/images/cards/atmos-rewards-ascent-visa-signature-card.png',
      benefits: [
        {
          description: '$99 Companion Fare (Annual, plus taxes from $23)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Atmos Rewards Visa Business Card',
      issuer: 'Bank of America',
      annualFee: 70,
      imageUrl: '/images/cards/atmos-rewards-visa-business-card.png',
      benefits: [
        {
          description: '$99 Companion Fare (Annual, plus taxes from $23)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'HSBC Elite Credit Card',
      issuer: 'HSBC',
      annualFee: 495,
      imageUrl: '/images/cards/hsbc-elite-world-elite-mastercard.jpg',
      benefits: [
        {
          description: '$400 Annual Travel Credit (HSBC Travel bookings)',
          category: 'Travel',
          maxAmount: 400,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Transportation',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart+ Credit (second order)',
          category: 'Grocery',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$5 Monthly Lyft Credit (after 3 rides)',
          category: 'Transportation',
          maxAmount: 5,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$120 Security Screening Credit (Global Entry/TSA PreCheck, every 4.5 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 54, // 4.5 years = 54 months
        },
      ],
    },
    {
      name: 'Chase United Business Card',
      issuer: 'Chase',
      annualFee: 99,
      imageUrl: '/images/cards/chase-united-business-card.png',
      benefits: [
        {
          description: '2 United Club one-time passes',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 United travel credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$50 United Hotels credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
          occurrencesInCycle: 2,
        },
        {
          description: '$5 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 5,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: 'MONTHLY',
          percentage: 0,
        },
        {
          description: '$25 FareLock credit',
          category: 'Travel',
          maxAmount: 25,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'The Ritz-Carlton Credit Card',
      issuer: 'Chase',
      annualFee: 450,
      imageUrl: '/images/cards/the-ritz-carlton-credit-card.jpg',
      benefits: [
        {
          description: '$300 Annual Travel Credit',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Annual Free Night Award (up to 85,000 points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '$100 Hotel Credit (The Ritz-Carlton and St. Regis hotels)',
          category: 'Travel',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Priority Pass Select Membership',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Global Entry/TSA PreCheck Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 48, // 4 years = 48 months
        },
      ],
    },
    {
      name: 'Marriott Bonvoy Business American Express Card',
      issuer: 'American Express',
      annualFee: 125,
      imageUrl: '/images/cards/marriott-bonvoy-business-american-express-card.png',
      benefits: [
        {
          description: 'Annual Free Night Award (up to 35,000 points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: '15 Elite Night Credits towards Marriott Bonvoy Elite status',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
        {
          description: 'Marriott Bonvoy Gold Elite Status (complimentary)',
          category: 'Travel',
          maxAmount: 0,
          frequency: 'YEARLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Discover it Cash Back',
      issuer: 'Discover',
      annualFee: 0,
      imageUrl: '/images/cards/discover-it-cash-back.png',
      benefits: [
        {
          description: 'Activate 5% Quarterly Categories (up to $1,500 spend)',
          category: 'Rewards',
          maxAmount: 75, // 5% of $1,500
          frequency: 'QUARTERLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Freedom Flex',
      issuer: 'Chase',
      annualFee: 0,
      imageUrl: '/images/cards/chase-freedom-flex.png',
      benefits: [
        {
          description: 'Activate 5% Quarterly Categories (up to $1,500 spend)',
          category: 'Rewards',
          maxAmount: 75, // 5% of $1,500
          frequency: 'QUARTERLY',
          percentage: 0,
        },
      ],
    },
    {
      name: 'Citi Strata Elite',
      issuer: 'Citi',
      annualFee: 595,
      imageUrl: '/images/cards/citi-strata-elite.png',
      benefits: [
        {
          description: 'Up to $300 Annual Hotel Benefit (2+ nights via Citi Travel)',
          category: 'Travel',
          maxAmount: 300,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: 'Up to $200 Annual Splurge Credit℠ (select brands)',
          category: 'Shopping',
          maxAmount: 200,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 12,
        },
        {
          description: 'Up to $100 Blacklane® Credit (Jan-Jun)',
          category: 'Transportation',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // Jan-Jun window
          fixedCycleDurationMonths: 6,
        },
        {
          description: 'Up to $100 Blacklane® Credit (Jul-Dec)',
          category: 'Transportation',
          maxAmount: 100,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 7, // Jul-Dec window
          fixedCycleDurationMonths: 6,
        },
        {
          description: '4 Admirals Club® Citi Strata Elite℠ Passes (American Airlines)',
          category: 'Travel',
          maxAmount: 300, // Estimated value (~$75 per pass)
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CALENDAR_FIXED',
          fixedCycleStartMonth: 1, // Calendar year
          fixedCycleDurationMonths: 12,
        },
        {
          description: 'Up to $120 Global Entry or TSA PreCheck® Application Fee Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: 'YEARLY',
          percentage: 0,
          cycleAlignment: 'CARD_ANNIVERSARY',
          fixedCycleDurationMonths: 48, // 4 years
        },
      ],
    },
  ] as const satisfies readonly StaticPredefinedCard[];

export const benefitUsageWays = [
    {
      title: 'How to Use Airline Fee Credits',
      slug: 'airline-fee-credits',
      description: 'Maximize your airline fee reimbursements and get the most value from your travel credits',
      category: 'Travel',
      content: `## Getting Reimbursed

Airline fee credits are designed to offset incidental charges when flying. To ensure you get reimbursed:

1. **Purchase eligible items directly from the airline** - Book on the airline's website or app, not through third-party sites
2. **Use the credit card linked to this benefit** - Make sure you're using the correct card for the purchase
3. **Credits post within 1-2 billing cycles** - Be patient, reimbursements aren't instant

## What Qualifies

Most issuers cover these airline fees:
- ✈️ Checked bag fees
- 💺 Seat selection and upgrades
- 🍽️ In-flight food and beverage purchases
- 🔄 Change and cancellation fees
- 📞 Phone booking fees
- 🎒 Carry-on bag fees (budget airlines)

## What Doesn't Qualify

Be aware these typically don't count:
- ❌ Actual ticket purchases
- ❌ Bookings through third-party sites (Expedia, Kayak, etc.)
- ❌ Gift cards (some issuers restrict this)
- ❌ Travel packages or vacation bundles

## Watch Outs

Refund-based airline workarounds and travel-bank style methods can change quickly and may be clawed back. The dependable workflow is to use the credit for real eligible incidental fees on the selected airline and keep receipts until the credit posts.

## Nitan DP Map

Community playbooks change by airline and calendar year:

- **United TravelBank** had strong 2025 and early-2026 data points for Amex airline-fee credits, usually in $50 or $100 chunks after selecting United. By mid-2026, current Nitan/DoC discussion labels the Amex Platinum path as likely dead, so do not treat old UA data points as current.
- **Southwest low-fare/change methods** are still discussed as the fallback for some Amex airline-fee credits: keep each incremental airline charge below the apparent reimbursement threshold, then track the resulting refund or travel credit carefully.
- **Aspire airline credit** is quarterly and does not require the same airline-selection flow as Amex Platinum-style incidental credits; do not copy one card's workflow to another without checking terms.
- **Ritz/BoA/other airline credits** can have different reimbursement rules and manual-review paths.

## If You Test an Advanced Path

1. Confirm the selected airline or card-specific airline rule first.
2. Use a small test transaction early in the period.
3. Wait for the benefit meter or statement credit before scaling.
4. Track any resulting airline credit expiration separately.
5. Avoid asking customer service to bless a workaround; it can draw manual review.

## Pro Tips

- Check your specific issuer's terms for the detailed list
- Some cards require you to select a preferred airline at the start of the year
- Credits usually don't roll over to the next year
- Set calendar reminders before expiration`,
      tips: [
        'Book directly on airline website, not through OTAs like Expedia',
        'Check your issuer\'s specific list of qualifying purchases',
        'Credits typically post within 1-2 statements, not immediately',
        'Some cards require pre-selecting your airline for the year'
      ]
    },
    {
      title: 'How to Use Uber and Lyft Credits',
      slug: 'rideshare-credits',
      description: 'Redeem your monthly ride-sharing credits and get free transportation',
      category: 'Transportation',
      content: `## Activation Steps

Getting your Uber/Lyft credits is straightforward:

1. **Link your credit card** - Add the card to your Uber or Lyft app payment methods
2. **Credits auto-apply at checkout** - No need to manually activate
3. **Must use within the month** - Credits typically don't roll over month-to-month

## Uber Cash Details

For cards offering Uber Cash:
- 💵 Credits deposit on the 1st of each month (or your card anniversary)
- 🍔 Can be used for Uber Eats food delivery too
- 🚗 Split payment if ride exceeds credit amount
- 📅 Expires at month-end - use it or lose it

## Lyft Credit Details

For cards offering Lyft credits:
- 🚕 Applied automatically at checkout
- 💳 Must use the enrolled card for the ride
- 📱 Credits show in your Lyft wallet
- ⏰ Monthly reset varies by issuer

## Maximizing Value

**For Uber Credits:**
- Use Uber Eats for groceries or restaurant delivery
- Combine multiple trips if your credit is small
- Stack with Uber promotions when available

**For Lyft Credits:**
- Take advantage during surge pricing times
- Use for airport rides to maximize value
- Combine with Lyft Pink membership benefits

## Delta and United Rideshare Caveats

Some cards reimburse rideshare charges but not food delivery. Nitan data points show these are more fragile than ordinary Uber Cash:

- Delta Platinum/Reserve rideshare credits require Amex enrollment and can take up to 24 hours after enrollment to activate.
- Lyft balance reloads have had positive data points, but the minimum reload can be higher than the monthly credit.
- The Uber Eats Family-profile workaround that once made food orders post as rideshare is now marked Amex dead in recent community reports.
- If you need food delivery, use true Uber Cash benefits; if you need a rideshare credit, a real ride or a Lyft balance test is cleaner.

## Common Issues

- ⚠️ Credits don't stack month-to-month
- ⚠️ Tips don't count toward credit usage
- ⚠️ Must complete ride/delivery in the same month`,
      tips: [
        'Set a reminder to use credits before month-end',
        'Uber credits work for both rides AND Uber Eats',
        'Credits don\'t roll over - use them or lose them',
        'Link the card before the month starts to ensure credits deposit'
      ]
    },
    {
      title: 'How to Use Hotel Credits',
      slug: 'hotel-credits',
      description: 'General fallback for hotel credits that do not fit a more specific guide',
      category: 'Travel',
      content: `## First Identify the Credit Type

Hotel credits are not interchangeable. Before booking, confirm whether your benefit is tied to:

- A bank travel portal
- A named hotel collection such as FHR, THC, The Edit, or Renowned Hotels
- A hotel brand such as Hilton
- A stay length requirement, prepaid requirement, or semi-annual window

## Practical Workflow

1. Open the card issuer's benefit terms for the specific credit.
2. Book through the required channel, not a similar-looking third-party site.
3. Pay with the card that carries the benefit.
4. Keep the confirmation, hotel folio, and statement credit record.
5. Leave enough time before the benefit window ends for the credit to post.

## Watch Outs

Hotel credits need to be separated by program because refund behavior, clawback risk, and posting timing vary. Use this generic guide only when no specific guide matches the benefit.

## Common Mistakes

- Booking through the wrong portal
- Assuming a brand credit works at every related property
- Forgetting a two-night or prepaid requirement
- Cancelling after a credit posts and expecting the credit to remain
- Waiting until the last few days of the cycle`,
      tips: [
        'Hotel credits need program-specific handling',
        'Confirm portal, prepaid, stay-length, and date-window requirements',
        'Keep the hotel folio until the statement credit is final',
        'Use the more specific guide when one is available'
      ]
    },
    {
      title: 'How to Use Amex FHR and THC Hotel Credits',
      slug: 'amex-fhr-thc-hotel-credit',
      description: 'Use Amex hotel credits for prepaid Fine Hotels + Resorts and The Hotel Collection bookings',
      category: 'Travel',
      content: `## What This Credit Is For

This guide applies to Amex hotel credits labeled FHR, Fine Hotels + Resorts, THC, or The Hotel Collection.

## Booking Steps

1. Go through Amex Travel while signed into the account that has the card.
2. Filter for Fine Hotels + Resorts or The Hotel Collection.
3. For THC, confirm the stay meets the minimum night requirement shown at checkout.
4. Choose a prepaid or Pay Now rate when the benefit requires prepaid booking.
5. Pay with the eligible Amex card, then save both the Amex Travel confirmation and final hotel folio.

## Timing

- The credit is tied to the benefit window, so do not wait until the final days.
- The charge can post before the stay, but adjustments can still happen later.
- Check both the original charge and any hotel-side incidental charges separately.

## Watch Outs

These credits are not the same as generic travel portal credits. Treat cancellation or rollover tricks as risky data points, not a dependable product workflow.

## Avoid

- Booking a non-FHR/THC hotel and expecting the credit
- Using points or a third-party agency instead of the required Amex Travel flow
- Missing the THC minimum-stay rule
- Relying on refund behavior to preserve a credit`,
      tips: [
        'Use Amex Travel and verify FHR or THC branding at checkout',
        'THC bookings commonly require a minimum stay shown in the portal',
        'Use prepaid or Pay Now when the benefit requires it',
        'Keep the Amex Travel confirmation and final hotel folio'
      ]
    },
    {
      title: 'How to Use Chase The Edit Hotel Credits',
      slug: 'chase-the-edit-hotel-credit',
      description: 'Use Chase Sapphire Reserve hotel credits at The Edit properties',
      category: 'Travel',
      content: `## Where to Book

This applies to benefits labeled The Edit by Chase. Book through Chase Travel and make sure the property is shown as part of The Edit collection before checkout.

## Booking Steps

1. Open Chase Travel from the account that has the eligible Sapphire card.
2. Search hotels and select a property marked The Edit.
3. Confirm the annual terms, booking cap, and any two-night minimum before paying.
4. Pay with the eligible Chase card.
5. Save the booking confirmation and final folio.

## Practical Use

- Use it for a stay you expect to complete.
- Track each eligible booking separately when the credit allows more than one annual use.
- Do not assume ordinary Chase Travel hotels qualify.
- Watch for prepaid versus pay-at-property terms in checkout.

## Watch Outs

The Edit is its own hotel collection, separate from generic Chase Travel credits. Cancelled bookings can be adjusted later, so the safer workflow is to use the credit for a completed eligible stay.

## Avoid

- Booking a regular Chase Travel hotel without The Edit branding
- Treating a cancelled booking as reliable value
- Waiting until the last week of the annual benefit period
- Paying with a different card`,
      tips: [
        'Confirm The Edit branding before checkout',
        'Track each eligible prepaid booking separately',
        'Use the eligible Chase card for payment',
        'Cancelled bookings can carry clawback risk'
      ]
    },
    {
      title: 'How to Use Hilton Property and Resort Credits',
      slug: 'hilton-property-credits',
      description: 'Use Hilton quarterly, semi-annual, and resort credits with Hilton properties',
      category: 'Travel',
      content: `## Match the Hilton Credit Type

Hilton credits in the catalog are not all identical:

- Aspire resort credits are tied to eligible Hilton resort properties.
- Surpass and Hilton Business quarterly credits are broader Hilton-property credits.
- Some benefits are calendar quarters; some are semi-annual windows.

## Booking Steps

1. Book directly with Hilton or through the Hilton app when possible.
2. Confirm the property type if the benefit says resort.
3. Pay eligible room, tax, resort-fee, dining, or incidental charges with the card carrying the credit.
4. For quarterly credits, make sure the charge posts inside the correct quarter.
5. Keep the folio, especially if checkout happens near the end of a benefit window.

## Useful Patterns

- A real paid stay is the cleanest use case.
- If you have a small quarterly credit, use it for a short stay, dining, parking, or other property-billed charges where terms allow.
- For resort credits, verify the hotel is in Hilton's eligible resort list before booking.

## Watch Outs

Refund behavior has risk, so favor completed stays and legitimate property-billed charges.

## Avoid

- Assuming every Hilton hotel is an eligible resort
- Letting a quarterly charge post after quarter-end
- Relying on refundable deposits as the main plan
- Splitting charges without confirming the hotel can bill the card cleanly`,
      tips: [
        'Check whether the benefit says resort or Hilton property',
        'For quarterly credits, posting date matters',
        'Book direct with Hilton when possible',
        'Use real property-billed charges and keep the folio'
      ]
    },
    {
      title: 'How to Use Delta Stays Credits',
      slug: 'delta-stays-credit',
      description: 'Use Delta Stays credits through the Delta hotel booking path',
      category: 'Travel',
      content: `## Where to Book

Use the Delta Stays booking path, not a generic hotel site and not the hotel's direct booking page. The charge and confirmation should clearly connect to Delta Stays.

## Booking Steps

1. Start from the Delta Stays benefit link or Delta's hotel booking page.
2. Choose a qualifying prepaid hotel rate when required.
3. Pay with the Delta Amex card that has the benefit.
4. Save the Delta Stays confirmation and the final hotel folio.
5. Check the statement after the charge posts.

## Practical Use

- Treat this as a hotel booking credit, not a general Delta credit.
- Use it when you already need a paid hotel night.
- Leave time before year-end in case the first booking does not trigger as expected.

## Watch Outs

Delta Stays is separate from FHR/THC, travel portal credits, and Delta flight credits. Modification and refund behavior can be messy, so avoid building the plan around cancellations.

## Avoid

- Booking direct with the hotel and expecting Delta Stays credit
- Confusing Delta Stays with Delta flight credits
- Cancelling after credit posts and assuming no adjustment
- Waiting until December for a first attempt`,
      tips: [
        'Start from Delta Stays, not a normal hotel site',
        'Pay with the eligible Delta Amex card',
        'This is separate from Delta flight or airline-fee credits',
        'Refund and modification behavior is not a reliable strategy'
      ]
    },
    {
      title: 'How to Use Citi Travel Hotel Benefits',
      slug: 'citi-travel-hotel-benefit',
      description: 'Use Citi annual hotel benefits that require Citi Travel and a qualifying stay',
      category: 'Travel',
      content: `## Core Requirement

For benefits like the Citi Strata Elite annual hotel benefit, use Citi Travel and satisfy the stay-length requirement shown in the benefit text, such as 2 or more nights.

## Booking Steps

1. Book through Citi Travel while signed into the account with the eligible card.
2. Confirm the minimum-night requirement before checkout.
3. Pay with the eligible Citi card.
4. Keep the Citi Travel confirmation and final folio.
5. Track whether the credit is applied at checkout or posts later as a statement credit.

## Practical Use

- This is best for a planned paid hotel stay where Citi Travel pricing is competitive.
- Compare the portal rate with the hotel direct rate before deciding.
- If the benefit applies as a discount at booking, a refund may simply reverse the discounted transaction rather than create usable credit.

## Watch Outs

Citi travel-portal hotel behavior has less public data than Amex and Chase hotel credits. Keep the workflow conservative until you have a booking you actually plan to complete.

## Avoid

- Booking fewer nights than the requirement
- Assuming regular hotel direct bookings qualify
- Assuming refund behavior will mirror Chase or Amex credits
- Forgetting to compare portal pricing`,
      tips: [
        'Use Citi Travel, not a hotel direct booking',
        'Confirm the minimum-night rule before paying',
        'Compare portal and direct rates',
        'Current public data is thinner than for Amex and Chase'
      ]
    },
    {
      title: 'How to Use United Hotel and Travel Credits',
      slug: 'united-hotel-travel-credits',
      description: 'Use United purchase, United Hotels, and Renowned Hotels credits without mixing up channels',
      category: 'Travel',
      content: `## Identify the United Credit

United-related credits can point to different channels:

- United purchase credits usually require eligible United charges.
- United Hotels credits require the United Hotels path.
- Renowned Hotels credits require the specific hotel collection or portal tied to the card.

## Booking Steps

1. Open the benefit details and identify the required channel.
2. Use United, United Hotels, or the named hotel collection exactly as stated.
3. Pay with the eligible United card.
4. Keep the booking confirmation and receipt.
5. Track the credit after the charge posts.

## Practical Use

- Use United purchase credits for real United travel charges when possible.
- Use hotel credits only through the named hotel channel.
- Do not assume a United flight credit and United Hotels credit trigger the same way.

## Watch Outs

UA hotel and JSX-style credits are distinct from ordinary airline credits, and some approaches are fragile. Keep the channel explicit and avoid refund-dependent plans.

## Avoid

- Booking a random hotel and expecting a United Hotels credit
- Confusing United purchase credits with airline incidental credits
- Assuming OTA-controlled refunds behave like direct airline credits
- Using a different United card than the one with the benefit`,
      tips: [
        'Match the credit to the exact United or hotel channel',
        'United purchase, United Hotels, and Renowned Hotels are different flows',
        'Use the card that carries the benefit',
        'Refund-dependent tactics are fragile'
      ]
    },
    {
      title: 'How to Use Travel Portal Credits',
      slug: 'travel-portal-credits',
      description: 'Use Capital One, Chase, HSBC, and similar travel portal credits with the right booking channel',
      category: 'Travel',
      content: `## What Counts

This guide applies to broad credits that require a bank travel portal, such as Capital One Travel, Chase Travel, or HSBC Travel bookings.

## Booking Steps

1. Start inside the issuer's travel portal.
2. Choose a booking you actually expect to use: hotel, flight, car, or package depending on the terms.
3. Pay with the eligible card.
4. Save the portal confirmation and the provider confirmation.
5. Track the credit by posting date and benefit year.

## Airline Credit Conversion Notes

Some portal credits can be used for flights that later become airline-controlled credit, but this is airline-specific and can leave you with expiring funds. If you consider that path, verify current data points, expiration rules, and who controls the credit before booking.

Nitan summary for this path:

- Non-basic-economy, non-refundable airfare is the usual test vehicle because it can sometimes be changed or canceled into airline credit.
- Delta, JetBlue, and Alaska have more favorable community data points than American; United can remain OTA-controlled or require extra fees depending on the booking.
- Airline credits usually expire, often around one year from ticketing or booking activity. Track the expiration separately from the bank benefit.
- This is best for preserving value for future travel, not for users who have no realistic use for airline credit.

## Safer Use

- Book travel you already need through the required portal.
- Avoid basic-economy or restrictive fares unless you understand the rules.
- Leave time to fix a failed trigger before the credit expires.

## Avoid

- Booking outside the required portal
- Assuming every airline handles portal cancellations the same way
- Choosing a fare solely for refund mechanics
- Forgetting that airline credits can expire`,
      tips: [
        'Start inside the required issuer travel portal',
        'Portal flight-credit conversion is airline-specific and risky',
        'Book travel you can actually use when possible',
        'Track both portal confirmation and provider confirmation'
      ]
    },
    {
      title: 'How to Use Dining and Restaurant Credits',
      slug: 'dining-credits',
      description: 'Get reimbursed for dining, food delivery, and restaurant expenses',
      category: 'Dining',
      content: `## How Dining Credits Work

Dining credits come in several forms:
- 🍽️ **Restaurant Credits** - Statement credits for qualifying dining purchases
- 🚚 **Delivery Credits** - DoorDash, Uber Eats, Grubhub credits
- 🥤 **Merchant-Specific** - Credits for specific chains (Shake Shack, Cheesecake Factory, etc.)

## Activation & Usage

**For Restaurant Credits:**
1. Use your card at qualifying restaurants
2. Credit posts automatically within 1-2 billing cycles
3. Check eligible merchant categories (usually MCC 5812 and 5814)

**For Delivery Credits:**
1. Link card to delivery app (DoorDash, Uber Eats, etc.)
2. Credits auto-apply at checkout
3. Use before monthly expiration

**For Merchant-Specific Credits:**
1. Enroll the benefit in your card account (if required)
2. Make qualifying purchase at the specific merchant
3. Credit posts within 8-10 weeks typically

## Popular Credit Programs

**DoorDash Credits (Chase, Amex):**
- Monthly credits or promo-wallet discounts can range from small statement credits to larger Chase/DashPass promo bundles
- Current Chase Sapphire Reserve-style offers can include separate restaurant and non-restaurant DoorDash promos in the same month
- Add the eligible card directly in DoorDash or Caviar and avoid wallet tokens if the terms require the card as the default payment method
- Promos often require active DashPass enrollment and usually expire monthly

**Grubhub Credits (Amex Gold):**
- Part of the $10 monthly dining credit
- Combine with Grubhub+ membership
- Includes pickup orders
- No delivery fee with membership

**Shake Shack Credit (Amex Gold):**
- Monthly $10 credit
- In-store or app purchases
- Credit posts automatically
- Must enroll in Amex Offers

## Maximizing Your Credits

💡 **Stack Multiple Credits:**
- Use dining credit + credit card rewards points
- Combine with restaurant loyalty programs
- Use delivery apps during promo periods

💡 **Monthly Credits Strategy:**
- Set phone reminders for month-end
- Use for groceries via delivery apps
- Gift food to friends/family if not needed

💡 **Plan Ahead:**
- Schedule date nights around credit reset dates
- Use for team lunches or group orders
- Consider takeout if dining out isn't convenient

## Credit Expiration

⚠️ Most dining credits are use-it-or-lose-it:
- Monthly credits don't roll over
- Set calendar reminders
- Credits typically reset on the 1st or card anniversary
- Plan usage at the start of each month`,
      tips: [
        'Monthly dining credits typically don\'t roll over',
        'Delivery app credits often require active membership',
        'Link your card to apps at the start of the month',
        'Some credits require enrollment through card issuer portal',
        'Credits can often be used for both dine-in and takeout'
      ]
    },
    {
      title: 'How to Use Amex Brilliant Dining Credit via DoorDash Amazon Gift Cards',
      slug: 'brilliant-doordash-amazon-gift-card',
      description: 'A technical playbook for converting the monthly Marriott Bonvoy Brilliant dining credit into Amazon balance through DoorDash gift cards',
      category: 'Dining',
      content: `## Best Repeatable Path

The Marriott Bonvoy Brilliant dining credit is a monthly Amex statement credit. The cleanest community playbook is to run it through DoorDash's gift-card marketplace and buy an Amazon eGift card when Amazon is available.

This is a data-point-driven path, not an issuer-published redemption method. Test with a small purchase after any DoorDash or Amex coding change.

## Setup

1. Add the Brilliant card directly as a DoorDash payment method.
2. Do not pay with DoorDash gift card balance, Chase DoorDash credits, Apple Pay, or a wallet token if you are trying to preserve merchant coding.
3. Open DoorDash gift cards. Amazon may appear inside a Zift multi-brand card rather than as a plain Amazon tile.
4. If Amazon is missing, check alternate Zift card designs and try app vs. desktop before assuming it is gone.

## Monthly Runbook

1. Buy roughly $25 of Amazon-compatible eGift card value through DoorDash.
2. If DoorDash is running a discount, size the cart so the Brilliant card charge is near $25 rather than the face value.
3. Save the DoorDash receipt and the eGift delivery email until the Amex credit posts.
4. Redeem the Amazon code into your own Amazon account immediately so the code is not sitting in email.
5. Mark the benefit complete in Perks Reminder after the Amex credit posts, not when DoorDash sends the gift card.

## What to Watch

- DoorDash/Zift inventory changes. Amazon can move behind specific card designs or disappear temporarily.
- DoorDash sometimes makes gift-card promos DashPass-member-only.
- Browser, app, language, and account history can affect whether checkout succeeds.
- Amex can change merchant qualification or claw back abusive gift-card patterns.
- Overseas dining can work when the merchant processes as a restaurant, but local card acceptance is inconsistent; DoorDash gift cards are usually less operationally messy.

## Posting Expectations

Community data points commonly show the Brilliant dining credit posting a few days after a qualifying DoorDash or restaurant charge, but Amex terms can allow longer. Do not wait until the final day of the month if you need time to retry.

## Avoid

- Buying a large gift-card balance before confirming current coding
- Paying with DoorDash gift-card balance or app credits
- Letting Amazon codes sit unredeemed
- Assuming one successful month guarantees future months`,
      tips: [
        'Use the Brilliant card directly in DoorDash, not wallet tokens or DoorDash balance',
        'Look for Amazon inside Zift multi-brand gift cards if no Amazon tile appears',
        'Test small after DoorDash, Zift, or Amex coding changes',
        'Mark complete only after the Amex statement credit posts'
      ]
    },
    {
      title: 'How to Use Statement Credits',
      slug: 'statement-credits',
      description: 'Understand how automatic statement credits work and how to ensure you receive them',
      category: 'General',
      content: `## How Statement Credits Work

Statement credits are automatic reimbursements that appear on your credit card statement:

1. **Make qualifying purchase** with the enrolled card
2. **Charge appears** on your statement
3. **Credit automatically posts** within billing cycles (typically 1-2)
4. **Net charge is reduced** by the credit amount

## Types of Statement Credits

**Automatic Enrollment:**
- Travel credits (airline, hotel, etc.)
- Dining credits (DoorDash, Uber Eats)
- Streaming credits (Netflix, Hulu)
- No action needed beyond using the card

**Manual Enrollment:**
- Must add offer to card through issuer portal
- Limited time availability
- Specific merchant requirements
- Credit posts after purchase

**Annual Credits:**
- Single yearly credit (e.g., $300 travel)
- Resets on card anniversary
- Must use within the year
- Doesn't roll over

**Monthly Credits:**
- Recurring monthly (e.g., $15 Uber)
- Resets 1st of month or card anniversary date
- Must use each month
- Doesn't accumulate

## Timing of Credits

Most common timeline:
- **1-2 Billing Cycles** - Airline fees, dining, entertainment
- **8-12 Weeks** - Hotel credits, annual travel credits
- **Check your card's specific terms** for exact timing`,
      tips: [
        'Credits usually post within 1-2 billing cycles, not immediately',
        'Keep receipts for all purchases expecting statement credits',
        'Set calendar reminders before monthly/annual credits expire',
        'Some credits require enrollment or activation first',
        'Contact card issuer if expected credit doesn\'t appear',
        'Track all credits in a spreadsheet to ensure you receive them'
      ]
    },
    {
      title: 'How to Use Amex Airline Gift Card Credits (Aspire $200)',
      slug: 'amex-airline-gift-cards',
      description: 'Maximize your $200 airline fee credit by purchasing airline gift cards',
      category: 'Travel',
      content: `## The Gift Card Trick

The American Express Hilton Honors Aspire Card offers a **$250 annual airline fee credit** that can be used for airline gift cards with certain airlines:

1. **Select your preferred airline** in your Amex account (once per calendar year)
2. **Purchase gift cards directly from the airline** (not third-party sites)
3. **Keep purchase amounts small** ($50-100 increments work best)
4. **Credit posts within 1-2 billing cycles**

## Airlines That Work

Based on community reports, these airlines typically reimburse gift card purchases:

✈️ **Alaska Airlines**
- Purchase gift cards at AlaskaAir.com
- $50 or $100 denominations work best
- Credits post reliably within 1-2 statements

✈️ **Southwest Airlines**
- Buy at Southwest.com
- Multiple small purchases recommended
- Very reliable for gift card reimbursement

✈️ **American Airlines**
- Purchase at AA.com
- $100 or less per transaction
- Results may vary (check recent reports)

✈️ **Delta Airlines**
- Buy at Delta.com
- Mixed results - not as reliable as Alaska/Southwest
- Some users report success with small amounts

## Step-by-Step Process

**1. Select Your Airline**
- Log into your Amex account
- Go to Benefits → Airline Fee Credit
- Choose your preferred airline (once per calendar year)
- Wait 24 hours for selection to process

**2. Purchase Gift Cards**
- Go directly to the airline website (not third-party sites)
- Buy gift cards in **small denominations** ($50-100)
- Use your Aspire card for payment
- Save confirmation email

**3. Wait for Credit**
- Credits typically post within **1-2 billing cycles**
- Check your statement for "Airline Fee Credit"
- If no credit after 8 weeks, contact Amex

**4. Use Your Gift Cards**
- Gift cards work for flights, baggage, seat upgrades
- No expiration on most airline gift cards
- Can combine multiple gift cards per booking

## Pro Tips

💡 **Use Alaska Airlines** - Most reliable for gift card reimbursement
💡 **Buy in small amounts** - $50-100 per transaction works best
💡 **Space out purchases** - Don't buy all $250 at once
💡 **Keep records** - Save confirmation emails and receipts
💡 **Check recent data points** - Airline policies change; verify current behavior before purchasing
💡 **Select airline early** - Choose in January to maximize time

## Important Warnings

⚠️ **Not officially supported** - Amex terms say "incidental fees only"
⚠️ **Results may vary** - What works today may not work tomorrow
⚠️ **At your own risk** - Some users report clawbacks (rare)
⚠️ **Don't abuse** - Avoid large purchases or obvious gift card patterns
⚠️ **No guarantee** - This is not a promised benefit feature

## What Else Qualifies

Besides gift cards, your credit also covers:
- ✅ Checked bag fees
- ✅ Seat selection fees
- ✅ In-flight purchases
- ✅ Change/cancellation fees
- ✅ Lounge day passes

## Alternatives to Gift Cards

If you prefer to play it safe:
- Use for legitimate airline fees
- Purchase lounge access passes
- Pay for checked bags throughout the year
- Upgrade seats on flights`,
      tips: [
        'Alaska Airlines gift cards ($50-100) are most reliable for reimbursement',
        'Select your airline in January and wait 24 hours before purchasing',
        'Buy gift cards in small amounts ($50-100) rather than one large purchase',
        'Keep confirmation emails - credits post within 1-2 billing cycles',
        'This is not officially supported - results may vary by airline',
        'Check FlyerTalk and Reddit for recent data points before purchasing'
      ]
    },
    {
      title: 'How to Use Amex Resy Credits via Toast Gift Cards',
      slug: 'resy-toast-gift-cards',
      description: 'Use your Resy dining credits by purchasing Toast gift cards at participating restaurants',
      category: 'Dining',
      content: `## The Toast Gift Card Method

Many Resy restaurants use **Toast** as their point-of-sale system, which allows you to purchase gift cards online. These gift card purchases typically trigger your **Amex Resy credits**:

- **Resy Credits**: $25-100 per period (varies by card)
- **Works with**: Restaurants on Toast platform
- **Purchase**: Through restaurant website or Toast app
- **Credit posts**: Within 1-2 billing cycles

## How It Works

**1. Find Toast-Powered Resy Restaurants**
- Browse Resy.com for restaurants
- Look for restaurants with online gift card options
- Most modern restaurants use Toast for online ordering
- Check restaurant website for "Gift Cards" section

**2. Purchase Gift Cards**
- Visit the restaurant's website directly
- Click "Gift Cards" or "Buy Gift Card"
- Enter amount (match your credit amount: $25, $50, $100)
- Use your eligible Amex card
- Complete purchase

**3. Credit Posts Automatically**
- Charge appears as restaurant name on statement
- Amex Resy credit posts within 1-2 billing cycles
- No need to book through Resy app
- Credit shows as "Resy Dining Credit"

**4. Use Your Gift Card**
- Make reservations through Resy or directly
- Present gift card at restaurant
- Can use for dine-in or takeout
- Most don't expire

## Prepaid Reservation Deposit Method

Nitan data points also point to a second path: some Resy restaurants require a prepaid reservation deposit that is charged up front and refundable if canceled before the stated cutoff.

1. In Resy, search for restaurants with a prepaid reservation or deposit.
2. Read the cancellation rule carefully; some seats are non-refundable while nearby time slots or table types are refundable.
3. Use the enrolled Amex card for the deposit.
4. Wait for the charge to post and for the Resy credit email or benefit meter to move.
5. If your plan was only to test, cancel inside the restaurant's stated free-cancellation window.

This is a DP-driven method. It is safer to treat the deposit as money you may actually spend at the restaurant, not as guaranteed cash-out.

## Verified Toast Restaurants

Popular Resy restaurants using Toast (verify current status):

🍽️ **Carbone** (multiple locations)
🍽️ **Cote** (Korean BBQ)
🍽️ **Quality Italian**
🍽️ **Parm**
🍽️ **Dirty French**
🍽️ **ZZ's Clam Bar**

**How to Verify:**
- Visit restaurant website
- Look for online gift card purchasing
- Toast-powered sites have similar checkout flow
- You'll see "Powered by Toast" in footer or checkout

## Step-by-Step Example

**Example: Using $100 Quarterly Resy Credit (Amex Platinum)**

1. **Quarter starts** (Jan 1, Apr 1, Jul 1, Oct 1)
2. **Find restaurant** - Go to Carbone's website
3. **Click Gift Cards** - carbonerestaurant.com/gift-cards
4. **Enter amount** - $100 e-gift card
5. **Use Amex Platinum** - Pay with enrolled card
6. **Receive confirmation** - Email with gift card code
7. **Credit posts** - Check statement in 4-8 weeks
8. **Make reservation** - Book through Resy when ready
9. **Dine and redeem** - Use gift card at meal

## Which Cards Have Resy Credits?

**American Express Platinum Card**
- $100 Resy credit per half-year
- Jan-Jun: $100 credit
- Jul-Dec: $100 credit
- Total: $200/year

**American Express Gold Card**
- $50 Resy credit per half-year
- Jan-Jun: $50 credit
- Jul-Dec: $50 credit
- Total: $100/year

## Pro Tips

💡 **Buy exact credit amount** - $50 gift card for $50 credit
💡 **Use early in period** - Don't wait until last minute
💡 **Save for special occasions** - Gift cards don't expire
💡 **Combine with other credits** - Stack with dining category rewards
💡 **Check restaurant website** - Not all Resy restaurants use Toast
💡 **Call ahead** - Confirm they accept their own gift cards (rare issues)

## Alternative Ways to Use Resy Credit

**If you prefer traditional booking:**
1. **Book through Resy app** - Make reservation on Resy.com
2. **Dine at restaurant** - Use your Amex card to pay
3. **Credit posts** - If spending meets threshold
4. **Note**: Some cards require minimum spend per transaction

**Traditional method vs Gift Cards:**
- Traditional: Must dine to use credit
- Gift Cards: Purchase anytime, use later
- Gift Cards: More flexible timing
- Traditional: Better for immediate dining plans

## Important Notes

⚠️ **Check current terms** - Amex may update which purchases qualify
⚠️ **Keep receipts** - Save confirmation for records
⚠️ **Toast/Resy signal matters** - Toast gift cards and Resy deposits have the strongest community data points
⚠️ **Test small first** - Some Toast pages post under a restaurant group or sister restaurant and may fail
⚠️ **Expiration** - Use credit before period ends (typically 6 months)
⚠️ **One credit per period** - Can't stack multiple periods

## Troubleshooting

**Credit didn't post?**
- Wait full 8-12 weeks before inquiring
- Check that the restaurant is actually on Resy and the payment path has a Toast or Resy signal
- Verify you used correct Amex card
- Contact Amex if no credit after 12 weeks

**Restaurant doesn't accept gift cards?**
- Very rare but possible
- Call restaurant before purchasing
- Most Toast gift cards work seamlessly
- Ask about any restrictions`,
      tips: [
        'Many Resy restaurants use Toast - buy gift cards on their websites',
        'Purchase gift cards in amounts matching your credit ($50, $100)',
        'Credits post within 1-2 billing cycles after gift card purchase',
        'Gift cards don\'t expire - buy early in credit period, use later',
        'Look for "Powered by Toast" on restaurant websites',
        'Call restaurant to confirm they accept their own gift cards before buying'
      ]
    },
    {
      title: 'How to Use Amex Gold Dunkin Credit via Mobile Gift Card',
      slug: 'amex-gold-dunkin-credit',
      description: 'Load your Dunkin credit directly into the Dunkin mobile app as a gift card',
      category: 'Dining',
      content: `## The Mobile Gift Card Method

The **American Express Gold Card** offers a **$7 monthly Dunkin credit** that can be used by loading funds into the Dunkin mobile app:

- **Credit Amount**: $7 per month
- **How to Use**: Load Dunkin gift card in mobile app
- **Credit Posts**: Within 1-2 billing cycles
- **No Dunkin purchase required upfront**: Load first, credit posts, use later

## Step-by-Step Process

**1. Download Dunkin App**
- iOS: Download from App Store
- Android: Download from Google Play
- Create account or sign in
- Link DD Perks rewards (optional but recommended)

**2. Add Money to App**
- Open Dunkin app
- Tap "Scan" at bottom
- Tap "Manage" or "Add Value"
- Choose **$7 or more** to load
- Select your **Amex Gold Card** as payment method
- Complete transaction

**3. Wait for Credit**
- Charge appears on Amex statement as "Dunkin" purchase
- Amex credit posts within **1-2 billing cycles**
- You'll see "Dunkin Credit" on statement
- Net cost: $0 (after $7 credit)

**4. Use Your Balance**
- Visit any Dunkin location
- Order at counter or drive-thru
- Scan app barcode to pay
- Balance deducts from app wallet

## Alternative Method: Dunkin Gift Cards

**Physical/Digital Gift Cards:**
1. **Buy at Dunkin location** - Ask cashier to load $7 onto gift card
2. **Buy online** - DunkinDonuts.com gift cards (may not trigger credit)
3. **Use Amex Gold** - Pay with your card
4. **Credit posts** - Within 1-2 statements

**Note**: Loading the mobile app is easier and more reliable than buying separate gift cards.

## Maximizing Your $7 Monthly Credit

**Best Value Orders:**

☕ **Coffee + Snack** ($6-8)
- Medium hot/iced coffee
- Classic donut or munchkins
- Total: ~$6-7

🥯 **Breakfast Combo** ($7-8)
- Bagel with cream cheese
- Small coffee
- Total: ~$7

🥪 **Quick Lunch** ($7-8)
- Wake-up wrap or snack
- Medium drink
- Total: ~$7

💡 **Pro Strategy**: Load $20-30 at once, use throughout month
- Load $21 on day 1 (3 months worth)
- Credits post over 3 months: $7 + $7 + $7 = $21
- Net cost: $0
- Always have Dunkin balance ready

## Monthly Credit Reset

- **Resets**: 1st of each month
- **Doesn't roll over**: Use it or lose it
- **Set reminder**: Calendar alert for 25th of month
- **Can't stack**: Only $7 per month maximum

## DD Perks Integration

**Link Rewards Program:**
- Earn points on every purchase
- 10 points per $1 spent
- Free drink every 200 points
- Birthday reward
- **Stack with Amex credit**: Get credit + rewards points

**Example:**
- Load $7 with Amex Gold
- Get $7 Amex credit (net $0)
- Earn ~70 DD Perks points
- Build toward free drinks

## Important Requirements

✅ **Must use Amex Gold Card** - Other Amex cards don't qualify
✅ **Monthly credit only** - Resets on 1st of month
✅ **Load minimum $7** - Smaller amounts may not trigger credit
✅ **Use enrolled card** - The card you enrolled for benefits
✅ **Wait for credit** - Takes 1-2 billing cycles to post

## Common Questions

**Can I load more than $7?**
- Yes! Load any amount
- Only $7 credit posts per month
- Excess stays in app for future use

**Does it work at all Dunkin locations?**
- Yes, mobile app works nationwide
- Even airport and rest stop locations
- Works for drive-thru and in-store

**Can I use it for mobile orders?**
- Yes, order ahead in app
- Pay with app balance
- Skip the line, pick up order

**What if I don't use Dunkin?**
- Give app login to friend/family
- Let them use the $7 credit
- Or visit once a month for coffee

**Do I need to enroll?**
- Some cards require enrollment in Amex Offers
- Check your Amex app for "Dunkin" offer
- Click "Add to Card" if shown
- Not all accounts need explicit enrollment

## Tracking Your Credits

**Monthly Checklist:**
1. **Day 1-5**: Load $7 (or more) in Dunkin app
2. **Day 30-60**: Check statement for credit
3. **Anytime**: Use balance at Dunkin
4. **Repeat**: Every month

**Keep Records:**
- Screenshot app load receipt
- Save Amex statement showing credit
- Track in spreadsheet if managing multiple cards

## Alternative: Stack Multiple Cards

**If you have multiple Gold Cards:**
- Each card gets $7/month
- Load $7 from each card
- Multiple credits post separately
- Use combined balance for larger orders

**Example with 2 Gold Cards:**
- Load $7 from Card 1
- Load $7 from Card 2
- Total loaded: $14
- Total credits: $14 (after posting)
- Use $14 balance through month

## Troubleshooting

**Credit didn't post?**
- Wait 8-12 weeks (2-3 billing cycles)
- Verify you used Amex Gold Card
- Check if enrollment needed in Amex Offers
- Contact Amex if still missing

**App won't accept Amex?**
- Try different amount ($10 instead of $7)
- Use website: DunkinDonuts.com
- Contact Dunkin support
- Try again next day

**Already loaded $7, now what?**
- Just wait for credit to post
- Use your balance at Dunkin
- Next month, load $7 again
- Credits post retroactively`,
      tips: [
        'Load $7+ into Dunkin mobile app using your Amex Gold Card',
        'Credit posts within 1-2 billing cycles, but you can use balance immediately',
        'Set monthly reminder on the 1st to load your $7 credit',
        'Consider loading multiple months at once ($21 = 3 months)',
        'Link DD Perks rewards to earn points while using credit',
        'Monthly credit doesn\'t roll over - use it or lose it each month'
      ]
    },
    {
      title: 'How to Use DoorDash, Instacart, and Grocery Delivery Credits',
      slug: 'delivery-grocery-credits',
      description: 'Use food delivery and grocery credits without missing app, membership, or order-window rules',
      category: 'Dining',
      content: `## Start With the App

Delivery and grocery credits usually require the named app or service. Add the eligible card directly in the app before ordering.

## DoorDash

1. Add the eligible card to DoorDash.
2. Activate DashPass if the card includes it.
3. Place an eligible restaurant, grocery, or convenience order.
4. Use pickup when fees would erase the value.
5. Confirm the monthly or quarterly credit applied or posted.

## Instacart

1. Add the eligible card to Instacart.
2. Activate Instacart+ if your card includes it.
3. Place an eligible order before the monthly credit expires.
4. Watch for minimum order, delivery fee, and second-order rules.
5. Save the receipt until the credit posts.

## Practical Use

- Use credits for staples you would buy anyway.
- Combine small credits with pickup orders when available.
- Track each card separately if you have multiple Chase or cobranded credits.
- Check whether the credit applies at checkout or later as a statement credit.

## Avoid

- Letting a tiny monthly credit expire because delivery fees are too high
- Assuming every grocery or convenience order qualifies
- Forgetting to activate the included membership
- Using Apple Pay or a wallet that hides the eligible card from the app`,
      tips: [
        'Add the eligible card directly in the delivery app',
        'Pickup orders can preserve value when delivery fees are high',
        'Check membership activation before ordering',
        'Monthly credits usually do not roll over'
      ]
    },
    {
      title: 'How to Use Chase Fine Dining Credits',
      slug: 'chase-fine-dining-credit',
      description: 'Use Chase fine dining credits at eligible restaurants with clean payment and period tracking',
      category: 'Dining',
      content: `## Confirm Eligibility

Fine dining credits are not generic restaurant credits. Check the card benefit page for the eligible restaurant list, reservation channel, and semi-annual window.

## How to Use

1. Pick an eligible restaurant for the current benefit period.
2. Reserve through the required channel if the terms specify one.
3. Pay the restaurant charge with the card carrying the credit.
4. Keep the receipt and reservation confirmation.
5. Track the statement credit before the period ends.

## Practical Use

- Use the credit for a planned meal instead of trying to force a deposit.
- If the restaurant takes a prepaid deposit, confirm whether it is processed by the restaurant or a reservation platform.
- Keep each semi-annual window separate.

## Avoid

- Assuming any upscale restaurant qualifies
- Paying through an unsupported reservation or gift-card platform
- Relying on a cancelled reservation to preserve value
- Splitting payment in a way that makes the charge hard to track`,
      tips: [
        'Verify eligible restaurants before booking',
        'Use the card carrying the benefit at the restaurant',
        'Track each semi-annual window separately',
        'Keep reservation and payment receipts'
      ]
    },
    {
      title: 'How to Use Saks Credits',
      slug: 'saks-credit',
      description: 'Use Saks credits cleanly across semi-annual windows',
      category: 'Shopping',
      content: `## Before You Buy

1. Enroll the Saks benefit in your card account if required.
2. Confirm the current window, usually Jan-Jun or Jul-Dec.
3. Shop directly with Saks Fifth Avenue or Saks.com.
4. Pay with the eligible card.
5. Save the receipt until the credit posts.

## Practical Use

- Use in-store checkout when you want the cleanest merchant coding.
- In-store Saks gift cards have recurring positive community data points, but this is not an issuer-published guarantee.
- Online eGift cards are widely treated as a bad path; buy merchandise online instead if you cannot visit a store.
- Wait for a Rakuten or shopping-portal boost when buying merchandise directly.
- Online purchases can work, but shipping, returns, and delayed posting can complicate period-end usage.
- Buy early in the window so a replacement order is possible if something cancels.

## Avoid

- Saks OFF 5TH unless your terms explicitly include it
- Marketplace or third-party gift-card sellers
- Saks online eGift cards
- Returns that reverse the statement credit
- Orders placed so late that the charge posts after the window closes`,
      tips: [
        'Enroll first if the card requires it',
        'Use Saks Fifth Avenue or Saks.com directly',
        'In-store gift cards have better data points than online eGift cards',
        'Buy early in the semi-annual window',
        'Avoid returns until the credit is final'
      ]
    },
    {
      title: 'How to Use Lululemon Credits',
      slug: 'lululemon-credit',
      description: 'Use quarterly Lululemon credits with direct checkout and period-aware tracking',
      category: 'Shopping',
      content: `## How to Use

1. Check the quarterly credit amount and dates.
2. Shop directly with Lululemon online or in store.
3. Use the eligible card at checkout.
4. Keep the receipt until the credit posts.
5. Mark the benefit complete only after the charge is final.

## Practical Use

- In-store purchases are usually the cleanest path.
- Nitan data points distinguish gift-card paths: in-store gift cards and online physical gift cards have worked, while online eGift cards are commonly reported as not reimbursing.
- If buying a gift card, make a small test early in the quarter before buying the full credit amount.
- Use the credit early enough to handle returns, out-of-stock cancellations, or delayed posting.

## Avoid

- Marketplace checkout
- Online eGift cards unless fresh data points say otherwise
- Relying on gift-card behavior without checking current terms
- Letting the charge post after quarter-end
- Returning items before the credit is settled`,
      tips: [
        'Use direct Lululemon checkout',
        'Quarter-end posting date matters',
        'In-store GC and online physical GC have better data points than eGift cards',
        'Keep receipts until the credit posts'
      ]
    },
    {
      title: 'How to Use Citi Splurge Credits',
      slug: 'citi-splurge-credit',
      description: 'Use Citi Splurge credits by choosing an eligible brand and keeping the purchase simple',
      category: 'Shopping',
      content: `## Choose the Merchant First

Citi Splurge credits depend on the selected eligible brands for your card. Check the current merchant list before making a purchase.

## How to Use

1. Open the Citi benefit page and confirm eligible brands.
2. Enroll or choose merchants if Citi requires selection.
3. Buy directly from the eligible merchant.
4. Pay with the Citi card carrying the credit.
5. Track the credit and keep receipts.

## Practical Use

- Use the credit for a real purchase at an eligible brand.
- Avoid assuming gift cards, third-party checkout, or marketplace purchases qualify.
- Leave time before year-end for the credit to post.

## Avoid

- Buying from a related but ineligible brand
- Using PayPal or marketplace checkout if terms require direct merchant billing
- Returning the purchase before the credit is final
- Waiting until the final days of the benefit year`,
      tips: [
        'Confirm the current eligible Splurge brands',
        'Enroll or select merchants if required',
        'Prefer direct merchant checkout',
        'Use before year-end posting risk becomes an issue'
      ]
    },
    {
      title: 'How to Use StubHub Credits',
      slug: 'stubhub-credit',
      description: 'Use event-ticket credits through StubHub or the named ticket platform',
      category: 'Entertainment',
      content: `## How to Use

1. Confirm the eligible ticket platform and benefit window.
2. Buy tickets directly through StubHub or the named platform.
3. Pay with the eligible card.
4. Save the order confirmation.
5. Track the statement credit after the charge posts.

## Practical Use

- Use the credit for an event you actually plan to attend or transfer.
- Keep the platform account and cardholder account easy to reconcile.
- Buy early enough to fix a failed trigger before the period closes.

## Avoid

- Counting on event cancellation behavior
- Buying through a different ticket marketplace
- Using wallet checkout that does not pass the eligible card cleanly
- Resale activity that violates platform or issuer terms`,
      tips: [
        'Buy directly through the named ticket platform',
        'Use the eligible card at checkout',
        'Keep the event confirmation',
        'Do not depend on cancelled-event behavior'
      ]
    },
    {
      title: 'How to Use Uber One Credits',
      slug: 'uber-one-credit',
      description: 'Track Uber One membership reimbursements and renewal timing',
      category: 'Membership',
      content: `## Setup

1. Add the eligible card to Uber.
2. Subscribe to the eligible Uber One plan.
3. Confirm monthly or annual billing cadence.
4. Keep the eligible card as the payment method.
5. Track renewal and cancellation dates.

## Practical Use

- Use Uber One if you already use Uber rides or Uber Eats enough to benefit.
- If the card reimburses annual billing, set a reminder before renewal.
- Watch whether promos, partial refunds, or plan changes alter the final reimbursed amount.

## Avoid

- Paying through app-store billing if terms require direct Uber billing
- Switching payment cards before the membership charge posts
- Forgetting an annual renewal date
- Assuming a refunded membership will keep the statement credit`,
      tips: [
        'Bill Uber One directly to the eligible card',
        'Record annual renewal dates',
        'Avoid app-store billing unless terms allow it',
        'Plan changes and refunds can affect reimbursement'
      ]
    },
    {
      title: 'How to Use CLEAR Credits',
      slug: 'clear-credit',
      description: 'Use CLEAR Plus credits for membership charges and renewal tracking',
      category: 'Membership',
      content: `## Setup

1. Sign up or renew directly with CLEAR.
2. Use the eligible card for the membership charge.
3. Check whether family add-ons or discounted rates change the reimbursed amount.
4. Keep the confirmation email.
5. Track the renewal date in Perks Reminder.

## Practical Use

- Use a promo code only if it still leaves a clean eligible CLEAR charge.
- If multiple cards have CLEAR credits, keep each membership or renewal charge easy to match.
- Check the statement after renewal because annual credits can post later than monthly app credits.

## Avoid

- Paying through an unrelated third-party bundle
- Assuming every family add-on is fully reimbursed
- Forgetting renewal timing
- Cancelling immediately after reimbursement and assuming no adjustment`,
      tips: [
        'Pay CLEAR directly with the eligible card',
        'Record the renewal date',
        'Check family add-on eligibility',
        'Keep the membership confirmation'
      ]
    },
    {
      title: 'How to Use Oura Ring Credits',
      slug: 'oura-credit',
      description: 'Use Oura hardware credits with straightforward checkout and receipt tracking',
      category: 'Shopping',
      content: `## How to Use

1. Confirm the eligible Oura product and credit amount.
2. Buy directly from Oura unless your card terms say another channel qualifies.
3. Pay with the card carrying the benefit.
4. Keep the order confirmation and shipping confirmation.
5. Track the statement credit after the charge posts.

## Practical Use

- Keep checkout simple: one eligible product, one eligible card.
- If the order total exceeds the credit, expect only the capped amount back.
- Avoid changing payment after order review unless support confirms the charge will remain eligible.

## Avoid

- Marketplace checkout
- Split payments that make the eligible charge unclear
- Returns before the credit is final
- Buying accessories only if the terms require a ring purchase`,
      tips: [
        'Buy directly from Oura when possible',
        'Use a single eligible card at checkout',
        'Keep order and shipping confirmations',
        'Avoid payment changes after checkout'
      ]
    },
    {
      title: 'How to Use Blacklane Credits',
      slug: 'blacklane-credit',
      description: 'Use Blacklane transportation credits with direct booking and date-window tracking',
      category: 'Transportation',
      content: `## How to Use

1. Book directly through Blacklane.
2. Add the eligible card as the payment method.
3. Check the semi-annual or annual window before scheduling.
4. Complete the ride and keep the receipt.
5. Track the statement credit after the charge posts.

## Practical Use

- Use the credit for airport transfers or planned car service.
- Confirm local availability before relying on it for a trip.
- If the ride is near the end of a window, make sure the charge posts in time.

## Avoid

- Third-party travel agency bookings
- Cancelling and assuming the credit remains
- Using a different saved payment card
- Booking where Blacklane does not have reliable local coverage`,
      tips: [
        'Book directly with Blacklane',
        'Use the eligible card as payment',
        'Confirm service availability before travel',
        'Watch semi-annual posting windows'
      ]
    },
    {
      title: 'How to Use Southwest Travel Credits',
      slug: 'southwest-travel-credit',
      description: 'Use Southwest annual travel credits for real Southwest charges and clean tracking',
      category: 'Travel',
      content: `## How to Use

1. Book or purchase directly with Southwest.
2. Use the card carrying the annual Southwest travel credit.
3. Keep the confirmation number and receipt.
4. Track the credit after the charge posts.
5. Use the credit before the benefit year closes.

## Practical Use

- Apply it toward airfare, taxes, fees, or eligible Southwest charges according to the card terms.
- If a booking creates Southwest travel funds, track their expiration separately.
- Keep the original confirmation because Southwest credits and travel funds can be easy to mix up.

## Avoid

- Assuming travel funds never expire
- Booking through an OTA
- Using a different Southwest card than the one with the credit
- Waiting until the last day of the benefit year`,
      tips: [
        'Book directly with Southwest',
        'Track any resulting travel-fund expiration separately',
        'Keep confirmation numbers',
        'Use before the annual window closes'
      ]
    },
    {
      title: 'How to Use Shopping Credits',
      slug: 'shopping-credits',
      description: 'Use merchant credits such as Saks, Lululemon, and select splurge brands without missing enrollment or period rules',
      category: 'Shopping',
      content: `## Before You Buy

1. **Confirm the eligible merchant list** in your card account before each period
2. **Enroll if required** so the charge is tracked correctly
3. **Use the exact card** that carries the credit
4. **Leave posting time** before the semi-annual or quarterly window ends

## Practical Patterns

- Shop directly with the merchant rather than marketplaces or resellers
- For Saks-style credits, in-store purchases are often more predictable than edge-case online gift card flows
- For Lululemon-style credits, online gift card behavior can change quickly, so verify current terms before relying on it
- Keep receipts until the credit posts

## Common Failure Cases

- Purchase posts after the benefit window closes
- Gift card or third-party checkout stops coding as expected
- Returns or cancellations can reverse credits
- Multiple cards or split payments can make tracking harder`,
      tips: [
        'Check enrollment and eligible merchants before each benefit period',
        'Prefer direct merchant checkout',
        'Use early in the period so late posting does not waste the credit',
        'Save receipts until the statement credit posts'
      ]
    },
    {
      title: 'How to Use Business Service Credits',
      slug: 'business-service-credits',
      description: 'Redeem Dell, Adobe, wireless, Indeed, shipping, office supply, and similar business credits cleanly',
      category: 'Business Services',
      content: `## Basic Flow

1. **Enroll the benefit** if your issuer requires activation
2. **Buy directly from the eligible merchant or category**
3. **Avoid changing the order after purchase** unless the merchant clearly supports it
4. **Track statement posting** and reconcile partial credits

## Payment Flow Notes

Split-payment quirks, order review, and payment update flows can make business credits harder to reconcile. The safer takeaway is simple: use normal checkout, keep the order easy to audit, and avoid relying on payment failures or unusual split-payment behavior.

## What To Watch

- Business credits may be annual, semi-annual, quarterly, or monthly
- Some credits require minimum spend or only reimburse after a threshold
- Wireless credits usually require the monthly bill to charge directly to the card
- Returns, price matches, and edited orders can delay or reverse credits`,
      tips: [
        'Enroll first, then buy directly from the merchant',
        'Keep checkout simple for Dell and similar merchant credits',
        'Use wireless credits for recurring bills charged directly to the card',
        'Reconcile partial credits against the benefit amount'
      ]
    },
    {
      title: 'How to Use Amex Business Gold Office Supply Credits via Gift Cards',
      slug: 'business-gold-office-supply-gift-cards',
      description: 'Use the monthly Amex Business Gold flexible business credit at office-supply merchants with practical gift-card caveats',
      category: 'Business Services',
      content: `## Best Repeatable Path

The Business Gold flexible business credit can reimburse eligible U.S. purchases at FedEx, Grubhub, and office-supply stores. Nitan data points repeatedly point to Staples or Office Depot/OfficeMax as the practical monthly path when you do not need FedEx or Grubhub.

## Office-Supply Runbook

1. Enroll the flexible business credit in Amex first.
2. Wait up to 24 hours after enrollment before testing.
3. Buy directly from an eligible U.S. office-supply merchant, such as Staples or Office Depot/OfficeMax.
4. Keep the card charge near the monthly credit amount when possible.
5. Save the receipt until the Amex credit posts.

## Gift-Card Playbook

- Store gift cards and third-party merchant gift cards have had positive community data points.
- Amazon or Target gift cards are commonly discussed because they preserve value better than random office supplies.
- Visa/Mastercard prepaid cards and other cash-equivalent products are explicitly riskier and can trigger level-3-data or cash-equivalent scrutiny.
- Online Staples eGift-card purchases have had positive data points, but test small after any terms or checkout change.

## What to Watch

- The benefit is monthly and does not roll over.
- Additional card purchases can count, but the account-level monthly cap still applies.
- Amex terms exclude prepaid cards and cash equivalents, so do not treat every gift-card path as equally safe.
- Odd activation-fee totals and large prepaid-card purchases are more likely to stand out than a small merchant gift card.

## Avoid

- Buying VGC/MGC as the default path
- Running large gift-card transactions before a small test posts
- Forgetting enrollment or buying immediately after enrollment
- Assuming a Reddit or Nitan DP means issuer terms cannot change`,
      tips: [
        'Enroll first and wait before testing',
        'Staples and Office Depot/OfficeMax are the practical office-supply paths',
        'Prefer merchant gift cards over prepaid cash-equivalent cards',
        'Keep receipts until the monthly credit posts'
      ]
    },
    {
      title: 'How to Use Entertainment Credits',
      slug: 'entertainment-credits',
      description: 'Set up streaming, digital entertainment, ticket, and event credits so they post reliably',
      category: 'Entertainment',
      content: `## Setup

1. **Check eligible services** in your card benefit terms
2. **Pay the service directly** with the eligible card
3. **Avoid app-store billing** unless the terms say it qualifies
4. **Monitor monthly caps** because entertainment credits often reset each month

## Event And Ticket Credits

For StubHub or other event credits, pay directly through the named platform and keep the confirmation. Avoid counting on cancelled-event behavior; it is variable and not a reliable product workflow.

## Monthly Credit Hygiene

- Put recurring subscriptions on the correct card
- Keep one small subscription per monthly credit when possible
- Check whether taxes or add-ons count toward the cap
- Revisit eligible services when issuers update benefit terms`,
      tips: [
        'Use direct billing with the eligible service',
        'Avoid app-store billing unless card terms explicitly allow it',
        'Check monthly caps before adding services',
        'Keep event-ticket confirmations until credit posts'
      ]
    },
    {
      title: 'How to Use Membership Credits',
      slug: 'membership-credits',
      description: 'Track memberships like CLEAR, Walmart+, Uber One, lounge passes, and similar account-based benefits',
      category: 'Membership',
      content: `## Setup

1. **Create or sign in to the membership account**
2. **Use the eligible card as the payment method**
3. **Match the membership name and billing cadence** to issuer requirements
4. **Store renewal dates** so you do not double-pay or miss cancellation windows

## Practical Notes

Promos, refunds, and account state can affect outcomes. For dependable tracking, treat membership credits as reimbursements for real membership charges and record renewal dates in Perks Reminder.

## Watch Outs

- Annual memberships may renew before you expect
- Some credits only cover a specific plan tier
- Family plans or add-ons may not be fully reimbursed
- Promotional gift cards or refunds can change net value`,
      tips: [
        'Use the eligible card as the saved payment method',
        'Record renewal dates and cancellation windows',
        'Confirm plan tier eligibility before upgrading',
        'Check whether family plans or add-ons are reimbursed'
      ]
    },
    {
      title: 'How to Use Security Screening Credits',
      slug: 'security-screening-credits',
      description: 'Redeem Global Entry, TSA PreCheck, NEXUS, or similar application-fee credits',
      category: 'Travel',
      content: `## Steps

1. **Apply through the official government or authorized program site**
2. **Pay the application fee with the eligible card**
3. **Keep the receipt and application confirmation**
4. **Wait for the statement credit**, usually within one or two billing cycles

## Timing

These credits usually reset every four to five years rather than annually. If you already have Global Entry or TSA PreCheck, use the credit for an authorized user, partner, family member, or renewal when eligible.

## Common Misses

- Paying with the wrong card
- Assuming every traveler in a household gets a separate credit
- Forgetting that renewals can take time
- Using a third-party application helper instead of the official fee path`,
      tips: [
        'Pay the official application fee with the eligible card',
        'Credits reset every four to five years, not annually',
        'You can often use the credit for someone else',
        'Avoid third-party application helper fees'
      ]
    },
    {
      title: 'Benefit Usage Checklist',
      slug: 'benefit-checklist',
      description: 'A generic checklist for certificates, passes, bonus points, companion fares, and non-cash perks',
      category: 'General',
      content: `## Checklist

1. **Confirm when the benefit becomes available**
2. **Record the expiration date** in Perks Reminder
3. **Read redemption restrictions** before planning around the value
4. **Use the benefit early enough** to recover from booking or posting issues

## Examples

- Free night certificates often have brand, property, or point-cap restrictions
- Companion fares usually require taxes and fees and may need a specific booking path
- Lounge or club passes can expire even if your card account remains open
- Anniversary points and bonus miles may post weeks after the account anniversary

## Practical Tracking

For benefits that do not reimburse a purchase, mark them complete when you redeem or confirm they posted. Keep certificate numbers, booking references, and pass expiration dates in the issuer or loyalty account where the benefit is managed.`,
      tips: [
        'Record expiration dates as soon as certificates or passes issue',
        'Check property, fare, and booking-channel restrictions',
        'Use early enough to handle booking changes',
        'Keep certificate numbers and booking references in the source account'
      ]
    }
  ] as const satisfies readonly StaticBenefitUsageWay[];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const usageWayBySlug: ReadonlyMap<string, StaticBenefitUsageWay> = new Map(
  benefitUsageWays.map((way) => [way.slug, way])
);

export function calculateAnnualBenefitValue(maxAmount: number | null | undefined, frequency: StaticBenefitFrequency): number {
  if (!maxAmount) return 0;

  switch (frequency) {
    case 'WEEKLY':
      return maxAmount * 52;
    case 'MONTHLY':
      return maxAmount * 12;
    case 'QUARTERLY':
      return maxAmount * 4;
    case 'YEARLY':
    case 'ONE_TIME':
    default:
      return maxAmount;
  }
}

export function getFrequencyLabel(frequency: StaticBenefitFrequency): string {
  switch (frequency) {
    case 'WEEKLY': return 'Weekly';
    case 'MONTHLY': return 'Monthly';
    case 'QUARTERLY': return 'Quarterly';
    case 'YEARLY': return 'Yearly';
    case 'ONE_TIME': return 'One-time';
    default: return '';
  }
}

export function getPublicStaticCards(): PublicStaticCard[] {
  return predefinedCardsData.map((card) => {
    const cardId = slugify(card.name);
    const benefits = card.benefits
      .map((benefit, index) => {
        const usageWaySlug = inferBenefitUsageWaySlug({
          category: benefit.category,
          description: benefit.description,
          cardName: card.name,
        });
        const usageWay = usageWayBySlug.get(usageWaySlug);

        return {
          ...benefit,
          id: cardId + '-benefit-' + (index + 1),
          usageWay: usageWay ? { slug: usageWay.slug, title: usageWay.title } : null,
        };
      })
      .sort((a, b) => (b.maxAmount ?? 0) - (a.maxAmount ?? 0));

    return {
      ...card,
      id: cardId,
      benefits,
      updatedAt: STATIC_CATALOG_UPDATED_AT,
    };
  }).sort((a, b) => a.issuer.localeCompare(b.issuer) || a.name.localeCompare(b.name));
}

export function getPublicStaticCardByName(name: string): PublicStaticCard | undefined {
  return getPublicStaticCards().find((card) => card.name === name);
}

export function getPublicStaticRelatedCards(card: PublicStaticCard, limit = 4): PublicStaticCard[] {
  return getPublicStaticCards()
    .filter((candidate) => candidate.issuer === card.issuer && candidate.name !== card.name)
    .slice(0, limit);
}

export function getStaticSearchSuggestions(): string[] {
  const suggestions = new Set<string>();
  const cards = getPublicStaticCards();

  cards.forEach((card) => {
    suggestions.add(card.issuer);
    card.benefits.forEach((benefit) => suggestions.add(benefit.category));
  });

  ['amex', 'travel', 'dining', 'business', 'uber', 'entertainment', 'credit', 'no annual fee', 'cashback', 'hotels', 'airlines', 'restaurants'].forEach((term) => suggestions.add(term));

  return Array.from(suggestions).sort();
}
