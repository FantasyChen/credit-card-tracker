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

// Ensure the output directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } else {
      throw error; // Re-throw other errors
    }
  }
}

// Download image from URL
async function downloadImage(url, filepath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    // Ensure the directory exists before writing
    await ensureDirectoryExists(path.dirname(filepath));

    const writer = fs.createWriteStream(filepath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    throw error; // Re-throw to indicate failure
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
    .help()
    .alias("help", "h")
    .parseSync(); // Use parseSync or handle async parsing if needed

  const cardName = argv.name;
  const searchQuery = `${cardName} credit card`;
  console.log(`Searching for image for: ${searchQuery}...`);

  try {
    // 1. Search for image using SerpApi
    const response = await getJson({
      engine: "google_images",
      q: searchQuery,
      api_key: API_KEY,
      tbs: "isz:m", // Medium size images are usually good enough
    });

    if (!response.images_results || response.images_results.length === 0) {
      console.error(`No image results found for "${searchQuery}".`);
      process.exit(1);
    }

    // Try to find a suitable image (e.g., the first result)
    // You might want more sophisticated logic here later to pick the best image
    const firstResult = response.images_results[0];
    const imageUrl = firstResult.original; // Get the original image URL

    let imageExtension = ".jpg"; // Default extension
    try {
      imageExtension = path.extname(new URL(imageUrl).pathname) || ".jpg";
    } catch (e) {
      console.warn(`Could not parse URL extension from ${imageUrl}, defaulting to .jpg`);
      // Handle cases where imageUrl might not be a valid URL (less likely from SerpApi)
    }

    console.log(`Found image: ${imageUrl}`);

    // 2. Generate Filename
    const filename = `${slugify(cardName)}${imageExtension}`;
    const filepath = path.join(OUTPUT_DIR, filename);

    console.log(`Downloading to: ${filepath}...`);

    // 3. Download and Save Image
    await downloadImage(imageUrl, filepath);

    console.log(`✅ Successfully downloaded image for "${cardName}" to ${filepath}`);

  } catch (error) {
    console.error("An error occurred during the image download process:", error);
    if (error.response?.data) {
        console.error("SerpApi Error Details:", error.response.data);
    }
    process.exit(1);
  }
}

main(); 