#!/usr/bin/env node
"use strict";

// task.js — minimal task switcher that enforces the NOW.md contract.
//   node scripts/task.js start "<title>"
//   node scripts/task.js done
//
// start: rewrites NOW.md with a fresh focus; if PLAN.md exists, logs the
//        prior focus in Progress as a switched-away line.
// done:  marks NOW.md idle; if PLAN.md exists, appends a `- [x]` line with
//        today's date.

const fs = require("fs");
const path = require("path");

const cmd = process.argv[2];
const arg = process.argv.slice(3).join(" ").trim();
const root = process.cwd();
const nowPath = path.join(root, "NOW.md");
const planPath = path.join(root, "PLAN.md");

if (cmd === "start") {
  if (!arg) fail("Usage: task.js start \"<title>\"");
  startTask(arg);
} else if (cmd === "done") {
  doneTask();
} else {
  fail("Usage: task.js start \"<title>\" | task.js done");
}

// ---------------------------------------------------------------------------

function startTask(title) {
  const priorFocus = readFocus();
  if (priorFocus && priorFocus !== "(none)" && fs.existsSync(planPath)) {
    appendProgress(`- [~] ${priorFocus} (switched away ${today()})`);
  }
  writeNow(title);
  console.log(`[task] started: ${title}`);
}

function doneTask() {
  const focus = readFocus();
  if (focus && focus !== "(none)" && fs.existsSync(planPath)) {
    appendProgress(`- [x] ${focus} (done ${today()})`);
  }
  writeNow("(none)");
  console.log(`[task] done: ${focus || "(no prior focus)"}`);
}

function readFocus() {
  if (!fs.existsSync(nowPath)) return null;
  const content = fs.readFileSync(nowPath, "utf8");
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => /^##\s+Current Focus/i.test(l));
  if (idx === -1) return null;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    const t = lines[i].trim();
    if (t) return t;
  }
  return null;
}

function writeNow(focus) {
  const iso = new Date().toISOString();
  const content = [
    "# Now",
    "",
    "## Current Focus",
    focus,
    "",
    "## Active Blockers",
    "- None.",
    "",
    "## Immediate Next Step",
    focus === "(none)" ? "Pick a task or review PLAN.md." : "Begin work on the task above.",
    "",
    "## Session State",
    `- Last modified: ${iso}`,
    "- Files touched: (none yet)",
    "",
  ].join("\n");
  fs.writeFileSync(nowPath, content);
}

function appendProgress(line) {
  const content = fs.readFileSync(planPath, "utf8");
  const lines = content.split("\n");
  const progressIdx = lines.findIndex((l) => /^##\s+Progress/i.test(l));
  if (progressIdx === -1) {
    fs.appendFileSync(planPath, `\n${line}\n`);
    return;
  }
  let insertAt = progressIdx + 1;
  for (let i = insertAt; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    insertAt = i + 1;
  }
  lines.splice(insertAt, 0, line);
  fs.writeFileSync(planPath, lines.join("\n"));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
