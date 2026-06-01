#!/usr/bin/env node
"use strict";

// install-project.js — copy context-harness runtime scripts into a target repo.
// Usage: node <context-harness>/scripts/install-project.js [project-root]

const fs = require("fs");
const path = require("path");

const sourceDir = __dirname;
const targetRoot = path.resolve(process.argv[2] || process.cwd());
const targetDir = path.join(targetRoot, "scripts");
const scriptNames = [
  "adr.js",
  "codex-context-hook.js",
  "context-gen.js",
  "context-index.js",
  "eval-loop.js",
  "format-on-edit.js",
  "guard.js",
  "install-project.js",
  "lib.js",
  "session-end.js",
  "task.js",
];

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

console.log(`Installed ${copied} context-harness scripts to ${path.relative(targetRoot, targetDir) || "scripts"}.`);
if (skipped > 0) {
  console.error(`Skipped ${skipped} existing non-context-harness scripts.`);
  process.exit(1);
}
