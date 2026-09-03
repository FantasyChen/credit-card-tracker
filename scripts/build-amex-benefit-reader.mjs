import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestedTarget = process.argv[2] ?? "production";
const publicReleaseVersion = "1.0.1";

const targetConfigurations = Object.freeze({
  production: Object.freeze({
    output: "build/amex-benefit-reader.user.js",
    userscriptName: "Perks Reminder — Amex Benefit Reader",
    namespace: "https://perks-reminder.com/",
    version: publicReleaseVersion,
    handoffMatch: null,
    handoffInclude: "https://www.perks-reminder.com/integrations/amex-sync?transfer=*",
    unsafeWindowGrant: true,
  }),
  local: Object.freeze({
    output: "public/local-development/amex-benefit-reader.local.user.js",
    userscriptName: "Perks Reminder — Amex Benefit Reader (Local Development)",
    namespace: "http://localhost:3000/perks-reminder-amex-reader-local/",
    version: "0.5.0-local.3",
    handoffMatch: null,
    handoffInclude: "http://localhost:3000/integrations/amex-sync?transfer=*",
    unsafeWindowGrant: true,
  }),
});

if (!Object.hasOwn(targetConfigurations, requestedTarget)) {
  throw new Error("Expected an Amex userscript build target of production or local.");
}

const targetName = /** @type {keyof typeof targetConfigurations} */ (requestedTarget);
const configuration = targetConfigurations[targetName];
const output = resolve(root, configuration.output);
const handoffMetadata = configuration.handoffMatch
  ? `// @match        ${configuration.handoffMatch}`
  : `// @include      ${configuration.handoffInclude}`;
const unsafeWindowGrant = configuration.unsafeWindowGrant
  ? "\n// @grant        unsafeWindow"
  : "";

const metadata = `// ==UserScript==
// @name         ${configuration.userscriptName}
// @namespace    ${configuration.namespace}
// @version      ${configuration.version}
// @description  Locally reads normalized Amex benefit status after a manual first-party read request.
// @match        https://global.americanexpress.com/*
${handoffMetadata}
// @run-at       document-idle
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue${unsafeWindowGrant}
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
  define: {
    __AMEX_READER_VERSION__: JSON.stringify(configuration.version),
    __AMEX_SYNC_HANDOFF_TARGET__: JSON.stringify(targetName),
  },
  tsconfig: resolve(root, "tsconfig.json"),
});

console.log(`Built ${targetName} Amex userscript at ${output}`);
