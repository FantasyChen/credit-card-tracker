"use strict";

// lib.js — shared helpers for context-harness scripts.
// All scripts in this directory should import from here to keep one source
// of truth for hook I/O, project detection, markdown parsing, and commands.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Hook I/O
// ---------------------------------------------------------------------------

function readHookInput() {
  // Claude Code passes the payload in TOOL_INPUT. Codex and other harnesses
  // tend to pipe JSON on stdin. Try env first, fall back to a synchronous stdin
  // read when stdin is non-TTY (i.e. piped).
  let raw = process.env.TOOL_INPUT || "";
  if (!raw && !process.stdin.isTTY) {
    try {
      raw = fs.readFileSync(0, "utf8");
    } catch {
      raw = "";
    }
  }
  try {
    return normalizeHookInput(JSON.parse(raw));
  } catch {
    return { command: raw, file_path: raw };
  }
}

function normalizeHookInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const normalized = { ...input };
  const toolInput =
    input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input)
      ? input.tool_input
      : {};

  normalized.command = firstString(input.command, toolInput.command);
  normalized.file_path = firstString(
    input.file_path,
    input.filePath,
    input.path,
    input.filename,
    toolInput.file_path,
    toolInput.filePath,
    toolInput.path,
    toolInput.filename
  );
  normalized.cwd = firstString(input.cwd, input.working_dir, input.working_directory, toolInput.cwd);

  return normalized;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function block(reason) {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function readJSONSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readTextSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function findProjectRoot(startDir) {
  const markers = [
    "CONTEXT.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    ".git",
  ];
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (markers.some((m) => fs.existsSync(path.join(current, m)))) return current;
    current = path.dirname(current);
  }
  return startDir;
}

// ---------------------------------------------------------------------------
// Stack detection
// ---------------------------------------------------------------------------

function detectStack(root) {
  const exists = (f) => fs.existsSync(path.join(root, f));
  let lang = "Unknown";
  let framework = "";
  let name = path.basename(root);
  let description = "";

  if (exists("package.json")) {
    const pkg = readJSONSafe(path.join(root, "package.json")) || {};
    name = pkg.name || name;
    description = pkg.description || "";
    lang = exists("tsconfig.json") ? "TypeScript" : "Node.js";
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    if (deps.next) framework = "Next.js";
    else if (deps["@nestjs/core"] || deps.nest) framework = "NestJS";
    else if (deps.react) framework = "React";
    else if (deps.vue) framework = "Vue";
    else if (deps.svelte) framework = "Svelte";
    else if (deps.hono) framework = "Hono";
    else if (deps.fastify) framework = "Fastify";
    else if (deps.express) framework = "Express";
  } else if (exists("pyproject.toml")) {
    const text = readTextSafe(path.join(root, "pyproject.toml"));
    lang = "Python";
    const nameMatch = text.match(/^\[project\][\s\S]*?name\s*=\s*["']([^"']*)["']/m);
    if (nameMatch) name = nameMatch[1];
    const descMatch = text.match(/^\s*description\s*=\s*["']([^"']*)["']/m);
    if (descMatch) description = descMatch[1];
    if (/\bdjango\b/i.test(text)) framework = "Django";
    else if (/\bfastapi\b/i.test(text)) framework = "FastAPI";
    else if (/\bflask\b/i.test(text)) framework = "Flask";
    else if (/\bstarlette\b/i.test(text)) framework = "Starlette";
  } else if (exists("Cargo.toml")) {
    const text = readTextSafe(path.join(root, "Cargo.toml"));
    lang = "Rust";
    const nameMatch = text.match(/^name\s*=\s*"([^"]*)"/m);
    if (nameMatch) name = nameMatch[1];
    const descMatch = text.match(/^description\s*=\s*"([^"]*)"/m);
    if (descMatch) description = descMatch[1];
    if (/\baxum\b/.test(text)) framework = "Axum";
    else if (/\bactix\b/.test(text)) framework = "Actix";
    else if (/\brocket\b/.test(text)) framework = "Rocket";
  } else if (exists("go.mod")) {
    const text = readTextSafe(path.join(root, "go.mod"));
    lang = "Go";
    const modMatch = text.match(/^module\s+(.+)$/m);
    if (modMatch) name = modMatch[1].trim().split("/").pop();
    if (/gin-gonic\/gin/.test(text)) framework = "Gin";
    else if (/labstack\/echo/.test(text)) framework = "Echo";
    else if (/gofiber\/fiber/.test(text)) framework = "Fiber";
  } else if (exists("Gemfile")) {
    lang = "Ruby";
    const text = readTextSafe(path.join(root, "Gemfile"));
    if (/\brails\b/.test(text)) framework = "Rails";
  }

  const tools = detectTools(root);
  return { name, description, lang, framework, tools, root };
}

function detectTools(root) {
  const tools = [];
  if (hasConfig(root, "biome")) tools.push("Biome");
  if (hasConfig(root, "prettier")) tools.push("Prettier");
  if (hasConfig(root, "eslint")) tools.push("ESLint");
  if (hasConfig(root, "ruff")) tools.push("Ruff");
  if (hasConfig(root, "jest")) tools.push("Jest");
  if (hasConfig(root, "vitest")) tools.push("Vitest");
  if (hasConfig(root, "pytest")) tools.push("Pytest");
  if (fs.existsSync(path.join(root, "Dockerfile"))) tools.push("Docker");
  if (fs.existsSync(path.join(root, ".github/workflows"))) tools.push("GitHub Actions");
  return tools;
}

function hasConfig(root, kind) {
  const exists = (f) => fs.existsSync(path.join(root, f));
  switch (kind) {
    case "biome":
      return exists("biome.json") || exists("biome.jsonc");
    case "prettier":
      return [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        ".prettierrc.cjs",
        ".prettierrc.mjs",
        ".prettierrc.yml",
        ".prettierrc.yaml",
        "prettier.config.js",
        "prettier.config.cjs",
        "prettier.config.mjs",
      ].some(exists);
    case "eslint":
      return [
        ".eslintrc",
        ".eslintrc.json",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.yml",
        ".eslintrc.yaml",
        "eslint.config.js",
        "eslint.config.cjs",
        "eslint.config.mjs",
        "eslint.config.ts",
      ].some(exists);
    case "ruff":
      if (exists("ruff.toml") || exists(".ruff.toml")) return true;
      return /\[tool\.ruff/.test(readTextSafe(path.join(root, "pyproject.toml")));
    case "black":
      return /\[tool\.black\]/.test(readTextSafe(path.join(root, "pyproject.toml")));
    case "pytest":
      if (exists("pytest.ini") || exists("conftest.py")) return true;
      return /\bpytest\b/.test(readTextSafe(path.join(root, "pyproject.toml")));
    case "jest":
      return exists("jest.config.js") || exists("jest.config.ts") || exists("jest.config.cjs");
    case "vitest":
      return exists("vitest.config.ts") || exists("vitest.config.js");
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Markdown section parsing
// ---------------------------------------------------------------------------

// Extract the lines under a given heading until the next heading of equal or
// lesser depth. `heading` is the heading text (no leading #).
function readSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`);
  const lines = markdown.split("\n");
  const out = [];
  let currentDepth = 0;
  let inSection = false;
  for (const line of lines) {
    const match = line.match(headingRe);
    if (match && !inSection) {
      inSection = true;
      currentDepth = match[1].length;
      continue;
    }
    if (inSection) {
      const boundary = line.match(/^(#{1,6})\s+/);
      if (boundary && boundary[1].length <= currentDepth) break;
      out.push(line);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

function runCheck(cmd, opts = {}) {
  const { cwd = process.cwd(), timeoutMs = 120000 } = opts;
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout: timeoutMs,
      shell: "/bin/bash",
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout: stdout || "", stderr: "" };
  } catch (err) {
    return {
      exitCode: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout ? err.stdout.toString() : "",
      stderr: err.stderr ? err.stderr.toString() : String(err.message || ""),
    };
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------

module.exports = {
  readHookInput,
  normalizeHookInput,
  block,
  readJSONSafe,
  readTextSafe,
  findProjectRoot,
  detectStack,
  detectTools,
  hasConfig,
  readSection,
  runCheck,
  today,
};
