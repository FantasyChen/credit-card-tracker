import { PrismaClient, BenefitFrequency, CreditCard as PrismaCreditCard, PredefinedCard as PrismaPredefinedCard, BenefitCycleAlignment, LoyaltyProgramType } from '../src/generated/prisma'; // Adjust path if necessary

const prisma = new PrismaClient();

// Define the structure for benefit objects in the seed data
interface BenefitInput {
  category: string;
  description: string;
  percentage: number;
  maxAmount: number;
  frequency: BenefitFrequency;
  cycleAlignment?: BenefitCycleAlignment; // Optional
  fixedCycleStartMonth?: number;          // Optional, 1-12
  fixedCycleDurationMonths?: number;     // Optional
  occurrencesInCycle?: number;           // Optional, defaults to 1
}

async function main() {
  console.log(`Start seeding ...`);

  const predefinedCardsData: Array<Omit<PrismaPredefinedCard, 'id' | 'createdAt' | 'updatedAt'> & { benefits: BenefitInput[] }> = [
    {
      name: 'Chase Sapphire Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-sapphire-preferred.png',
      benefits: [
        {
          description: '$50 Annual Hotel Credit (Booked through Chase Travel)',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          // cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY (default)
        },
        {
          description: '$10 Monthly DoorDash Credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
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
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Dining Credit (e.g., Grubhub, Cheesecake Factory)',
          category: 'Dining',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$7 Monthly Dunkin Credit',
          category: 'Dining',
          maxAmount: 7,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$50 Resy Credit (Jan-Jun)',
          category: 'Dining',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Resy Credit (Jul-Dec)',
          category: 'Dining',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '10,000 Anniversary Bonus Miles',
          category: 'Bonus',
          maxAmount: 0, 
          frequency: BenefitFrequency.YEARLY,
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
          description: '$150 Semi-Annual Fine Dining Credit (Select Restaurants - Jan-Jun)',
          category: 'Dining',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$150 Semi-Annual Fine Dining Credit (Select Restaurants - Jul-Dec)',
          category: 'Dining',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$250 Hotel Credit (The Edit by Chase Properties - Jan-Jun)',
          category: 'Travel',
          maxAmount: 250,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$250 Hotel Credit (The Edit by Chase Properties - Jul-Dec)',
          category: 'Travel',
          maxAmount: 250,
          frequency: BenefitFrequency.YEARLY, // This specific credit occurs once a year in this window
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$150 Semi-Annual StubHub Credit (Event Tickets - Jan-Jun)',
          category: 'Entertainment',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$150 Semi-Annual StubHub Credit (Event Tickets - Jul-Dec)',
          category: 'Entertainment',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$10 Monthly DoorDash Credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Lyft Credit',
          category: 'Transportation',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$20.83 Monthly Apple Subscriptions (TV+ and Music)',
          category: 'Entertainment',
          maxAmount: 20.83,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: 'Points Boost: Up to 2¢ per point on select Chase Travel bookings',
          category: 'Travel',
          maxAmount: 0, // Value varies based on usage
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase Ink Business Preferred',
      issuer: 'Chase',
      annualFee: 95,
      imageUrl: '/images/cards/chase-ink-business-preferred.png',
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$15 Monthly Uber Cash ($35 in December)', 
          category: 'Travel',
          maxAmount: 15, 
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$20 Additional Uber Cash (December)', 
          category: 'Travel',
          maxAmount: 20,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED, // Specific to December
          fixedCycleStartMonth: 12, // December
          fixedCycleDurationMonths: 1, // For the month of December
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jan-Jun)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$50 Saks Fifth Avenue Credit (Jul-Dec)',
          category: 'Shopping',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        // NEW 2025 BENEFITS - Quarterly benefits split by quarter
        {
          description: '$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)',
          category: 'Dining',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Q1: Jan-Mar
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q2: Apr-Jun)',
          category: 'Dining',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 4, // April
          fixedCycleDurationMonths: 3, // Q2: Apr-Jun
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)',
          category: 'Dining',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 3, // Q3: Jul-Sep
        },
        {
          description: '$100 Quarterly Resy Dining Credit (Q4: Oct-Dec)',
          category: 'Dining',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 10, // October
          fixedCycleDurationMonths: 3, // Q4: Oct-Dec
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q1: Jan-Mar)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Q1: Jan-Mar
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q2: Apr-Jun)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 4, // April
          fixedCycleDurationMonths: 3, // Q2: Apr-Jun
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q3: Jul-Sep)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 3, // Q3: Jul-Sep
        },
        {
          description: '$75 Quarterly Lululemon Credit (Q4: Oct-Dec)',
          category: 'Shopping',
          maxAmount: 75,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 10, // October
          fixedCycleDurationMonths: 3, // Q4: Oct-Dec
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$25 Monthly Digital Entertainment Credit',
          category: 'Entertainment',
          maxAmount: 25,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$120 Annual Uber One Membership Credit',
          category: 'Membership',
          maxAmount: 120,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$200 Annual Oura Ring Credit',
          category: 'Wellness',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$12.95 Monthly Walmart+ Membership Credit',
          category: 'Membership',
          maxAmount: 12.95,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // NEW 2025 BENEFITS
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // July
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$1,150 Annual Dell Technologies Credit',
          category: 'Electronics',
          maxAmount: 1150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$250 Annual Adobe Credit (after $600 spend)',
          category: 'Software',
          maxAmount: 250,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // High-spending benefits for $250K+ annual spenders
        {
          description: '$1,200 Annual Amex Travel Flight Credit (High Spender Benefit)',
          category: 'Travel',
          maxAmount: 1200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$2,400 Annual One AP Statement Credit (High Spender Benefit)',
          category: 'Business Services',
          maxAmount: 2400,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        // NEW BENEFIT: Quarterly Hilton Credit
        {
          description: '$50 Quarterly Hilton Credit (Hilton properties)',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
          occurrencesInCycle: 1,
        },
        {
          description: '$90 Quarterly Indeed Credit (Job Postings)',
          category: 'Business Services',
          maxAmount: 90,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$10 Monthly Wireless Bill Credit',
          category: 'Business Services',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$12.95 Monthly Walmart+ Membership Credit',
          category: 'Membership',
          maxAmount: 12.95,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$50 Quarterly Flight Credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jan-Jun)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$200 Semi-Annual Hilton Resort Credit (Jul-Dec)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY, 
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$189 CLEAR Plus Credit',
          category: 'Travel',
          maxAmount: 189,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
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
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
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
          frequency: BenefitFrequency.QUARTERLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 Delta Stays Credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Resy Credit',
          category: 'Dining',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Travel',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$20 Monthly Resy Credit',
          category: 'Dining',
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Travel',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$25 Monthly Dining Credit',
          category: 'Dining',
          maxAmount: 25,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
      ],
    },
    {
      name: 'Chase United Explorer Card',
      issuer: 'Chase',
      annualFee: 150,
      imageUrl: '/images/cards/chase-united-explorer-card.png',
      benefits: [
        {
          description: '2 United Club one-time passes',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$50 United Hotels credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          occurrencesInCycle: 2,
        },
        {
          description: '$5 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 5,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '5,000-mile anniversary award flight credit',
          category: 'Bonus',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$150 Renowned Hotels credit',
          category: 'Travel',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$8 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 8,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$15 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 15,
          frequency: BenefitFrequency.MONTHLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Two EarlyBird Check-In credits per year',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '4 Upgraded Boardings per year',
          category: 'Travel',
          maxAmount: 120,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '2 EarlyBird Check-In credits per year',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$50 Travel Delay Credit (Per Qualifying Delay)',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.ONE_TIME,
          percentage: 0,
        },
        {
          description: '10,000 Annual Bonus Atmos Points',
          category: 'Bonus',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Global Companion Award (Annual)',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Rideshare Credit',
          category: 'Transportation',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart+ Credit (second order)',
          category: 'Grocery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$5 Monthly Lyft Credit (after 3 rides)',
          category: 'Transportation',
          maxAmount: 5,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$120 Security Screening Credit (Global Entry/TSA PreCheck, every 4.5 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 United travel credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$50 United Hotels credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          occurrencesInCycle: 2,
        },
        {
          description: '$5 Monthly rideshare credit',
          category: 'Travel',
          maxAmount: 5,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$50 Avis/Budget car rental credit',
          category: 'Travel',
          maxAmount: 50,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 JSX credit',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$10 Monthly Instacart credit',
          category: 'Food Delivery',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$25 FareLock credit',
          category: 'Travel',
          maxAmount: 25,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Annual Free Night Award (up to 85,000 points)',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$100 Hotel Credit (The Ritz-Carlton and St. Regis hotels)',
          category: 'Travel',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Priority Pass Select Membership',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Global Entry/TSA PreCheck Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '15 Elite Night Credits towards Marriott Bonvoy Elite status',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: 'Marriott Bonvoy Gold Elite Status (complimentary)',
          category: 'Travel',
          maxAmount: 0,
          frequency: BenefitFrequency.YEARLY,
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
          frequency: BenefitFrequency.QUARTERLY,
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
          frequency: BenefitFrequency.QUARTERLY,
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
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: 'Up to $200 Annual Splurge Credit℠ (select brands)',
          category: 'Shopping',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 12,
        },
        {
          description: 'Up to $100 Blacklane® Credit (Jan-Jun)',
          category: 'Transportation',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // Jan-Jun window
          fixedCycleDurationMonths: 6,
        },
        {
          description: 'Up to $100 Blacklane® Credit (Jul-Dec)',
          category: 'Transportation',
          maxAmount: 100,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7, // Jul-Dec window
          fixedCycleDurationMonths: 6,
        },
        {
          description: '4 Admirals Club® Citi Strata Elite℠ Passes (American Airlines)',
          category: 'Travel',
          maxAmount: 300, // Estimated value (~$75 per pass)
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // Calendar year
          fixedCycleDurationMonths: 12,
        },
        {
          description: 'Up to $120 Global Entry or TSA PreCheck® Application Fee Credit (every 4 years)',
          category: 'Travel',
          maxAmount: 120,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY,
          fixedCycleDurationMonths: 48, // 4 years
        },
      ],
    },
  ];

  // --- Upsert Logic (ensure benefits are deleted/recreated or updated properly) ---
  console.log('Starting upsert process...');
  for (const cardData of predefinedCardsData) {
    console.log(`Processing card: ${cardData.name}`);
    const existingCard = await prisma.predefinedCard.findUnique({
        where: { name: cardData.name },
        include: { benefits: true },
    });

    if (existingCard) {
        console.log(`Updating existing card: ${cardData.name}`);
        // Update card details
        await prisma.predefinedCard.update({
            where: { id: existingCard.id },
            data: {
                issuer: cardData.issuer,
                annualFee: cardData.annualFee,
                imageUrl: cardData.imageUrl,
            },
        });

        // Simple approach: Delete existing benefits and recreate them
        console.log(`Deleting ${existingCard.benefits.length} old benefits for ${cardData.name}`);
        await prisma.predefinedBenefit.deleteMany({
            where: { predefinedCardId: existingCard.id },
        });

        console.log(`Creating ${cardData.benefits.length} new benefits for ${cardData.name}`);
        if (cardData.benefits.length > 0) {
          await prisma.predefinedBenefit.createMany({
              data: cardData.benefits.map(benefit => ({
                  // Explicitly map all fields for PredefinedBenefit
                  predefinedCardId: existingCard.id,
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment, // Explicitly map
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth, // Explicitly map
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths, // Explicitly map
                  occurrencesInCycle: benefit.occurrencesInCycle,
              })),
          });
        }
    } else {
        console.log(`Creating new card: ${cardData.name}`);
        // Create card and benefits together
        await prisma.predefinedCard.create({
            data: {
              name: cardData.name,
              issuer: cardData.issuer,
              annualFee: cardData.annualFee,
              imageUrl: cardData.imageUrl,
              benefits: {
                create: cardData.benefits.map(benefit => ({
                  // Ensure all fields are explicitly mapped here too for consistency
                  category: benefit.category,
                  description: benefit.description,
                  percentage: benefit.percentage,
                  maxAmount: benefit.maxAmount,
                  frequency: benefit.frequency,
                  cycleAlignment: benefit.cycleAlignment,
                  fixedCycleStartMonth: benefit.fixedCycleStartMonth,
                  fixedCycleDurationMonths: benefit.fixedCycleDurationMonths,
                  occurrencesInCycle: benefit.occurrencesInCycle,
                })),
              },
            },
        });
    }
     console.log(`Finished processing card: ${cardData.name}`);
  }
  console.log('Upsert process finished.');

  // === Seed Benefit Usage Ways ===
  console.log('Seeding benefit usage ways...');
  
  const usageWays = [
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
      description: 'Book hotels and get automatic statement credits',
      category: 'Travel',
      content: `## Booking Process

To receive your hotel credit:

1. **Book through the qualifying portal** - Requirements vary by card issuer
2. **Use your enrolled credit card** - Pay with the card that offers the benefit
3. **Credit posts after checkout** - Not at booking time, but after your stay completes

## Qualifying Booking Portals

**American Express:**
- Amex Travel portal
- Fine Hotels & Resorts program
- The Hotel Collection

**Chase:**
- Chase Travel Portal (Chase Ultimate Rewards)
- Direct hotel bookings (card-specific)

**Capital One:**
- Capital One Travel portal
- Direct hotel bookings

**Citi:**
- Citi Travel Portal
- Prestige Hotel Collection

## Important Requirements

- 💰 Some require minimum annual spend ($500-$1,000)
- ⏳ Credits may take 8-12 weeks to post
- 📋 Read your specific issuer's terms carefully
- 🏨 Must complete the stay (not just book)

## Maximizing Your Credit

**Booking Strategy:**
- Book early to ensure credit posts before year-end
- Combine with hotel loyalty programs
- Look for properties that double-dip (credit + points)
- Consider extended stays to meet minimum spend requirements

**Credit Timing:**
- Book at least 3 months before credit expiration
- Account for statement closing dates
- Contact issuer if credit doesn't post within timeframe

## Common Mistakes to Avoid

❌ Booking through third-party sites (Booking.com, Hotels.com)
❌ Using points instead of cash payment
❌ Cancelling before the stay is completed
❌ Not meeting minimum spend requirements`,
      tips: [
        'Book early to ensure credit posts before expiration',
        'Confirm you\'re using the correct booking platform',
        'Credits post AFTER checkout, not at booking',
        'Track your statement to verify the credit appears',
        'Some credits require minimum annual hotel spend'
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
- Monthly credit ($10-$15 typical)
- Includes DashPass subscription costs
- Can use for pickup orders too
- Must have DashPass membership

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
💡 **Check recent reports** - Airline policies change; verify on credit card forums
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
⚠️ **Toast required** - Regular online orders may not trigger credit
⚠️ **Expiration** - Use credit before period ends (typically 6 months)
⚠️ **One credit per period** - Can't stack multiple periods

## Troubleshooting

**Credit didn't post?**
- Wait full 8-12 weeks before inquiring
- Check that restaurant uses Toast platform
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
    }
  ];

  for (const way of usageWays) {
    await prisma.benefitUsageWay.upsert({
      where: { slug: way.slug },
      update: way,
      create: way,
    });
  }

  console.log(`✅ Seeded ${usageWays.length} benefit usage ways.`);

  // --- Seed Loyalty Programs (only ones with expiration) ---
  console.log('Seeding loyalty programs...');
  
  const loyaltyPrograms = [
    // Airlines (with expiration)
    {
      name: 'american_aadvantage',
      displayName: 'American Airlines AAdvantage',
      type: LoyaltyProgramType.AIRLINE,
      company: 'American Airlines',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.aa.com/aadvantage',
      description: 'Points expire 24 months after earning or redeeming activity'
    },
    {
      name: 'alaska_mileage_plan',
      displayName: 'Alaska Mileage Plan',
      type: LoyaltyProgramType.AIRLINE,
      company: 'Alaska Airlines',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.alaskaair.com/mileageplan',
      description: 'Miles expire 24 months after earning or redeeming activity'
    },

    // Hotels (with expiration)
    {
      name: 'marriott_bonvoy',
      displayName: 'Marriott Bonvoy',
      type: LoyaltyProgramType.HOTEL,
      company: 'Marriott International',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.marriott.com/bonvoy',
      description: 'Points expire 24 months after last qualifying activity'
    },
    {
      name: 'hilton_honors',
      displayName: 'Hilton Honors',
      type: LoyaltyProgramType.HOTEL,
      company: 'Hilton Worldwide',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.hilton.com/honors',
      description: 'Points expire 24 months after last earning or redemption activity'
    },
    {
      name: 'ihg_rewards',
      displayName: 'IHG One Rewards',
      type: LoyaltyProgramType.HOTEL,
      company: 'InterContinental Hotels Group',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://www.ihg.com/rewardsclub',
      description: 'Points expire 12 months after last qualifying activity'
    },
    {
      name: 'hyatt_world',
      displayName: 'World of Hyatt',
      type: LoyaltyProgramType.HOTEL,
      company: 'Hyatt Hotels Corporation',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.hyatt.com/world-of-hyatt',
      description: 'Points expire 24 months after last qualifying activity'
    },
    {
      name: 'choice_privileges',
      displayName: 'Choice Privileges',
      type: LoyaltyProgramType.HOTEL,
      company: 'Choice Hotels',
      expirationMonths: 18,
      hasExpiration: true,
      website: 'https://www.choicehotels.com/choice-privileges',
      description: 'Points expire 18 months after last qualifying activity'
    },
    {
      name: 'accor_live_limitless',
      displayName: 'Accor Live Limitless (ALL)',
      type: LoyaltyProgramType.HOTEL,
      company: 'Accor',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://all.accor.com',
      description: 'Points expire 12 months after last earning activity'
    },

    // Rental Cars (with expiration)
    {
      name: 'hertz_gold_plus_rewards',
      displayName: 'Hertz Gold Plus Rewards',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Hertz',
      expirationMonths: 12,
      hasExpiration: true,
      website: 'https://www.hertz.com/goldplusrewards',
      description: 'Points expire 12 months after last earning activity'
    },
    {
      name: 'enterprise_plus',
      displayName: 'Enterprise Plus',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Enterprise Rent-A-Car',
      expirationMonths: 36,
      hasExpiration: true,
      website: 'https://www.enterprise.com/plus',
      description: 'Points expire 36 months after last earning activity'
    },
    {
      name: 'avis_preferred',
      displayName: 'Avis Preferred',
      type: LoyaltyProgramType.RENTAL_CAR,
      company: 'Avis',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.avis.com/avispreferred',
      description: 'Points expire 24 months after last earning activity'
    },

    // Credit Cards (with expiration)
    {
      name: 'bank_of_america_rewards',
      displayName: 'Bank of America Travel Rewards',
      type: LoyaltyProgramType.CREDIT_CARD,
      company: 'Bank of America',
      expirationMonths: 24,
      hasExpiration: true,
      website: 'https://www.bankofamerica.com/credit-cards/rewards/',
      description: 'Points expire 24 months after earning'
    }
  ];

  for (const program of loyaltyPrograms) {
    await prisma.loyaltyProgram.upsert({
      where: { name: program.name },
      update: program,
      create: program,
    });
  }

  console.log(`✅ Seeded ${loyaltyPrograms.length} loyalty programs (only those with expiration)`);
  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 