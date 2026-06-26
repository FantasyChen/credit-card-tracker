#!/usr/bin/env node
"use strict";

// context-gen.js — auto-detect project metadata and emit CONTEXT.md sections.
// Usage: node scripts/context-gen.js [project-root]
// Output: Project + Structure + Suggested Rules + Suggested Workflow + Memory Prompts markdown.

const fs = require("fs");
const path = require("path");
const { detectStack } = require("./lib");

const root = path.resolve(process.argv[2] || ".");
const stack = detectStack(root);

// --- Project section --------------------------------------------------------

const parts = [stack.lang];
if (stack.framework) parts[0] = `${stack.lang} / ${stack.framework}`;
if (stack.tools.length) parts.push(stack.tools.join(", "));
const stackLine = parts.join(" + ");

let projectSentence = `${stack.name} is a ${stackLine} project.`;
if (stack.description) {
  projectSentence = `${stack.name} is a ${stackLine} project. ${stack.description}.`;
}

console.log("## Project");
console.log(projectSentence);
console.log("");

// --- Structure section ------------------------------------------------------

console.log("## Structure");
console.log("```");
for (const line of renderTree(root, 2)) console.log(line);
console.log("```");
const adrCount = countAdrs(root);
if (adrCount > 0) console.log(`Existing ADRs: ${adrCount}`);
console.log("");

// --- Suggested Rules section ------------------------------------------------

const rules = suggestedRules(stack);
console.log("## Suggested Rules");
console.log("");
console.log(`_Detected stack: ${stack.lang}${stack.framework ? ` / ${stack.framework}` : ""}. Present these to the user to confirm or edit._`);
console.log("");
console.log("### Never");
rules.never.forEach((r, i) => console.log(`${i + 1}. ${r}`));
console.log("");
console.log("### Always");
rules.always.forEach((r, i) => console.log(`${i + 1}. ${r}`));
console.log("");

// --- Suggested Workflow section --------------------------------------------

console.log("## Suggested Workflow");
console.log("");
console.log("_Use this to fill `CONTEXT.md` `## Workflow`; verification commands are project habits, not durable Objectives._");
console.log("");
console.log("### Verification");
rules.verification.forEach((r) => console.log(`- ${r}`));
console.log("");

// --- Memory Prompts section -------------------------------------------------

console.log("## Memory Prompts");
console.log("");
console.log("_Use these to capture durable human input and agent discoveries._");
console.log("");
console.log("- Keep `AGENTS.md` as the always-read Context Contract for Codex and compatible agents.");
console.log("- Add domain terms, canonical names, relationships, and resolved ambiguities to `CONTEXT.md` `## Language`.");
console.log("- Keep ordinary decisions in `PLAN.md`; use ADRs only when the project already has an ADR workflow.");
console.log("- For multi-context repositories, add `CONTEXT-MAP.md` only when one root `CONTEXT.md` becomes ambiguous.");
console.log("- Treat `.context-harness/DREAM.md` as an audit log only; do not read it during normal catch-up or task work.");

// ---------------------------------------------------------------------------

function renderTree(dir, maxDepth) {
  const skip = new Set([
    ".git",
    "node_modules",
    "__pycache__",
    ".next",
    "dist",
    "build",
    ".venv",
    "venv",
    "target",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".turbo",
  ]);
  const lines = ["."];
  walk(dir, 0);
  return lines;

  function walk(current, depth) {
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    const dirs = entries
      .filter((e) => e.isDirectory() && !skip.has(e.name))
      .map((e) => e.name)
      .sort();
    for (const name of dirs) {
      lines.push(`${"  ".repeat(depth)}${name}/`);
      walk(path.join(current, name), depth + 1);
    }
  }
}

function countAdrs(root) {
  const adrDir = path.join(root, "docs", "adr");
  try {
    return fs
      .readdirSync(adrDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^\d{4}-.+\.md$/.test(e.name)).length;
  } catch {
    return 0;
  }
}

function suggestedRules(stack) {
  const commonNever = [
    "Never store secrets or credentials in the repo",
    "Never ignore failing tests",
  ];
  const commonAlways = [
    "Always prefer CLI, MCP tools, or skills over browser automation when they can accomplish the task",
    "Always handle errors explicitly (no silent catches)",
  ];

  const verification = [
    "Run the project test command before completing code changes.",
    "Run the project lint/typecheck command when available.",
    "For UI changes, verify the changed screen or workflow manually or with browser automation.",
  ];

  const tsLike = (testCmd) => ({
    never: ["Never weaken `strict` mode in tsconfig.json", ...commonNever],
    always: [
      `Always run \`${testCmd}\` and \`tsc --noEmit\` before committing`,
      "Always write tests for new public functions",
      ...commonAlways,
    ],
    verification: [
      `${testCmd} exits 0`,
      "tsc --noEmit exits 0",
      "Changed UI routes render without console errors when applicable",
    ],
  });

  switch (stack.lang) {
    case "TypeScript":
      return tsLike(testCmdForNode(stack));
    case "Node.js":
      return {
        never: [
          "Never use `any` without a TODO justification",
          ...commonNever,
        ],
        always: [
          `Always run \`${testCmdForNode(stack)}\` and the linter before committing`,
          "Always write tests for new public functions",
          ...commonAlways,
        ],
        verification: [
          `${testCmdForNode(stack)} exits 0`,
          "The project lint command exits 0 when available",
          "Changed UI routes render without console errors when applicable",
        ],
      };
    case "Python":
      return {
        never: ["Never catch bare `Exception` without re-raising", ...commonNever],
        always: [
          "Always type-annotate public functions",
          "Always run `pytest` and `ruff check` before committing",
          ...commonAlways,
        ],
        verification: [
          "pytest exits 0",
          "ruff check exits 0",
          "Changed CLI/API workflows are exercised by a smoke check when applicable",
        ],
      };
    case "Go":
      return {
        never: ["Never ignore returned errors", ...commonNever],
        always: [
          "Always run `go test ./...` and `go vet ./...` before committing",
          "Always write table-driven tests",
          ...commonAlways,
        ],
        verification: [
          "go test ./... exits 0",
          "go vet ./... exits 0",
          "Changed CLI/API workflows are exercised by a smoke check when applicable",
        ],
      };
    case "Rust":
      return {
        never: ["Never use `unwrap()` on untrusted input", ...commonNever],
        always: [
          "Always run `cargo test` and `cargo clippy -- -D warnings` before committing",
          ...commonAlways,
        ],
        verification: [
          "cargo test exits 0",
          "cargo clippy -- -D warnings exits 0",
          "Changed CLI/API workflows are exercised by a smoke check when applicable",
        ],
      };
    case "Ruby":
      return {
        never: ["Never rescue `StandardError` without re-raising", ...commonNever],
        always: [
          "Always run `bundle exec rspec` and `rubocop` before committing",
          ...commonAlways,
        ],
        verification: [
          "bundle exec rspec exits 0",
          "rubocop exits 0",
          "Changed workflows are exercised by a smoke check when applicable",
        ],
      };
    default:
      return {
        never: [...commonNever, "Never disable or weaken type checking"],
        always: [
          ...commonAlways,
          "Always run the test suite and linter before committing",
          "Always write tests for new public functions",
        ],
        verification,
      };
  }
}

function testCmdForNode(stack) {
  if (stack.tools.includes("Vitest")) return "npx vitest run";
  if (stack.tools.includes("Jest")) return "npx jest";
  return "npm test";
}
