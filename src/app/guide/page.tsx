import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Credit Card Benefits Guide - How to Maximize Your Rewards",
  description: "Complete guide to tracking credit card benefits, maximizing annual fee ROI, and never missing expiring perks. Tips for Chase, Amex, Capital One, and all major issuers.",
  keywords: [
    "credit card benefits guide",
    "how to maximize credit card rewards",
    "credit card annual fee worth it",
    "tracking credit card perks",
    "Chase Sapphire benefits guide",
    "Amex Platinum benefits guide",
    "Capital One Venture benefits",
    "credit card ROI calculator",
    "travel credit optimization",
    "dining credit tracker"
  ],
  alternates: {
    canonical: '/guide',
  },
};

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="prose prose-lg max-w-none">
        <h1>Complete Guide to Maximizing Credit Card Benefits</h1>
        
        <p className="lead">
          Learn how to track, optimize, and maximize your credit card rewards to ensure you never miss valuable benefits again. 
          This comprehensive guide covers strategies for all major credit card issuers.
        </p>

        <h2>Why Credit Card Benefit Tracking Matters</h2>
        <p>
          The average credit card user loses $300-600 annually by forgetting to use benefits that expire. 
          Premium cards like Chase Sapphire Reserve ($550 annual fee) and Amex Platinum ($695 annual fee) 
          offer thousands of dollars in annual benefits, but only if you actually use them.
        </p>

        <h2>Understanding Credit Card Benefit Cycles</h2>
        <p>
          Most credit card benefits operate on annual cycles that reset on your card&apos;s anniversary date. 
          Key benefit types include:
        </p>
        
        <ul>
          <li><strong>Travel Credits:</strong> Annual airline, hotel, or general travel credits</li>
          <li><strong>Dining Credits:</strong> Monthly or annual restaurant and delivery credits</li>
          <li><strong>Ride Share Credits:</strong> Uber, Lyft, or general transportation credits</li>
          <li><strong>Lounge Access:</strong> Priority Pass, Centurion Lounge, and airline lounges</li>
          <li><strong>Statement Credits:</strong> Various merchant-specific credits</li>
        </ul>

        <h2>Top Credit Cards and Their Benefits</h2>
        
        <h3>Chase Sapphire Reserve</h3>
        <ul>
          <li>$300 annual travel credit</li>
          <li>Priority Pass Select membership</li>
          <li>$5 monthly DoorDash credit</li>
          <li>3x points on dining and travel</li>
        </ul>

        <h3>American Express Platinum</h3>
        <ul>
          <li>$200 annual airline fee credit</li>
          <li>$200 annual hotel credit</li>
          <li>$240 annual digital entertainment credit</li>
          <li>Centurion Lounge access</li>
          <li>$15 monthly Uber credit</li>
        </ul>

        <h3>Capital One Venture X</h3>
        <ul>
          <li>$300 annual travel credit</li>
          <li>10,000 bonus miles on anniversary</li>
          <li>Priority Pass Select membership</li>
          <li>2x miles on all purchases</li>
        </ul>

        <h2>How to Calculate Your Credit Card ROI</h2>
        <p>
          To determine if your annual fee is worth it, calculate your return on investment:
        </p>
        
        <ol>
          <li>List all benefits you actually use and their cash value</li>
          <li>Add any cash back or points value you earn</li>
          <li>Subtract the annual fee</li>
          <li>Divide by the annual fee to get your ROI percentage</li>
        </ol>

        <p>
          <strong>Example:</strong> If you use $800 worth of benefits and earn $200 in cash back on a $550 annual fee card, 
          your net value is $450, giving you an 82% ROI.
        </p>

        <h2>Best Practices for Benefit Tracking</h2>
        
        <h3>1. Set Up Automated Tracking</h3>
        <p>
          Use tools like CouponCycle to automatically track your benefit cycles and get notifications 
          before benefits expire. Manual tracking often leads to missed opportunities.
        </p>

        <h3>2. Calendar Your Benefits</h3>
        <p>
          Add benefit expiration dates to your calendar with reminders set 30 days before expiration. 
          This gives you time to plan usage.
        </p>

        <h3>3. Track Usage Throughout the Year</h3>
        <p>
          Don&apos;t wait until the end of the year to use benefits. Plan ahead and use credits consistently 
          throughout your benefit cycle.
        </p>

        <h3>4. Understand Benefit Categories</h3>
        <p>
          Some benefits are more flexible than others. Travel credits often have broad usage, 
          while dining credits may be limited to specific merchants.
        </p>

        <h2>Common Mistakes to Avoid</h2>
        
        <ul>
          <li><strong>Forgetting to Use Credits:</strong> Set reminders and track usage regularly</li>
          <li><strong>Not Understanding Terms:</strong> Read the fine print on benefit usage</li>
          <li><strong>Overpaying Annual Fees:</strong> Calculate ROI before keeping expensive cards</li>
          <li><strong>Ignoring Lesser-Known Benefits:</strong> Many cards offer hidden perks</li>
        </ul>

        <h2>Advanced Strategies</h2>
        
        <h3>Credit Card Churning</h3>
        <p>
          For experienced users, opening and closing cards strategically can maximize sign-up bonuses 
          and benefits while minimizing annual fees.
        </p>

        <h3>Product Changes</h3>
        <p>
          Many issuers allow downgrading to no-fee versions when benefits no longer justify the cost. 
          This preserves your credit history while reducing fees.
        </p>

        <h3>Multiple Cards Strategy</h3>
        <p>
          Having multiple cards can maximize benefits across different categories, but requires 
          careful tracking to ensure you&apos;re getting value from each card.
        </p>

        <h2>Getting Started</h2>
        <p>
          Ready to maximize your credit card benefits? Start by:
        </p>
        
        <ol>
          <li>Listing all your current credit cards and their benefits</li>
          <li>Setting up a tracking system (like CouponCycle)</li>
          <li>Calculating the ROI for each card</li>
          <li>Setting up reminders for benefit expirations</li>
          <li>Creating a plan to use benefits throughout the year</li>
        </ol>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3>Start Tracking Your Benefits Today</h3>
          <p>
            CouponCycle makes it easy to track all your credit card benefits in one place. 
            Get smart notifications, calculate ROI, and never miss a valuable benefit again.
          </p>
          <Link 
            href="/api/auth/signin" 
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </article>
    </div>
  );
}
