import { getJson } from "serpapi";
import axios from "axios";
import fs from "fs";
import path from "path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
import {
  filenameForCardImage,
  findDuplicateImageHashes,
  normalizeExtension,
  slugifyCardName,
  SUPPORTED_IMAGE_EXTENSIONS,
  validateImageFile,
} from "./card-image-utils.js";

// Determine the directory name in an ES module context
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Load .env file variables

const API_KEY = process.env.SERPAPI_API_KEY;
const OUTPUT_DIR = path.resolve(__dirname, "../public/images/cards");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
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
    const result = await validateImageFile(filepath);
    if (!result.ok) {
      console.warn(`Image validation failed for ${filepath}: ${result.errors.join("; ")}`);
    }
    for (const warning of result.warnings) {
      console.warn(`Image validation warning for ${filepath}: ${warning}`);
    }
    return result.ok;
  } catch (error) {
    console.warn(`Could not validate image content: ${error.message}`);
    return false;
  }
}

async function writeManifestEntry(entry) {
  await ensureDirectoryExists(OUTPUT_DIR);
  let manifest = { updatedAt: null, images: [] };
  try {
    manifest = JSON.parse(await fs.promises.readFile(MANIFEST_PATH, "utf8"));
    if (!Array.isArray(manifest.images)) manifest.images = [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read existing manifest: ${error.message}`);
    }
  }

  const nextImages = manifest.images.filter((image) => image.filename !== entry.filename);
  nextImages.push(entry);
  nextImages.sort((a, b) => a.cardName.localeCompare(b.cardName));

  await fs.promises.writeFile(
    MANIFEST_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), images: nextImages }, null, 2)
  );
}

async function writeManifestEntries(entries) {
  await ensureDirectoryExists(OUTPUT_DIR);
  const sortedEntries = [...entries].sort((a, b) => a.filename.localeCompare(b.filename));
  await fs.promises.writeFile(
    MANIFEST_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), images: sortedEntries }, null, 2)
  );
}

async function finalizeDownloadedImage({ filepath, cardName, source, sourceUrl, force, updateManifest }) {
  const validation = await validateImageFile(filepath);
  if (!validation.ok) {
    await fs.promises.unlink(filepath).catch(() => {});
    throw new Error(`Downloaded image failed validation: ${validation.errors.join("; ")}`);
  }

  const duplicates = await findDuplicateImageHashes(OUTPUT_DIR, validation.sha256, filepath);
  if (duplicates.length > 0) {
    console.warn("Duplicate image content detected:");
    duplicates.forEach((duplicate) => console.warn(`  - ${path.relative(process.cwd(), duplicate)}`));
  }

  const filename = path.basename(filepath);
  const entry = {
    cardName,
    filename,
    path: `/images/cards/${filename}`,
    source,
    sourceUrl,
    width: validation.metadata.width,
    height: validation.metadata.height,
    type: validation.metadata.type,
    sizeBytes: validation.sizeBytes,
    sha256: validation.sha256,
    duplicates: duplicates.map((duplicate) => path.relative(OUTPUT_DIR, duplicate)),
    overwritten: force,
    ingestedAt: new Date().toISOString(),
  };

  if (updateManifest) {
    await writeManifestEntry(entry);
  }

  console.log(`Validated ${filename}: ${entry.width ?? "?"}x${entry.height ?? "?"}, ${entry.type}, ${entry.sizeBytes} bytes`);
  if (updateManifest) {
    console.log(`Updated manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  }
  return entry;
}

async function assertCanWrite(filepath, force) {
  try {
    await fs.promises.access(filepath);
    if (!force) {
      throw new Error(`Refusing to overwrite ${path.relative(process.cwd(), filepath)}. Pass --force to replace it.`);
    }
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
}

async function validateExistingImages(target, writeManifest = false) {
  await ensureDirectoryExists(OUTPUT_DIR);
  const files = target === "all"
    ? (await fs.promises.readdir(OUTPUT_DIR))
        .filter((file) => SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
        .map((file) => path.join(OUTPUT_DIR, file))
    : [path.isAbsolute(target) ? target : path.join(OUTPUT_DIR, target)];

  let failures = 0;
  const manifestEntries = [];
  for (const filepath of files) {
    const result = await validateImageFile(filepath);
    const relative = path.relative(process.cwd(), filepath);
    if (result.ok) {
      console.log(`OK ${relative} ${result.metadata.width ?? "?"}x${result.metadata.height ?? "?"} ${result.sizeBytes} bytes`);
    } else {
      failures += 1;
      console.error(`FAIL ${relative}: ${result.errors.join("; ")}`);
    }
    for (const warning of result.warnings) {
      console.warn(`WARN ${relative}: ${warning}`);
    }

    manifestEntries.push({
      cardName: path.basename(filepath, path.extname(filepath)),
      filename: path.basename(filepath),
      path: `/images/cards/${path.basename(filepath)}`,
      source: "existing-repo-asset",
      sourceUrl: null,
      width: result.metadata.width,
      height: result.metadata.height,
      type: result.metadata.type,
      sizeBytes: result.sizeBytes,
      sha256: result.sha256,
      duplicates: [],
      validatedAt: new Date().toISOString(),
    });
  }

  if (failures > 0) {
    throw new Error(`${failures} image${failures === 1 ? "" : "s"} failed validation`);
  }

  if (writeManifest) {
    await writeManifestEntries(manifestEntries);
    console.log(`Updated manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
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
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option("name", {
      alias: "n",
      description: "The name of the credit card",
      type: "string",
      demandOption: false,
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
      description: "Image source: 'auto' (default), 'google', or 'useyourcredits'",
      type: "string",
      default: "auto",
      choices: ["auto", "google", "useyourcredits"],
    })
    .option("dry-run", {
      description: "Show the target filename and source candidates without writing files",
      type: "boolean",
      default: false,
    })
    .option("force", {
      alias: "f",
      description: "Overwrite an existing image file",
      type: "boolean",
      default: false,
    })
    .option("validate", {
      description: "Validate an existing image filename/path, or use 'all' for every card image",
      type: "string",
    })
    .option("manifest", {
      description: "Update public/images/cards/manifest.json after a successful ingestion",
      type: "boolean",
      default: true,
    })
    .option("write-manifest", {
      description: "When validating existing images, write a manifest for the validated files",
      type: "boolean",
      default: false,
    })
    .help()
    .alias("help", "h")
    .parseSync();

  if (argv.validate) {
    try {
      await validateExistingImages(argv.validate, argv["write-manifest"]);
      process.exit(0);
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  if (!argv.name) {
    console.error("Error: --name is required unless --validate is used.");
    process.exit(1);
  }

  const cardName = argv.name;
  const maxAttempts = argv["max-attempts"];
  const listMode = argv.list;
  const directUrl = argv.url;
  const source = argv.source;
  const dryRun = argv["dry-run"];
  const force = argv.force;
  const updateManifest = argv.manifest;

  const normalizedBaseName = slugifyCardName(cardName);
  console.log(`Card: ${cardName}`);
  console.log(`Normalized filename base: ${normalizedBaseName}`);

  // If using useyourcredits.com as source
  if (source === "useyourcredits" || source === "auto") {
    const slug = USEYOURCREDITS_SLUGS[cardName];
    if (!slug && source === "useyourcredits") {
      console.error(`❌ No mapping found for "${cardName}" on useyourcredits.com`);
      console.log("\nAvailable mappings:");
      Object.keys(USEYOURCREDITS_SLUGS).forEach(name => console.log(`  - ${name}`));
      console.log("\n💡 You can add a new mapping in the USEYOURCREDITS_SLUGS object in this script.");
      console.log("   Or use --source google to search Google Images instead.");
      process.exit(1);
    }

    if (slug) {
      const imageUrl = `${USE_YOUR_CREDITS_BASE}${slug}.png`;
      const filename = filenameForCardImage(cardName, ".png");
      const filepath = path.join(OUTPUT_DIR, filename);
      console.log(`UseYourCredits candidate: ${imageUrl}`);
      console.log(`Target: ${path.relative(process.cwd(), filepath)}`);

      if (dryRun || listMode) {
        if (source === "useyourcredits" || !API_KEY) process.exit(0);
      } else {
        try {
          await assertCanWrite(filepath, force);
          await downloadImage(imageUrl, filepath);
          await finalizeDownloadedImage({ filepath, cardName, source: "useyourcredits", sourceUrl: imageUrl, force, updateManifest });
          console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);
          process.exit(0);
        } catch (error) {
          console.error(`❌ UseYourCredits failed: ${error.message}`);
          if (source === "useyourcredits") {
            console.log("💡 The card might not exist on useyourcredits.com. Try --source google instead.");
            process.exit(1);
          }
          console.log("Falling back to Google Images search...");
        }
      }
    }
  }

  // If a direct URL is provided, download it directly
  if (directUrl) {
    console.log(`Downloading image directly from: ${directUrl}`);
    try {
      const urlObj = new URL(directUrl);
      const pathname = urlObj.pathname.toLowerCase();
      const extension = normalizeExtension(SUPPORTED_IMAGE_EXTENSIONS.find(ext => pathname.endsWith(ext)) || '.png');
      const filename = filenameForCardImage(cardName, extension);
      const filepath = path.join(OUTPUT_DIR, filename);

      console.log(`Target: ${path.relative(process.cwd(), filepath)}`);
      if (dryRun) {
        process.exit(0);
      }

      await assertCanWrite(filepath, force);
      await downloadImage(directUrl, filepath);
      await finalizeDownloadedImage({ filepath, cardName, source: "direct-url", sourceUrl: directUrl, force, updateManifest });
      console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);
      process.exit(0);
    } catch (error) {
      console.error(`❌ Failed to download: ${error.message}`);
      process.exit(1);
    }
  }

  if (!API_KEY) {
    console.error("Error: SERPAPI_API_KEY not found. Use --source useyourcredits, --url, or set SERPAPI_API_KEY.");
    process.exit(1);
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

    if (dryRun) {
      const best = sortedResults[0];
      const filename = filenameForCardImage(cardName, best.validation.extension);
      console.log(`Dry run target: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, filename))}`);
      console.log(`Best candidate: ${best.original}`);
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
        const filename = filenameForCardImage(cardName, validation.extension);
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`📥 Downloading to: ${filepath}...`);
        await assertCanWrite(filepath, force);
        await downloadImage(imageUrl, filepath);
        await finalizeDownloadedImage({ filepath, cardName, source: "google-images", sourceUrl: imageUrl, force, updateManifest });

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
