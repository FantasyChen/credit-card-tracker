import { getJson } from "serpapi";
import axios from "axios";
import fs from "fs";
import path from "path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";

// Determine the directory name in an ES module context
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Load .env file variables

const API_KEY = process.env.SERPAPI_API_KEY;
const OUTPUT_DIR = path.resolve(__dirname, "../public/images/cards");
const USE_YOUR_CREDITS_BASE = "https://useyourcredits.com/cards/";

// --- Card name to UseYourCredits.com slug mapping ---
// This maps our card names to the slug used on useyourcredits.com
const USEYOURCREDITS_SLUGS = {
  // American Express
  "American Express Business Gold Card": "american-express-business-gold-card",
  "American Express Business Platinum Card": "american-express-business-platinum-card",
  "American Express Gold Card": "american-express-gold-card",
  "American Express Platinum Card": "american-express-platinum-card",
  "Delta SkyMiles Gold American Express Card": "american-express-delta-skymiles-gold-card",
  "Delta SkyMiles Platinum American Express Card": "american-express-delta-skymiles-platinum-card",
  "Delta SkyMiles Reserve American Express Card": "american-express-delta-skymiles-reserve-card",
  "Hilton Honors American Express Aspire Card": "american-express-hilton-aspire-card",
  "Hilton Honors American Express Business Card": "american-express-hilton-honors-business-card",
  "Hilton Honors American Express Surpass Card": "american-express-hilton-honors-surpass-card",
  "Marriott Bonvoy Brilliant American Express Card": "american-express-marriott-bonvoy-brilliant-card",
  "Marriott Bonvoy Business American Express Card": "american-express-marriott-bonvoy-business-card",
  
  // Bank of America / Atmos
  "Alaska Airlines Visa Signature credit card": "bank-of-america-spirit-airlines-free-spirit-card", // No direct match, fallback
  "Atmos Rewards Ascent Visa Signature Card": "bank-of-america-atmos-rewards-ascent-card",
  "Atmos Rewards Summit Visa Infinite Card": "bank-of-america-atmos-rewards-summit-visa-infinite-card",
  "Atmos Rewards Visa Business Card": "bank-of-america-atmos-rewards-visa-signature-business-card",
  
  // Capital One
  "Capital One Venture X": "capital-one-venture-x-card",
  
  // Chase
  "Chase Freedom Flex": "chase-freedom-flex-card",
  "Chase Ink Business Preferred": "chase-ink-business-preferred-card",
  "Chase Sapphire Preferred": "chase-sapphire-preferred-card",
  "Chase Sapphire Reserve": "chase-sapphire-reserve-card",
  "Chase Southwest Rapid Rewards Plus Card": "chase-southwest-rapid-rewards-plus-card",
  "Southwest Rapid Rewards Premier Credit Card": "chase-southwest-rapid-rewards-premier-card",
  "Southwest Rapid Rewards Priority Credit Card": "chase-southwest-rapid-rewards-priority-card",
  "Chase United Business Card": "chase-united-business-card",
  "Chase United Explorer Card": "chase-united-explorer-card",
  "Chase United Quest Card": "chase-the-new-united-quest-card",
  "Marriott Bonvoy Boundless Credit Card": "chase-marriott-bonvoy-boundless-card",
  "IHG One Rewards Premier Credit Card": "chase-ihg-one-rewards-premier-card",
  "IHG One Rewards Premier Business Credit Card": "chase-ihg-business-card",
  "The Ritz-Carlton Credit Card": "chase-ritz-carlton-visa-card",
  
  // Citi
  "Citi Strata Elite": "citi-strata-elite-card",
  
  // Discover
  "Discover it Cash Back": "discover-it-cash-back-credit-card",
};

// --- Helper Functions ---

// Simple slugify function to create safe filenames
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

// Ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

// Validate if URL looks like an image and contains relevant card info
function isValidImageUrl(url, cardName) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const fullUrl = urlObj.href.toLowerCase();
    
    // Check if it ends with common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
    
    // Exclude common non-image patterns
    const invalidPatterns = ['/404', '/error', 'placeholder', 'fallback', 'logo', 'icon'];
    const hasInvalidPattern = invalidPatterns.some(pattern => 
      fullUrl.includes(pattern.toLowerCase())
    );
    
    // Avoid URLs that typically have multiple cards stacked or comparison images
    const multiCardPatterns = [
      'comparison', 'compare', 'vs', 'best-', 'top-', 'lineup', 
      'collection', 'stack', 'family', 'portfolio', 'all-cards',
      'uscreditcardguide', 'nerdwallet', 'creditcards.com', 'wallethub',
      'bankrate', 'forbes', 'cnbc', 'usnews', 'upgrade', 'review'
    ];
    const hasMultiCardPattern = multiCardPatterns.some(pattern => 
      fullUrl.includes(pattern.toLowerCase())
    );
    
    // Extract key words from card name for validation
    const cardWords = cardName.toLowerCase().split(' ').filter(word => 
      word.length > 2 && !['card', 'credit', 'visa', 'mastercard', 'american', 'express'].includes(word)
    );
    
    // Check if URL contains relevant card-specific terms
    const hasRelevantTerms = cardWords.some(word => fullUrl.includes(word));
    
    // Prefer certain domains known to have official card images
    const preferredDomains = [
      'americanexpress.com', 'chase.com', 'capitalone.com', 'citi.com', 
      'discover.com', 'bankofamerica.com', 'hilton.com', 'marriott.com',
      'delta.com', 'united.com', 'southwest.com', 'alaskaair.com',
      'ihg.com', 'hyatt.com', 'atmosrewards.com', 'hsbc.com'
    ];
    const isPreferredDomain = preferredDomains.some(domain => urlObj.hostname.includes(domain));
    
    // Prefer URLs that look like official product/card images
    const productImagePatterns = ['product', 'card-art', 'card_art', 'cardart', 'card-image', 'card_image'];
    const isProductImage = productImagePatterns.some(pattern => fullUrl.includes(pattern));
    
    // Avoid generic or misleading URLs
    const avoidPatterns = ['freedom-unlimited', 'freedom_unlimited'];
    if (cardName.toLowerCase().includes('freedom flex')) {
      const hasAvoidPattern = avoidPatterns.some(pattern => fullUrl.includes(pattern));
      if (hasAvoidPattern) return { isValid: false, isPreferred: false, extension: '.jpg' };
    }
    
    return {
      isValid: hasImageExtension && !hasInvalidPattern && !hasMultiCardPattern,
      isPreferred: isPreferredDomain,
      isProductImage: isProductImage,
      hasRelevantTerms: hasRelevantTerms,
      extension: imageExtensions.find(ext => pathname.endsWith(ext)) || '.jpg'
    };
  } catch (e) {
    return { isValid: false, isPreferred: false, isProductImage: false, hasRelevantTerms: false, extension: '.jpg' };
  }
}

// Validate downloaded content
async function isValidImageContent(filepath) {
  try {
    const stats = await fs.promises.stat(filepath);
    
    // Check file size - too small likely means error page
    if (stats.size < 1000) {
      return false;
    }
    
    // Read first few bytes to check for image headers
    const buffer = Buffer.alloc(20);
    const fileHandle = await fs.promises.open(filepath, 'r');
    await fileHandle.read(buffer, 0, 20, 0);
    await fileHandle.close();
    
    // Check for image magic numbers
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isGIF = buffer.toString('ascii', 0, 3) === 'GIF';
    const isWebP = buffer.toString('ascii', 8, 12) === 'WEBP';
    
    // Check for HTML content (common in error pages)
    const content = buffer.toString('ascii').toLowerCase();
    const isHTML = content.includes('<html') || content.includes('<!doctype');
    
    return (isPNG || isJPEG || isGIF || isWebP) && !isHTML;
  } catch (error) {
    console.warn(`Could not validate image content: ${error.message}`);
    return false;
  }
}

// Download image from URL with better error handling
async function downloadImage(url, filepath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Check content type
    const contentType = response.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Ensure the directory exists before writing
    await ensureDirectoryExists(path.dirname(filepath));

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        // Validate the downloaded content
        if (await isValidImageContent(filepath)) {
          resolve();
        } else {
          // Delete invalid file
          try {
            await fs.promises.unlink(filepath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(new Error('Downloaded content is not a valid image'));
        }
      });
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    throw error;
  }
}

// --- Main Script Logic ---

async function main() {
  if (!API_KEY) {
    console.error(
      "Error: SERPAPI_API_KEY not found. Make sure it's set in your .env file."
    );
    process.exit(1);
  }

  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option("name", {
      alias: "n",
      description: "The name of the credit card",
      type: "string",
      demandOption: true, // Make the name argument required
    })
    .option("max-attempts", {
      alias: "m",
      description: "Maximum number of search results to try",
      type: "number",
      default: 5,
    })
    .option("list", {
      alias: "l",
      description: "List available image URLs without downloading (for manual selection)",
      type: "boolean",
      default: false,
    })
    .option("url", {
      alias: "u",
      description: "Directly download from a specific URL instead of searching",
      type: "string",
    })
    .option("source", {
      alias: "s",
      description: "Image source: 'google' (default) or 'useyourcredits'",
      type: "string",
      default: "google",
    })
    .help()
    .alias("help", "h")
    .parseSync();

  const cardName = argv.name;
  const maxAttempts = argv["max-attempts"];
  const listMode = argv.list;
  const directUrl = argv.url;
  const source = argv.source;

  // If using useyourcredits.com as source
  if (source === "useyourcredits") {
    const slug = USEYOURCREDITS_SLUGS[cardName];
    if (!slug) {
      console.error(`❌ No mapping found for "${cardName}" on useyourcredits.com`);
      console.log("\nAvailable mappings:");
      Object.keys(USEYOURCREDITS_SLUGS).forEach(name => console.log(`  - ${name}`));
      console.log("\n💡 You can add a new mapping in the USEYOURCREDITS_SLUGS object in this script.");
      console.log("   Or use --source google to search Google Images instead.");
      process.exit(1);
    }
    
    const imageUrl = `${USE_YOUR_CREDITS_BASE}${slug}.png`;
    console.log(`📥 Downloading from useyourcredits.com: ${imageUrl}`);
    
    try {
      const filename = `${slugify(cardName)}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      await downloadImage(imageUrl, filepath);
      console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);
      process.exit(0);
    } catch (error) {
      console.error(`❌ Failed to download: ${error.message}`);
      console.log("💡 The card might not exist on useyourcredits.com. Try --source google instead.");
      process.exit(1);
    }
  }

  // If a direct URL is provided, download it directly
  if (directUrl) {
    console.log(`Downloading image directly from: ${directUrl}`);
    try {
      const urlObj = new URL(directUrl);
      const pathname = urlObj.pathname.toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const extension = imageExtensions.find(ext => pathname.endsWith(ext)) || '.png';
      
      const filename = `${slugify(cardName)}${extension}`;
      const filepath = path.join(OUTPUT_DIR, filename);
      
      await downloadImage(directUrl, filepath);
      console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);
      process.exit(0);
    } catch (error) {
      console.error(`❌ Failed to download: ${error.message}`);
      process.exit(1);
    }
  }
  
  // Use a more specific search query to find official card art images
  // Adding "card art" or "official" helps find single card product images
  const searchQuery = `"${cardName}" card art official`;
  console.log(`Searching for image for: ${searchQuery}...`);

  try {
    // 1. Search for image using SerpApi
    const response = await getJson({
      engine: "google_images",
      q: searchQuery,
      api_key: API_KEY,
      tbs: "isz:m,itp:photo", // Medium size photos (not clipart/lineart)
      num: 30, // Get more results to choose from
    });

    if (!response.images_results || response.images_results.length === 0) {
      console.error(`No image results found for "${searchQuery}".`);
      process.exit(1);
    }

    console.log(`Found ${response.images_results.length} potential images`);

    // Sort results by preference (official card images first)
    const sortedResults = response.images_results
      .map(result => ({
        ...result,
        validation: isValidImageUrl(result.original, cardName)
      }))
      .filter(result => result.validation.isValid)
      .sort((a, b) => {
        // Calculate a score for each result
        const scoreA = calculateImageScore(a.validation);
        const scoreB = calculateImageScore(b.validation);
        return scoreB - scoreA; // Higher score first
      });
    
    function calculateImageScore(validation) {
      let score = 0;
      // Highest priority: official issuer domains
      if (validation.isPreferred) score += 100;
      // High priority: looks like a product/card-art image
      if (validation.isProductImage) score += 50;
      // Medium priority: contains relevant card terms in URL
      if (validation.hasRelevantTerms) score += 25;
      return score;
    }

    if (sortedResults.length === 0) {
      console.error("No valid image URLs found in search results");
      process.exit(1);
    }

    console.log(`${sortedResults.length} valid image URLs found`);
    
    // If list mode is enabled, show URLs and exit
    if (listMode) {
      console.log("\n📋 Available image URLs (sorted by quality score):\n");
      const showCount = Math.min(15, sortedResults.length);
      for (let i = 0; i < showCount; i++) {
        const result = sortedResults[i];
        const v = result.validation;
        const score = (v.isPreferred ? 100 : 0) + (v.isProductImage ? 50 : 0) + (v.hasRelevantTerms ? 25 : 0);
        const indicators = [
          v.isPreferred ? '🏛️ Official' : '',
          v.isProductImage ? '🎨 ProductImg' : '',
          v.hasRelevantTerms ? '🎯 Relevant' : ''
        ].filter(Boolean).join(' ');
        
        console.log(`${i + 1}. [Score: ${score}] ${indicators}`);
        console.log(`   ${result.original}`);
        if (result.source) console.log(`   Source: ${result.source}`);
        console.log('');
      }
      console.log("💡 To download a specific URL, run:");
      console.log(`   node scripts/download-card-image.js --name "${cardName}" --url "<URL>"`);
      process.exit(0);
    }
    
    console.log(`Trying up to ${maxAttempts} images...`);

    // 2. Try downloading images until we succeed
    let successfulDownload = false;
    const attempts = Math.min(maxAttempts, sortedResults.length);

    for (let i = 0; i < attempts; i++) {
      const result = sortedResults[i];
      const imageUrl = result.original;
      const validation = result.validation;
      
      console.log(`\n📁 Attempt ${i + 1}/${attempts}: ${imageUrl}`);
      if (validation.isPreferred) {
        console.log("✅ Preferred domain detected");
      }
      if (validation.hasRelevantTerms) {
        console.log("🎯 Contains relevant card terms");
      }

      try {
        // Generate filename with proper extension
        const filename = `${slugify(cardName)}${validation.extension}`;
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`📥 Downloading to: ${filepath}...`);
        await downloadImage(imageUrl, filepath);

        console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);
        successfulDownload = true;
        break;

      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        if (i === attempts - 1) {
          console.error("All download attempts failed");
        } else {
          console.log("🔄 Trying next result...");
        }
      }
    }

    if (!successfulDownload) {
      console.error(`Failed to download a valid image for "${cardName}" after ${attempts} attempts`);
      process.exit(1);
    }

  } catch (error) {
    console.error("An error occurred during the image download process:", error);
    if (error.response?.data) {
        console.error("SerpApi Error Details:", error.response.data);
    }
    process.exit(1);
  }
}

main(); 