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
      annualFee: 550,
      imageUrl: '/images/cards/chase-sapphire-reserve.jpg',
      benefits: [
        {
          description: '$300 Annual Travel Credit',
          category: 'Travel',
          maxAmount: 300,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
        },
        {
          description: '$5 Monthly DoorDash Credit',
          category: 'Food Delivery',
          maxAmount: 5,
          frequency: BenefitFrequency.MONTHLY,
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
      annualFee: 695,
      imageUrl: '/images/cards/american-express-platinum-card.png',
      benefits: [
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
        {
          description: '$20 Monthly Digital Entertainment Credit',
          category: 'Entertainment',
          maxAmount: 20,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$300 Equinox Credit (Annual or $25/month option)',
          category: 'Wellness',
          maxAmount: 300, 
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$13 Monthly Walmart+ Credit (Covers monthly membership cost)',
          category: 'Membership',
          maxAmount: 13, 
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$200 Annual Hotel Credit (FHR/THC prepaid bookings)',
          category: 'Travel',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$189 CLEAR Plus Credit (Annual Statement Credit)',
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
      name: 'American Express Business Platinum Card',
      issuer: 'American Express',
      annualFee: 695,
      imageUrl: '/images/cards/american-express-business-platinum-card.png',
      benefits: [
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
        {
          description: '$200 Dell Credit (Jan-Jun)',
          category: 'Electronics',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$200 Dell Credit (Jul-Dec)',
          category: 'Electronics',
          maxAmount: 200,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 7,
          fixedCycleDurationMonths: 6,
        },
        {
          description: '$25 Quarterly Hilton Credit',
          category: 'Travel',
          maxAmount: 25,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          occurrencesInCycle: 2,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$10 Monthly Wireless Credit',
          category: 'Utilities',
          maxAmount: 10,
          frequency: BenefitFrequency.MONTHLY,
          percentage: 0,
        },
        {
          description: '$90 Quarterly Indeed Credit',
          category: 'Business Services',
          maxAmount: 90,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 3, // Calendar quarters
        },
        {
          description: '$150 Annual Adobe Credit (select products)',
          category: 'Software',
          maxAmount: 150,
          frequency: BenefitFrequency.YEARLY,
          percentage: 0,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          fixedCycleStartMonth: 1, // January
          fixedCycleDurationMonths: 12, // Calendar year
        },
        {
          description: '$189 CLEAR Plus Credit',
          category: 'Travel',
          maxAmount: 189,
          frequency: BenefitFrequency.YEARLY,
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
          description: '$155 Annual Walmart+ Membership Credit (Covers annual membership cost)',
          category: 'Membership',
          maxAmount: 155,
          frequency: BenefitFrequency.YEARLY,
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
          description: '$25 Quarterly Hilton Credit',
          category: 'Travel',
          maxAmount: 25,
          frequency: BenefitFrequency.QUARTERLY,
          percentage: 0,
          occurrencesInCycle: 2,
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
      imageUrl: '/images/cards/alaska-airlines-visa-signature-credit-card.jpeg',
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