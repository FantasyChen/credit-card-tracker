#!/usr/bin/env node
"use strict";

// format-on-edit.js — PostToolUse hook: auto-format edited files.
// Exit: always 0 (formatting is best-effort, never blocks).

const { execSync } = require("child_process");
const { existsSync } = require("fs");
const { extname, dirname } = require("path");
const { readHookInput, findProjectRoot, hasConfig } = require("./lib");

const input = readHookInput();
const filePath = (input.file_path || "").trim();

if (!filePath || !existsSync(filePath)) process.exit(0);

const ext = extname(filePath);
const projectRoot = findProjectRoot(dirname(filePath));

try {
  const formatter = detectFormatter(projectRoot, ext);
  if (formatter) {
    execSync(formatter.replace("{file}", filePath), {
      cwd: projectRoot,
      stdio: "ignore",
      timeout: 10000,
    });
  }
} catch {
  // Silent — formatting failure never blocks work.
}

process.exit(0);

// ---------------------------------------------------------------------------

function detectFormatter(root, ext) {
  const jsExts = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
  const webExts = new Set([...jsExts, ".json", ".css", ".html", ".md"]);

  if (webExts.has(ext) && hasConfig(root, "biome")) {
    return 'npx biome format --write "{file}"';
  }
  if (webExts.has(ext) && hasConfig(root, "prettier")) {
    return 'npx prettier --write "{file}"';
  }
  if (ext === ".rs") return 'rustfmt "{file}"';
  if (ext === ".py") {
    if (hasConfig(root, "ruff")) return 'ruff format "{file}"';
    if (hasConfig(root, "black")) return 'black "{file}"';
  }
  if (ext === ".go") return 'gofmt -w "{file}"';
  if ([".c", ".cpp", ".h", ".hpp"].includes(ext) && existsSync(`${root}/.clang-format`)) {
    return 'clang-format -i "{file}"';
  }
  return null;
}
