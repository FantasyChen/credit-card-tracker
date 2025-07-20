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

// Validate if URL looks like an image
function isValidImageUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check if it ends with common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
    
    // Exclude common non-image patterns
    const invalidPatterns = ['/404', '/error', 'placeholder', 'fallback'];
    const hasInvalidPattern = invalidPatterns.some(pattern => 
      urlObj.href.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Prefer certain domains known to have good images
    const preferredDomains = ['americanexpress.com', 'chase.com', 'capitalone.com', 'citi.com'];
    const isPreferredDomain = preferredDomains.some(domain => urlObj.hostname.includes(domain));
    
    return {
      isValid: hasImageExtension && !hasInvalidPattern,
      isPreferred: isPreferredDomain,
      extension: imageExtensions.find(ext => pathname.endsWith(ext)) || '.jpg'
    };
  } catch (e) {
    return { isValid: false, isPreferred: false, extension: '.jpg' };
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
    .help()
    .alias("help", "h")
    .parseSync();

  const cardName = argv.name;
  const maxAttempts = argv["max-attempts"];
  const searchQuery = `${cardName} credit card`;
  console.log(`Searching for image for: ${searchQuery}...`);

  try {
    // 1. Search for image using SerpApi
    const response = await getJson({
      engine: "google_images",
      q: searchQuery,
      api_key: API_KEY,
      tbs: "isz:m", // Medium size images are usually good enough
      num: 20, // Get more results to choose from
    });

    if (!response.images_results || response.images_results.length === 0) {
      console.error(`No image results found for "${searchQuery}".`);
      process.exit(1);
    }

    console.log(`Found ${response.images_results.length} potential images`);

    // Sort results by preference (preferred domains first, then valid images)
    const sortedResults = response.images_results
      .map(result => ({
        ...result,
        validation: isValidImageUrl(result.original)
      }))
      .filter(result => result.validation.isValid)
      .sort((a, b) => {
        // Prefer images from official sources
        if (a.validation.isPreferred && !b.validation.isPreferred) return -1;
        if (!a.validation.isPreferred && b.validation.isPreferred) return 1;
        return 0;
      });

    if (sortedResults.length === 0) {
      console.error("No valid image URLs found in search results");
      process.exit(1);
    }

    console.log(`${sortedResults.length} valid image URLs found, trying up to ${maxAttempts}...`);

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