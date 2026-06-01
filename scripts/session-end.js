#!/usr/bin/env node
"use strict";

// session-end.js — Stop-event hook: enforce the NOW.md / PLAN.md contract at
// the end of every session. Best-effort, never blocks (always exits 0).
// - Rewrites NOW.md `Last modified:` to the current ISO timestamp.
// - Prunes PLAN.md: when the file exceeds 150 lines, moves completed `- [x]`
//   items from `## Progress` into `## Archive` with a date suffix.

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const nowPath = path.join(root, "NOW.md");
const planPath = path.join(root, "PLAN.md");

try {
  if (fs.existsSync(nowPath)) touchNow(nowPath);
} catch {
  // best-effort
}

try {
  if (fs.existsSync(planPath)) prunePlan(planPath);
} catch {
  // best-effort
}

process.exit(0);

// ---------------------------------------------------------------------------

function touchNow(file) {
  const content = fs.readFileSync(file, "utf8");
  const iso = new Date().toISOString();
  const lines = content.split("\n");
  let touched = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-?\s*Last modified\s*:/i.test(lines[i])) {
      lines[i] = `- Last modified: ${iso}`;
      touched = true;
      break;
    }
  }
  if (!touched) return; // NOW.md doesn't follow the template — skip silently
  fs.writeFileSync(file, lines.join("\n"));
}

function prunePlan(file) {
  const content = fs.readFileSync(file, "utf8");
  if (content.split("\n").length <= 150) return;

  const lines = content.split("\n");
  const sections = indexHeadings(lines);
  const progress = sections["Progress"];
  if (!progress) return;

  const completed = [];
  const remaining = [];
  for (let i = progress.start + 1; i < progress.end; i++) {
    const line = lines[i];
    if (/^\s*-\s*\[x\]/i.test(line)) {
      completed.push(line.replace(/^\s*-\s*\[x\]\s*/i, "").trim());
    } else {
      remaining.push(line);
    }
  }
  if (completed.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const archiveEntries = completed.map((c) => `- ${c} (archived ${date})`);

  const archive = sections["Archive"];
  const next = archive
    ? rebuildSections(lines, progress, remaining, archive, archiveEntries)
    : [
        ...lines.slice(0, progress.start + 1),
        ...remaining,
        ...lines.slice(progress.end),
        "",
        "## Archive",
        ...archiveEntries,
      ];

  fs.writeFileSync(file, next.join("\n"));
}

// Build a new line array with Progress shrunk to `remaining` and Archive
// extended by `newEntries`. Works regardless of which section comes first.
function rebuildSections(lines, progress, remaining, archive, newEntries) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === progress.start) {
      out.push(lines[i]);
      out.push(...remaining);
      i = progress.end - 1;
    } else if (i === archive.start) {
      out.push(lines[i]);
      for (let j = archive.start + 1; j < archive.end; j++) out.push(lines[j]);
      out.push(...newEntries);
      i = archive.end - 1;
    } else {
      out.push(lines[i]);
    }
  }
  return out;
}

function indexHeadings(lines) {
  const result = {};
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) current.end = i;
      current = { heading: m[1], start: i, end: lines.length };
      result[m[1]] = current;
    }
  }
  if (current) current.end = lines.length;
  return result;
}
