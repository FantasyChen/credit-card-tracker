export type AmericanExpressCatalogFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
export type AmericanExpressCatalogCycleAlignment = "CARD_ANNIVERSARY" | "CALENDAR_FIXED";

interface AmericanExpressCatalogBenefit {
  productKey?: string;
  creditFamilyKey?: string;
  periodKey?: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: AmericanExpressCatalogFrequency;
  cycleAlignment?: AmericanExpressCatalogCycleAlignment;
  fixedCycleStartMonth?: number;
  fixedCycleDurationMonths?: number;
  occurrencesInCycle?: number;
}

interface AmericanExpressCatalogCard {
  productKey?: string;
  name: string;
  issuer: "American Express";
  annualFee: number;
  imageUrl: string | null;
  benefits: readonly AmericanExpressCatalogBenefit[];
}

// Shared DB-free source for the website catalog and the browser-side Amex
// supported-credit projection. Keep provider matching aliases outside this file.
export const americanExpressCardCatalog = {
  "American Express Gold Card": {
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
  "American Express Platinum Card": {
      productKey: 'american-express-platinum-card',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:resy',
          periodKey: 'calendar-quarter-q1',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:resy',
          periodKey: 'calendar-quarter-q2',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:resy',
          periodKey: 'calendar-quarter-q3',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:resy',
          periodKey: 'calendar-quarter-q4',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:lululemon',
          periodKey: 'calendar-quarter-q1',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:lululemon',
          periodKey: 'calendar-quarter-q2',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:lululemon',
          periodKey: 'calendar-quarter-q3',
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
          productKey: 'american-express-platinum-card',
          creditFamilyKey: 'american-express-platinum-card:lululemon',
          periodKey: 'calendar-quarter-q4',
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
  "American Express Business Platinum Card": {
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
  "American Express Business Gold Card": {
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
  "Hilton Honors American Express Aspire Card": {
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
  "Hilton Honors American Express Surpass Card": {
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
  "Hilton Honors American Express Business Card": {
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
  "Delta SkyMiles Gold American Express Card": {
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
  "Delta SkyMiles Platinum American Express Card": {
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
  "Delta SkyMiles Reserve American Express Card": {
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
  "Marriott Bonvoy Brilliant American Express Card": {
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
  "Marriott Bonvoy Business American Express Card": {
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
} as const satisfies Record<string, AmericanExpressCatalogCard>;
