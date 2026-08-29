#!/usr/bin/env node

import fs from "node:fs";

const [reportPath, expectedMode] = process.argv.slice(2);
if (!reportPath || !["dry-run", "apply"].includes(expectedMode)) {
  console.error("Usage: validate-catalog-sync-report.mjs <report> <dry-run|apply>");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch {
  console.error("Catalog sync report is not valid JSON.");
  process.exit(1);
}

const conflictCount = report?.plan?.conflictCount;
const actionKinds = ["create", "adopt", "update", "retire", "unchanged"];
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const hasActionCounts = (counts) => actionKinds.every((kind) => isCount(counts?.[kind]));
const validShape = isCount(report?.source?.cards)
  && isCount(report?.source?.benefits)
  && hasActionCounts(report?.plan?.cards)
  && hasActionCounts(report?.plan?.benefits);

if (report?.mode !== expectedMode || !validShape || !isCount(conflictCount) || conflictCount !== 0) {
  console.error("Catalog sync report failed its mode or conflict gate.");
  process.exit(1);
}

console.log("Catalog sync report passed its mode and conflict gates.");
