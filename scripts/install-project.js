#!/usr/bin/env node
"use strict";

// install-project.js — copy context-harness runtime scripts into a target repo.
// Usage:
//   node <context-harness>/scripts/install-project.js [project-root]
//   node <context-harness>/scripts/install-project.js --profile legacy [project-root]

const fs = require("fs");
const path = require("path");

const sourceDir = __dirname;
const { profile, targetRoot } = parseArgs(process.argv.slice(2));
const targetDir = path.join(targetRoot, "scripts");
const coreScriptNames = [
  "codex-context-hook.js",
  "context-gen.js",
  "context-index.js",
  "format-on-edit.js",
  "guard.js",
  "install-project.js",
  "lib.js",
  "session-end.js",
  "task.js",
];
const legacyScriptNames = ["adr.js", "eval-loop.js"];
const scriptNames = profile === "legacy"
  ? [...legacyScriptNames, ...coreScriptNames]
  : coreScriptNames;

fs.mkdirSync(targetDir, { recursive: true });

let copied = 0;
let skipped = 0;

for (const name of scriptNames) {
  const source = path.join(sourceDir, name);
  const target = path.join(targetDir, name);
  if (!fs.existsSync(source)) continue;

  const next = fs.readFileSync(source, "utf8");
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, "utf8");
    if (current === next || current.includes("context-harness")) {
      fs.writeFileSync(target, next);
      copied += 1;
      continue;
    }
    console.error(`Refusing to overwrite existing non-context-harness script: ${path.relative(targetRoot, target)}`);
    skipped += 1;
    continue;
  }

  fs.writeFileSync(target, next);
  copied += 1;
}

console.log(`Installed ${copied} context-harness ${profile} scripts to ${path.relative(targetRoot, targetDir) || "scripts"}.`);
if (skipped > 0) {
  console.error(`Skipped ${skipped} existing non-context-harness scripts.`);
  process.exit(1);
}

function parseArgs(args) {
  let profile = "default";
  let rootArg = "";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--profile") {
      profile = args[i + 1] || "";
      i++;
    } else if (!rootArg) {
      rootArg = arg;
    }
  }
  if (!["default", "legacy"].includes(profile)) {
    console.error("Usage: install-project.js [--profile default|legacy] [project-root]");
    process.exit(1);
  }
  return { profile, targetRoot: path.resolve(rootArg || process.cwd()) };
}
