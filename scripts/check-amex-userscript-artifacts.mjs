import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = process.cwd();
const artifacts = [
  {
    label: "production",
    path: resolve(root, "build/amex-benefit-reader.user.js"),
    name: "Perks Reminder — Amex Benefit Reader",
    namespace: "https://perks-reminder.com/",
    version: "1.0.0",
    targetName: "production",
    matches: [
      "https://global.americanexpress.com/*",
    ],
    includes: [
      "https://www.perks-reminder.com/integrations/amex-sync?transfer=*",
    ],
    grants: ["GM.getValue", "GM.setValue", "GM.deleteValue", "unsafeWindow"],
  },
  {
    label: "local",
    path: resolve(root, "public/local-development/amex-benefit-reader.local.user.js"),
    name: "Perks Reminder — Amex Benefit Reader (Local Development)",
    namespace: "http://localhost:3000/perks-reminder-amex-reader-local/",
    version: "0.5.0-local.3",
    targetName: "local",
    matches: [
      "https://global.americanexpress.com/*",
    ],
    includes: [
      "http://localhost:3000/integrations/amex-sync?transfer=*",
    ],
    grants: ["GM.getValue", "GM.setValue", "GM.deleteValue", "unsafeWindow"],
  },
];

function metadataValues(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(
    source.matchAll(new RegExp(`^// @${escapedKey}\\s+(.+)$`, "gm")),
    (match) => match[1].trim(),
  );
}

function includePatternMatches(pattern, value) {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`).test(value);
}

function matchPatternHasPort(pattern) {
  if (!/^https?:\/\//.test(pattern)) return false;
  try {
    return new URL(pattern.replaceAll("*", "wildcard")).port !== "";
  } catch {
    return true;
  }
}

function compareNumericVersions(left, right) {
  assert.match(left, /^\d+\.\d+\.\d+$/, `Invalid numeric version ${left}`);
  assert.match(right, /^\d+\.\d+\.\d+$/, `Invalid numeric version ${right}`);
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

const previouslyInstalledProductionVersion = "0.5.3";
const approvedArtifactOrigins = new Set([
  "http://localhost:3000",
  "https://functions.americanexpress.com",
  "https://global.americanexpress.com",
  "https://perks-reminder.com",
  "https://www.perks-reminder.com",
  "http://www.w3.org",
]);
const sensitiveMarkers = [
  "AMEX_SYNC_HMAC_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "BEGIN PRIVATE KEY",
  "postgres://",
  "postgresql://",
  "process.env",
];

assert.equal(
  relative(root, artifacts[0].path),
  "build/amex-benefit-reader.user.js",
  "production output path changed",
);
assert.equal(
  relative(root, artifacts[1].path),
  "public/local-development/amex-benefit-reader.local.user.js",
  "local output path changed",
);
assert.notEqual(artifacts[0].path, artifacts[1].path, "build targets must have distinct outputs");
assert.equal(
  compareNumericVersions(artifacts[0].version, previouslyInstalledProductionVersion) > 0,
  true,
  `production version must strictly increase from ${previouslyInstalledProductionVersion}`,
);

assert.equal(matchPatternHasPort("http://localhost:3000/*"), true, "port-bearing @match must be rejected");
assert.equal(matchPatternHasPort("https://global.americanexpress.com/*"), false);

const localInclude = artifacts[1].includes[0];
const productionInclude = artifacts[0].includes[0];
assert.equal(
  includePatternMatches(productionInclude, "https://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  true,
  "production @include must cover the transfer handoff URL",
);
for (const excludedUrl of [
  "https://www.perks-reminder.com/integrations/amex-sync",
  "https://www.perks-reminder.com/integrations/amex-sync-other?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "http://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "https://perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "https://www.perks-reminder.com:8443/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "http://localhost:3000/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
]) {
  assert.equal(includePatternMatches(productionInclude, excludedUrl), false, `production @include unexpectedly covers ${excludedUrl}`);
}
assert.equal(
  includePatternMatches(localInclude, "http://localhost:3000/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  true,
  "local @include must cover the transfer handoff URL",
);
for (const excludedUrl of [
  "http://localhost:3000/integrations/amex-sync",
  "http://localhost:3000/integrations/amex-sync-other?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "http://localhost:3001/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "http://127.0.0.1:3000/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "https://localhost:3000/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "https://www.perks-reminder.com/integrations/amex-sync?transfer=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
]) {
  assert.equal(includePatternMatches(localInclude, excludedUrl), false, `local @include unexpectedly covers ${excludedUrl}`);
}

for (const artifact of artifacts) {
  const source = await readFile(artifact.path, "utf8");
  const metadataEnd = source.indexOf("// ==/UserScript==");
  assert.notEqual(metadataEnd, -1, `${artifact.label} metadata is missing`);
  const metadata = source.slice(0, metadataEnd);

  assert.deepEqual(metadataValues(metadata, "name"), [artifact.name]);
  assert.deepEqual(metadataValues(metadata, "namespace"), [artifact.namespace]);
  assert.deepEqual(metadataValues(metadata, "version"), [artifact.version]);
  assert.deepEqual(metadataValues(metadata, "match"), artifact.matches);
  assert.deepEqual(metadataValues(metadata, "include"), artifact.includes);
  for (const match of artifact.matches) {
    assert.equal(matchPatternHasPort(match), false, `${artifact.label} @match must not contain a port`);
  }
  assert.deepEqual(metadataValues(metadata, "grant"), artifact.grants);
  assert.deepEqual(metadataValues(metadata, "connect"), []);
  assert.deepEqual(metadataValues(metadata, "updateURL"), []);
  assert.deepEqual(metadataValues(metadata, "downloadURL"), []);
  assert.equal(metadata.includes("GM_xmlhttpRequest"), false);
  assert.equal(metadata.includes("@require"), false);

  assert.equal(
    source.includes('const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;'),
    true,
    `${artifact.label} handoff must use the page-realm window exposed by Tampermonkey`,
  );
  assert.equal(
    source.includes('Array.from(params.keys()).length === 1 && /^[a-f0-9]{32}$/.test(params.get("transfer") ?? "")'),
    true,
    `${artifact.label} handoff must require exactly one valid transfer query parameter`,
  );

  assert.equal(
    source.includes(`resolveAmexSyncHandoffTarget("${artifact.targetName}")`),
    true,
    `${artifact.label} build target was not compiled into the artifact`,
  );
  const otherTarget = artifact.targetName === "production" ? "local" : "production";
  assert.equal(
    source.includes(`resolveAmexSyncHandoffTarget("${otherTarget}")`),
    false,
    `${artifact.label} artifact invokes the wrong handoff target`,
  );

  for (const marker of sensitiveMarkers) {
    assert.equal(source.includes(marker), false, `${artifact.label} artifact contains sensitive marker ${marker}`);
  }
  const origins = Array.from(source.matchAll(/https?:\/\/[-A-Za-z0-9._:]+/g), (match) => match[0]);
  assert.equal(origins.length > 0, true, `${artifact.label} artifact contains no reviewed origins`);
  for (const origin of origins) {
    assert.equal(approvedArtifactOrigins.has(origin), true, `${artifact.label} artifact contains unapproved origin ${origin}`);
  }
}

assert.notEqual(artifacts[0].name, artifacts[1].name);
assert.notEqual(artifacts[0].namespace, artifacts[1].namespace);
assert.notEqual(artifacts[0].version, artifacts[1].version);

console.log("Verified strict production version increase, exact transfer includes, target separation, and port-aware local include.");
