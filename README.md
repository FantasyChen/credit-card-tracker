This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, ensure all dependencies are installed:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

To create a production build, run:
```bash
npm run build
```
This command is now verified to work correctly after resolving initial linting and type errors.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## ESLint Configuration

This project uses ESLint with a flat configuration file (`eslint.config.mjs`). Prisma generated files located in `src/generated/**` are ignored by this configuration to prevent build failures due to linting issues in auto-generated code.

## Vercel Deployment Considerations

When deploying to Vercel, ensure the following:

1.  **Automatic Deployment:** Pushing changes to the main GitHub branch will automatically trigger a new production deployment on Vercel.
2.  **Environment Variables:**
    *   `GOOGLE_CLIENT_ID`: Your Google Cloud OAuth Client ID.
    *   `GOOGLE_CLIENT_SECRET`: Your Google Cloud OAuth Client Secret.
    *   `DATABASE_URL`: Connection string for your **production** PostgreSQL database (e.g., from Vercel Postgres, Neon, Supabase).
    *   `NEXTAUTH_URL`: Your production app URL (e.g., `https://coupon-cycle.site`).
    *   `NEXTAUTH_SECRET`: A strong, randomly generated secret for NextAuth.js.
    *   `CRON_SECRET`: A strong, randomly generated secret used to authorize requests to the cron job API endpoint (`/api/cron/check-benefits`).
3.  **Google OAuth Configuration:**
    *   In your Google Cloud Console, ensure `https://coupon-cycle.site` is an authorized JavaScript origin and `https://coupon-cycle.site/api/auth/callback/google` is an authorized redirect URI.
4.  **Prisma Query Engine:**
    *   The `prisma/schema.prisma` file has been configured with `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]` and `engineType = "library"` to ensure compatibility with Vercel's runtime environment. Regenerate the Prisma client (`npx prisma generate`) if you modify the schema.
5.  **Database Migrations:**
    *   Run `npx prisma migrate deploy` (or your project's equivalent) against your production database to ensure its schema is up-to-date.
6.  **Cron Job for Benefit Cycles:**
    *   A daily cron job is configured in `vercel.json` to call the `/api/cron/check-benefits` endpoint. This job proactively updates benefit statuses for all users.
    *   Ensure the `CRON_SECRET` environment variable is set in your Vercel project settings to authorize these cron job requests.

## Seed Data Criteria (Predefined Benefits)

The `prisma/seed.ts` file populates the database with predefined credit cards and their common benefits. The criteria for including a benefit in the seed data are as follows:

1.  **Cyclical Value:** The benefit must offer a specific value (e.g., statement credits, points, free nights, passes) that resets or is awarded on a fixed, trackable cycle (Monthly, Quarterly, Yearly). Examples: `$10 Monthly Uber Cash`, `$300 Annual Travel Credit`, `Annual Free Night Award`.
2.  **Exclude Always-On Perks:** General perks that are always active and don't have a specific value to track per cycle are excluded. Examples: points multipliers (like 5x on travel), general travel insurance, purchase protection, automatic elite status (like Gold/Platinum status), airport lounge access networks (unless it's a specific pass with an annual renewal like Priority Pass).
3.  **Distributed Benefits:** Benefits advertised annually but distributed more frequently (e.g., an annual $240 credit given as $20 per month) should be modeled according to their *distribution* frequency and value (e.g., `$20 Monthly Credit` with `MONTHLY` frequency).
4.  **Verification Source:** Benefit details should be verified against a reliable source, preferably [US Credit Card Guide](https://www.uscreditcardguide.com/).

This focus ensures the tracker helps users manage benefits they need to actively use within specific timeframes.

## Managing Card Images

This project includes a script to automatically search for and download credit card images using the SerpApi Google Images search.

### Prerequisites

1.  **SerpApi Account:** You need an API key from [serpapi.com](https://serpapi.com/).
2.  **Environment Variable:** Add your API key to the `.env` file in the project root:
    ```env
    SERPAPI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
    ```

### Usage

Run the script from the project root using Node.js, providing the card name with the `--name` (or `-n`) flag:

```bash
node scripts/download-card-image.js --name "Chase Sapphire Preferred"
# or
node scripts/download-card-image.js -n "American Express Gold Card"
```

The script will search for the card image, download the first medium-sized result, and save it to the `public/images/cards/` directory with a filename generated from the card name (e.g., `chase-sapphire-preferred.jpg`).

## Adding a New Credit Card

Follow these steps to add a new predefined credit card to the application:

1.  **Gather Card Information:**
    *   Find the exact card name, issuer, and current annual fee.
    *   Identify its cyclical benefits (monthly/quarterly/yearly credits, free nights, etc.), verifying amounts and frequencies against a reliable source like [US Credit Card Guide](https://www.uscreditcardguide.com/). Remember to adhere to the [Seed Data Criteria](#seed-data-criteria-predefined-benefits).

2.  **Download Card Image:**
    *   Run the image download script described in [Managing Card Images](#managing-card-images) using the exact card name.
    *   `node scripts/download-card-image.js --name "Your Card Name Here"`
    *   Verify the image was downloaded correctly to `public/images/cards/` and note the filename (e.g., `your-card-name-here.png`).

3.  **Update Seed File (`prisma/seed.ts`):**
    *   Open the `prisma/seed.ts` file.
    *   Add a new object entry to the `cards` array for the new card.
    *   Fill in the `name`, `issuer`, and `annualFee`.
    *   Set the `imageUrl` field to the correct path relative to the `public` directory (e.g., `/images/cards/your-card-name-here.png`).
    *   Define the `benefits` array, adding objects for each cyclical benefit identified in Step 1. Ensure `category`, `description`, `maxAmount`, and `frequency` are set correctly based on the established criteria.

4.  **Re-seed the Database:**
    *   Run the seed command to update the database with the new card and its benefits:
    ```bash
    npx prisma db seed
    ```

5.  **Commit Changes:**
    *   Commit the updated `prisma/seed.ts` file and the newly added image file in `public/images/cards/` to your version control system.
