import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const root = process.cwd();
const execFileAsync = promisify(execFile);
const chrome = resolve(root, "release/chrome-extension");
const manifest = JSON.parse(await readFile(resolve(chrome, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "1.0.0");
assert.deepEqual(manifest.permissions, ["storage"]);
assert.equal(manifest.host_permissions, undefined, "content-script matches provide the only reviewed site access");
assert.equal(manifest.optional_permissions, undefined, "optional permissions are not needed");
assert.equal(manifest.web_accessible_resources, undefined, "web-accessible resources are not needed");
assert.equal(manifest.externally_connectable, undefined, "external messaging is not allowed");
assert.equal(manifest.commands, undefined, "commands are not needed");
assert.equal(manifest.side_panel, undefined, "side panel is not needed");
assert.equal(manifest.offscreen, undefined, "offscreen documents are not allowed");
assert.equal(manifest.background, undefined);
assert.equal(manifest.content_scripts.length, 1);
assert.deepEqual(manifest.content_scripts[0].matches, ["https://global.americanexpress.com/*", "https://www.perks-reminder.com/integrations/amex-sync"]);
assert.equal(manifest.content_scripts[0].all_frames, false);
assert.equal(manifest.content_scripts[0].world, undefined, "content script must retain the default isolated world");
assert.equal(manifest.content_scripts[0].match_about_blank, undefined, "about:blank injection is not allowed");
assert.equal(manifest.content_scripts[0].match_origin_as_fallback, undefined, "origin fallback injection is not allowed");
assert.deepEqual(manifest.action.default_popup, "popup.html");

const userscript = await readFile(resolve(root, "release/perks-reminder-amex-reader.user.js"), "utf8");
const userscriptMetadataEnd = userscript.indexOf("// ==/UserScript==");
assert.notEqual(userscriptMetadataEnd, -1, "userscript metadata is missing");
const userscriptMetadata = userscript.slice(0, userscriptMetadataEnd);
function metadataValues(key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(
    userscriptMetadata.matchAll(new RegExp(`^// @${escapedKey}\\s+(.+)$`, "gm")),
    (match) => match[1].trim(),
  );
}
assert.deepEqual(metadataValues("name"), ["Perks Reminder — Amex Benefit Reader"]);
assert.deepEqual(metadataValues("namespace"), ["https://perks-reminder.com/"]);
assert.deepEqual(metadataValues("version"), ["1.0.0"]);
assert.deepEqual(metadataValues("match"), ["https://global.americanexpress.com/*"]);
assert.deepEqual(metadataValues("include"), ["https://www.perks-reminder.com/integrations/amex-sync?transfer=*"]);
assert.deepEqual(metadataValues("description"), ["Manually reads normalized benefit progress from your signed-in American Express session. Nothing scans automatically."]);
assert.deepEqual(metadataValues("run-at"), ["document-idle"]);
assert.equal((userscriptMetadata.match(/^\/\/ @noframes$/gm) ?? []).length, 1);
assert.deepEqual(metadataValues("grant"), ["GM.getValue", "GM.setValue", "GM.deleteValue", "unsafeWindow"]);
assert.deepEqual(metadataValues("connect"), []);
assert.deepEqual(metadataValues("require"), []);
for (const expected of ["@license      MIT", "@icon         https://www.perks-reminder.com/favicon.png", "@homepageURL  https://www.perks-reminder.com/", "@supportURL   https://github.com/lifan-builds/perks-reminder/issues"]) assert.ok(userscriptMetadata.includes(expected), `userscript metadata missing ${expected}`);
for (const forbidden of ["@require", "@updateURL", "@downloadURL", "GM_xmlhttpRequest", "XMLHttpRequest", "WebSocket", "EventSource", "DATABASE_URL", "NEXTAUTH_SECRET"]) assert.equal(userscript.includes(forbidden), false, `userscript includes forbidden ${forbidden}`);
const content = await readFile(resolve(chrome, "content.js"), "utf8");
for (const forbidden of ["chrome.tabs", "chrome.scripting", "XMLHttpRequest", "WebSocket", "EventSource", "https://evil"]) assert.equal(content.includes(forbidden), false, `extension bundle includes forbidden ${forbidden}`);
const approvedOrigins = new Set(["http://localhost:3000", "https://global.americanexpress.com", "https://functions.americanexpress.com", "https://perks-reminder.com", "https://www.perks-reminder.com", "http://www.w3.org"]);
for (const origin of Array.from(content.matchAll(/https?:\/\/[A-Za-z0-9._:-]+/g), (match) => match[0])) assert.equal(approvedOrigins.has(origin), true, `extension bundle includes unapproved origin ${origin}`);
for (const file of ["popup.html", "popup.css", "LICENSE", "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"]) {
  const info = await stat(resolve(chrome, file));
  assert.equal(info.isFile(), true, `missing extension artifact ${file}`);
}
const popup = await readFile(resolve(chrome, "popup.html"), "utf8");
assert.equal(/<script\b|<iframe\b|<object\b|<embed\b/i.test(popup), false, "popup must remain static and local-only");
assert.equal(/chrome\.|browser\.|fetch\s*\(/.test(popup), false, "popup must not invoke privileged or network APIs");
const popupLinks = Array.from(popup.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>/gi), (match) => match[0]);
assert.equal(popupLinks.length, 3, "popup link set changed");
for (const link of popupLinks) {
  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noopener noreferrer"/);
}
const storeDir = resolve(root, "release/store-assets");
for (const [file, dimensions] of [["listing-icon-128.png", [128, 128]], ["promo-440x280.png", [440, 280]], ["screenshot-1280x800.png", [1280, 800]]]) {
  const info = await sharp(resolve(storeDir, file)).metadata();
  assert.deepEqual([info.width, info.height], dimensions, `${file} dimensions changed`);
}
const promoInfo = await sharp(resolve(storeDir, "promo-440x280.png")).metadata();
assert.equal(promoInfo.channels, 3, "promo must be 24-bit RGB");
assert.equal(promoInfo.hasAlpha, false, "promo must not contain an alpha channel");
const iconPixels = await sharp(resolve(chrome, "icons/icon-128.png")).raw().toBuffer({ resolveWithObject: true });
const promoPixels = await sharp(resolve(storeDir, "promo-440x280.png")).resize(128, 128).raw().toBuffer({ resolveWithObject: true });
const screenshotPixels = await sharp(resolve(storeDir, "screenshot-1280x800.png")).resize(128, 128).raw().toBuffer({ resolveWithObject: true });
assert.notEqual(createHash("sha256").update(iconPixels.data).digest("hex"), createHash("sha256").update(promoPixels.data).digest("hex"), "promo is icon-only");
assert.notEqual(createHash("sha256").update(iconPixels.data).digest("hex"), createHash("sha256").update(screenshotPixels.data).digest("hex"), "screenshot is icon-only");
const screenshotText = await readFile(resolve(storeDir, "screenshot-1280x800.png"));
assert.ok(screenshotText.byteLength > 20_000, "screenshot is unexpectedly sparse");
const files = await readdir(chrome, { recursive: true });
assert.equal(files.some((file) => file.endsWith(".map") || file.includes(".env")), false);
const zip = await readFile(resolve(root, "release/perks-reminder-amex-reader-chrome-1.0.0.zip"));
assert.ok(zip.byteLength > 1000, "Chrome package is unexpectedly empty");
const firstHash = createHash("sha256").update(zip).digest("hex");
const { stdout: rebuildOutput } = await execFileAsync("node", ["scripts/build-amex-reader-extension.mjs"], { cwd: root });
assert.match(rebuildOutput, /Built upload-ready/);
const rebuiltZip = await readFile(resolve(root, "release/perks-reminder-amex-reader-chrome-1.0.0.zip"));
assert.equal(createHash("sha256").update(rebuiltZip).digest("hex"), firstHash, "Chrome ZIP is not reproducible");
const rebuiltUserscript = await readFile(resolve(root, "release/perks-reminder-amex-reader.user.js"), "utf8");
assert.equal(createHash("sha256").update(rebuiltUserscript).digest("hex"), createHash("sha256").update(userscript).digest("hex"), "Greasy artifact is not reproducible");
const { stdout: zipListing } = await execFileAsync("unzip", ["-Z1", resolve(root, "release/perks-reminder-amex-reader-chrome-1.0.0.zip")]);
const packageFiles = zipListing.trim().split("\n");
assert.deepEqual(packageFiles.filter((file) => file).sort(), ["manifest.json", "content.js", "popup.html", "popup.css", "LICENSE", "icons/icon-16.png", "icons/icon-48.png", "icons/icon-128.png", "icons/icon-32.png"].sort(), "store media must stay outside runtime ZIP");
assert.equal(packageFiles.some((file) => /(?:promo|screenshot|listing-icon)/.test(file)), false, "store media leaked into runtime ZIP");
await writeFile(resolve(root, "release/hashes.json"), `${JSON.stringify({
  chromeZipSha256: createHash("sha256").update(zip).digest("hex"),
  greasyForkSha256: createHash("sha256").update(userscript).digest("hex"),
}, null, 2)}\n`);
console.log("Verified MV3 permissions, exact routes, Greasy metadata, local-only storage, assets, and no remote-code markers.");
