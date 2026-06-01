#!/usr/bin/env node
"use strict";

// guard.js — PreToolUse security hook.
// Blocks --no-verify, detects secrets, protects linter configs.
// Exit: 0 = allow, 2 = block.

const { readHookInput, block } = require("./lib");

const toolInput = readHookInput();
const command = toolInput.command || "";
const filePath = toolInput.file_path || "";

// --- 1. Block --no-verify / --no-gpg-sign in git commands ------------------

if (/\bgit\b/.test(command)) {
  if (/--no-verify/.test(command)) {
    block("--no-verify bypasses commit hooks. Remove it and fix the underlying issue.");
  }
  if (/--no-gpg-sign/.test(command)) {
    block("--no-gpg-sign bypasses commit signing. Remove it.");
  }
  if (/-c\s+core\.hooksPath=/.test(command)) {
    block("Overriding core.hooksPath bypasses repository hooks.");
  }
}

// --- 2. Detect secrets in tool input ---------------------------------------

const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/ },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
  { name: "GitHub PAT", pattern: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: "JWT", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
  { name: "Private Key", pattern: /-----BEGIN\s+(RSA\s+|EC\s+)?PRIVATE\s+KEY-----/ },
  { name: "Slack Token", pattern: /xox[bpors]-[A-Za-z0-9-]{10,}/ },
  { name: "Generic Secret Assignment", pattern: /(?:password|secret|token|api_key)\s*=\s*['"][^'"]{8,}['"]/ },
];

const fullInput = JSON.stringify(toolInput);
for (const { name, pattern } of SECRET_PATTERNS) {
  if (pattern.test(fullInput)) {
    block(`Potential ${name} detected in tool input. Do not hardcode secrets.`);
  }
}

// --- 3. Protect linter config files ----------------------------------------

const PROTECTED_CONFIGS = [
  /\.eslintrc/,
  /eslint\.config\./,
  /\.prettierrc/,
  /prettier\.config\./,
  /biome\.json/,
  /biome\.jsonc/,
  /\.ruff\.toml/,
  /ruff\.toml/,
  /\.markdownlint/,
  /\.shellcheckrc/,
];

if (filePath) {
  for (const pattern of PROTECTED_CONFIGS) {
    if (pattern.test(filePath)) {
      block(
        `Modifying ${filePath} is blocked. Fix the code to pass the linter, don't weaken the linter.`
      );
    }
  }
}

process.exit(0);
