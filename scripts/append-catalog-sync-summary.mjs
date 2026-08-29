#!/usr/bin/env node

import fs from "node:fs";

const [reportPath, summaryPath] = process.argv.slice(2);
if (!reportPath || !summaryPath) process.exit(0);

try {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const plan = report.plan;
  const actionKinds = ["create", "adopt", "update", "retire", "unchanged"];
  const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
  const validShape = (report.mode === "dry-run" || report.mode === "apply")
    && isCount(report.source?.cards)
    && isCount(report.source?.benefits)
    && actionKinds.every((kind) => isCount(plan?.cards?.[kind]))
    && actionKinds.every((kind) => isCount(plan?.benefits?.[kind]))
    && isCount(plan?.conflictCount);
  if (!validShape) {
    fs.appendFileSync(summaryPath, "### Global catalog sync\n\nAggregate report unavailable; validation failed.\n");
    process.exit(0);
  }
  const line = `### Global catalog sync\n\nMode: \`${report.mode}\`\n\n` +
    `Source: ${report.source.cards} cards / ${report.source.benefits} benefits\n\n` +
    `Cards: create ${plan.cards.create}, adopt ${plan.cards.adopt}, update ${plan.cards.update}, ` +
      `retire ${plan.cards.retire}, unchanged ${plan.cards.unchanged}\n\n` +
    `Benefits: create ${plan.benefits.create}, adopt ${plan.benefits.adopt}, update ${plan.benefits.update}, ` +
      `retire ${plan.benefits.retire}, unchanged ${plan.benefits.unchanged}\n\n` +
    `Conflicts: ${plan.conflictCount}\n`;
  fs.appendFileSync(summaryPath, line);
} catch {
  // Validation owns failure reporting; do not print report contents.
}
