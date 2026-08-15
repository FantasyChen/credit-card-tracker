import { cp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = resolve(root, "extension");
const releaseDir = resolve(root, "release");
const chromeDir = resolve(releaseDir, "chrome-extension");
const storeDir = resolve(releaseDir, "store-assets");
const iconsDir = resolve(chromeDir, "icons");
const master = resolve(extensionDir, "icon.svg");
const execFileAsync = promisify(execFile);
const reproducibleDate = new Date("2020-01-01T00:00:00.000Z");

await rm(chromeDir, { recursive: true, force: true });
await rm(storeDir, { recursive: true, force: true });
await mkdir(iconsDir, { recursive: true });
await mkdir(storeDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(master).resize(size, size).png().toFile(resolve(iconsDir, `icon-${size}.png`));
}
await sharp(master).resize(96, 96).extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(resolve(storeDir, "listing-icon-128.png"));
const mark = `<rect x="30" y="28" width="48" height="48" rx="14" fill="#172033"/><path d="M42 52a12 12 0 0 1 20.3-8.7M66 52a12 12 0 0 1-20.3 8.7" fill="none" stroke="#8fe3c1" stroke-width="4" stroke-linecap="round"/><path d="m61 38 3 5-5 1M47 66l-3-5 5-1" fill="none" stroke="#ffcf70" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
const promoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280"><rect width="440" height="280" rx="24" fill="#172033"/><circle cx="390" cy="-20" r="120" fill="#234052" opacity=".8"/><g>${mark}</g><text x="96" y="52" fill="#fff" font-family="Arial, sans-serif" font-size="21" font-weight="700">Perks Reminder</text><text x="96" y="76" fill="#b9c8d8" font-family="Arial, sans-serif" font-size="12">AMEX benefit reader</text><rect x="30" y="102" width="175" height="28" rx="14" fill="#0e7c65"/><text x="48" y="121" fill="#fff" font-family="Arial, sans-serif" font-size="11" font-weight="700">READ-ONLY • LOCAL</text><text x="30" y="164" fill="#fff" font-family="Arial, sans-serif" font-size="19" font-weight="700">Scan manually.</text><text x="30" y="187" fill="#d4e0ea" font-family="Arial, sans-serif" font-size="13">Review normalized benefits before</text><text x="30" y="206" fill="#d4e0ea" font-family="Arial, sans-serif" font-size="13">you choose an optional handoff.</text><rect x="270" y="108" width="136" height="112" rx="14" fill="#fff"/><text x="286" y="132" fill="#172033" font-family="Arial, sans-serif" font-size="10" font-weight="700">Synthetic card</text><text x="286" y="150" fill="#667085" font-family="Arial, sans-serif" font-size="9">Dining credit</text><rect x="286" y="164" width="78" height="16" rx="8" fill="#dff7ee"/><text x="294" y="175" fill="#087f5b" font-family="Arial, sans-serif" font-size="8" font-weight="700">PARTIAL</text><text x="286" y="200" fill="#172033" font-family="Arial, sans-serif" font-size="10">$25 of $100</text></svg>`;
await sharp(Buffer.from(promoSvg))
  .flatten({ background: "#172033" })
  .png({ colourType: 2 })
  .toFile(resolve(storeDir, "promo-440x280.png"));

await cp(resolve(extensionDir, "popup.html"), resolve(chromeDir, "popup.html"));
await cp(resolve(extensionDir, "popup.css"), resolve(chromeDir, "popup.css"));
await cp(resolve(extensionDir, "LICENSE"), resolve(chromeDir, "LICENSE"));
await cp(resolve(extensionDir, "manifest.template.json"), resolve(chromeDir, "manifest.json"));
await build({
  entryPoints: [resolve(root, "src/extension/content-entry.ts")],
  outfile: resolve(chromeDir, "content.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  charset: "utf8",
  legalComments: "none",
  minify: true,
  define: { __AMEX_EXTENSION_VERSION__: JSON.stringify("1.0.0") },
  tsconfig: resolve(root, "tsconfig.json"),
});
await execFileAsync("node", [resolve(root, "scripts/capture-amex-reader-screenshot.mjs"), resolve(storeDir, "screenshot-1280x800.png")], { cwd: root });

const greasymetadata = `// ==UserScript==
// @name         Perks Reminder — Amex Benefit Reader
// @namespace    https://perks-reminder.com/
// @version      1.0.0
// @description  Manually reads normalized benefit progress from your signed-in American Express session. Nothing scans automatically.
// @match        https://global.americanexpress.com/*
// @include      https://www.perks-reminder.com/integrations/amex-sync?transfer=*
// @run-at       document-idle
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @license      MIT
// @icon         https://www.perks-reminder.com/favicon.png
// @homepageURL  https://www.perks-reminder.com/
// @supportURL   https://github.com/lifan-builds/perks-reminder/issues
// ==/UserScript==
`;
const bundled = await build({
  entryPoints: [resolve(root, "src/userscripts/amex-benefit-reader.user.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  charset: "utf8",
  legalComments: "none",
  write: false,
  define: { __AMEX_READER_VERSION__: JSON.stringify("1.0.0"), __AMEX_SYNC_HANDOFF_TARGET__: JSON.stringify("production") },
  tsconfig: resolve(root, "tsconfig.json"),
});
await writeFile(resolve(releaseDir, "perks-reminder-amex-reader.user.js"), `${greasymetadata}${bundled.outputFiles[0].text}`, "utf8");

const runtimeFiles = ["manifest.json", "content.js", "popup.html", "popup.css", "LICENSE", "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"];
await Promise.all(runtimeFiles.map((file) => utimes(resolve(chromeDir, file), reproducibleDate, reproducibleDate)));
await rm(resolve(releaseDir, "perks-reminder-amex-reader-chrome-1.0.0.zip"), { force: true });
await execFileAsync("zip", ["-X", "-q", resolve(releaseDir, "perks-reminder-amex-reader-chrome-1.0.0.zip"), ...runtimeFiles], { cwd: chromeDir });
console.log("Built upload-ready Chrome and Greasy Fork artifacts in release/.");
