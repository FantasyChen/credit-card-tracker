#!/usr/bin/env node
"use strict";

// install-project.js — copy context-harness runtime scripts into a target repo.
// Usage:
//   node <context-harness>/scripts/install-project.js [project-root]

const fs = require("fs");
const path = require("path");

const sourceDir = __dirname;
const { targetRoot } = parseArgs(process.argv.slice(2));
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
const scriptNames = coreScriptNames;

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
    if (current === next || isContextHarnessRuntime(current, name)) {
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

const packageJsonTarget = path.join(targetDir, "package.json");
const packageJsonContent = `${JSON.stringify({
  private: true,
  type: "commonjs",
  description: "context-harness runtime scripts"
}, null, 2)}\n`;
if (!fs.existsSync(packageJsonTarget) || readPackageType(packageJsonTarget) !== "commonjs") {
  fs.writeFileSync(packageJsonTarget, packageJsonContent);
  copied += 1;
}

console.log(`Installed ${copied} context-harness scripts to ${path.relative(targetRoot, targetDir) || "scripts"}.`);
if (skipped > 0) {
  console.error(`Skipped ${skipped} existing non-context-harness scripts.`);
  process.exit(1);
}

function parseArgs(args) {
  let rootArg = "";
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      usage(0);
    }
    if (arg.startsWith("-")) {
      console.error(`Unknown argument: ${arg}`);
      usage(1);
    }
    if (rootArg) {
      console.error(`Unexpected extra argument: ${arg}`);
      usage(1);
    }
    rootArg = arg;
  }
  return { targetRoot: path.resolve(rootArg || process.cwd()) };
}

function usage(code) {
  console.error("Usage: install-project.js [project-root]");
  process.exit(code);
}

function readPackageType(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")).type || "";
  } catch {
    return "";
  }
}

function isContextHarnessRuntime(text, name) {
  return text.includes("context-harness")
    || text.includes(`${name} —`)
    || text.includes(`${name} -`);
}
