import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "build/amex-benefit-reader.user.js");
const userscriptVersion = "0.3.3";

const metadata = `// ==UserScript==
// @name         Perks Reminder — Amex Benefit Reader
// @namespace    https://perks-reminder.com/
// @version      ${userscriptVersion}
// @description  Locally reads normalized Amex benefit status after a manual first-party read request.
// @match        https://global.americanexpress.com/*
// @match        https://www.perks-reminder.com/integrations/amex-sync
// @run-at       document-idle
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// ==/UserScript==`;

await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(root, "src/userscripts/amex-benefit-reader.user.ts")],
  outfile: output,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  charset: "utf8",
  legalComments: "none",
  banner: { js: metadata },
  define: { __AMEX_READER_VERSION__: JSON.stringify(userscriptVersion) },
  tsconfig: resolve(root, "tsconfig.json"),
});

console.log(`Built ${output}`);
