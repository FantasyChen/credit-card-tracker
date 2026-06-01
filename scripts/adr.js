#!/usr/bin/env node
"use strict";

// adr.js — create a tiny numbered Architecture Decision Record.
// Usage: node scripts/adr.js "<decision title>"

const fs = require("fs");
const path = require("path");
const { today } = require("./lib");

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: adr.js "<decision title>"');
  process.exit(1);
}

const adrDir = path.join(process.cwd(), "docs", "adr");
fs.mkdirSync(adrDir, { recursive: true });

const next = nextNumber(adrDir);
const slug = slugify(title);
const file = path.join(adrDir, `${String(next).padStart(4, "0")}-${slug}.md`);
const date = today();

const content = [
  `# ${title}`,
  "",
  `Date: ${date}`,
  "",
  "## Context",
  "[Why this decision is needed. Include the trade-off, not the whole history.]",
  "",
  "## Decision",
  "[What we decided.]",
  "",
  "## Consequences",
  "[What this enables, costs, or rules out.]",
  "",
].join("\n");

fs.writeFileSync(file, content);
console.log(file);

function nextNumber(dir) {
  const nums = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name.match(/^(\d{4})-/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "decision";
}
