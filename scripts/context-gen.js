#!/usr/bin/env node
"use strict";

// context-gen.js — auto-detect project metadata and emit CONTEXT.md sections.
// Usage: node scripts/context-gen.js [project-root]
// Output: Project + Structure + Suggested Rules + Memory Prompts markdown.

import fs from "fs";
import path from "path";
import { detectStack } from "./lib.js";

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
console.log("### Objectives");
console.log("");
console.log("_Outcome-level goals that determine whether the project succeeds at its purpose._");
console.log("_Not auto-filled — ask the user. Hygiene (tests pass, lint clean) belongs in Always._");
console.log("_Prefer verifiable form: `<outcome> (<command> exits 0)`. Observable-only is OK if unavoidable._");
console.log("");
console.log("Examples of the right altitude:");
rules.objectiveExamples.forEach((r) => console.log(`- _e.g._ ${r}`));
console.log("");
console.log("1. [Outcome — what does success look like for THIS project?]");
console.log("2. [Outcome]");
console.log("3. [Outcome]");
console.log("");

// --- Memory Prompts section -------------------------------------------------

console.log("## Memory Prompts");
console.log("");
console.log("_Use these to capture durable human input and agent discoveries._");
console.log("");
console.log("- Keep `AGENTS.md` as the always-read Context Contract for Codex and compatible agents.");
console.log("- Add domain terms, canonical names, relationships, and resolved ambiguities to `CONTEXT.md` `## Language`.");
console.log("- Add surprising or hard-to-reverse trade-off decisions as tiny ADRs in `docs/adr/`.");
console.log("- For multi-context repositories, add `CONTEXT-MAP.md` only when one root `CONTEXT.md` becomes ambiguous.");

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

  // Outcome-level examples shown to the user as altitude guides — not
  // filled into the Objectives list. The user defines actual objectives.
  const objectiveExamples = [
    "Users can complete <core workflow> end-to-end on a fresh install (tests/smoke.sh exits 0)",
    "Public API surface stays stable across minor versions (scripts/api-diff.js exits 0)",
    "Docs cover every public entry point (scripts/doc-coverage.js exits 0)",
  ];

  const tsLike = (testCmd) => ({
    never: ["Never weaken `strict` mode in tsconfig.json", ...commonNever],
    always: [
      `Always run \`${testCmd}\` and \`tsc --noEmit\` before committing`,
      "Always write tests for new public functions",
      ...commonAlways,
    ],
    objectiveExamples,
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
        objectiveExamples,
      };
    case "Python":
      return {
        never: ["Never catch bare `Exception` without re-raising", ...commonNever],
        always: [
          "Always type-annotate public functions",
          "Always run `pytest` and `ruff check` before committing",
          ...commonAlways,
        ],
        objectiveExamples,
      };
    case "Go":
      return {
        never: ["Never ignore returned errors", ...commonNever],
        always: [
          "Always run `go test ./...` and `go vet ./...` before committing",
          "Always write table-driven tests",
          ...commonAlways,
        ],
        objectiveExamples,
      };
    case "Rust":
      return {
        never: ["Never use `unwrap()` on untrusted input", ...commonNever],
        always: [
          "Always run `cargo test` and `cargo clippy -- -D warnings` before committing",
          ...commonAlways,
        ],
        objectiveExamples,
      };
    case "Ruby":
      return {
        never: ["Never rescue `StandardError` without re-raising", ...commonNever],
        always: [
          "Always run `bundle exec rspec` and `rubocop` before committing",
          ...commonAlways,
        ],
        objectiveExamples,
      };
    default:
      return {
        never: [...commonNever, "Never disable or weaken type checking"],
        always: [
          ...commonAlways,
          "Always run the test suite and linter before committing",
          "Always write tests for new public functions",
        ],
        objectiveExamples,
      };
  }
}

function testCmdForNode(stack) {
  if (stack.tools.includes("Vitest")) return "npx vitest run";
  if (stack.tools.includes("Jest")) return "npx jest";
  return "npm test";
}
