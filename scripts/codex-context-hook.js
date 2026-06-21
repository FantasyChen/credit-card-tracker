#!/usr/bin/env node
"use strict";

// codex-context-hook.js — lifecycle nudges for Codex.
// Hooks do not run skills directly; they add compact context so the active
// agent invokes context-catch-up, context-init, or context-maintain at the right
// moment.

import fs from "fs";
import path from "path";
import { readHookInput, readTextSafe, findProjectRoot } from "./lib.js";

const mode = readArg("--mode") || "catch-up";
const input = readHookInput();
const cwd = path.resolve(input.cwd || process.cwd());

try {
  if (mode === "catch-up") runCatchUp(cwd);
  else if (mode === "init") runInit(cwd);
  else if (mode === "maintain") runMaintain(cwd);
} catch {
  // Context hooks are best-effort. They should never break ordinary Codex work.
}

process.exit(0);

// ---------------------------------------------------------------------------

function runCatchUp(startDir) {
  const root = findContextRoot(startDir);
  if (!root) return;

  const agents = readTextSafe(path.join(root, "AGENTS.md"));
  const context = readTextSafe(path.join(root, "CONTEXT.md"));
  const now = trimForHook(readTextSafe(path.join(root, "NOW.md")), 1400);
  const needsUpgrade = !hasSupportedSchema(agents) || !hasSupportedSchema(context) || !hasContextIndex(agents) || !context.trim();
  emitAdditionalContext(
    [
      "context-harness detected.",
      needsUpgrade
        ? "Before planning/editing: use context-catch-up Compatibility Upgrade; preserve context, add schema marker, install scripts, refresh AGENTS index."
        : "Before planning/editing: use context-catch-up; read NOW.md, then relevant AGENTS-indexed CONTEXT.md sections.",
      now ? `Current NOW.md:\n${now}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

function runInit(startDir) {
  if (findContextRoot(startDir)) return;

  const projectRoot = findProjectRoot(startDir);
  if (!looksLikeProject(projectRoot)) return;

  emitAdditionalContext(
    [
      "No context-harness files were found for this project.",
      "Before substantial work: use context-init to create AGENTS.md, CONTEXT.md, NOW.md, optional PLAN.md.",
      "For tiny one-off commands, continue without initialization.",
    ].join("\n")
  );
}

function runMaintain(startDir) {
  const root = findContextRoot(startDir);
  if (!root) return;

  emitAdditionalContext(
    [
      "Before ending substantial work: use context-maintain.",
      "Update NOW.md; route durable info to CONTEXT.md and task-local info to PLAN.md.",
      "If CONTEXT.md changed, run `node scripts/context-index.js update`.",
    ].join("\n")
  );
}

function findContextRoot(startDir) {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    const hasContext = fs.existsSync(path.join(current, "CONTEXT.md"));
    const hasNow = fs.existsSync(path.join(current, "NOW.md"));
    const hasAgents = fs.existsSync(path.join(current, "AGENTS.md"));
    if (hasContext && (hasNow || hasAgents)) return current;
    current = path.dirname(current);
  }
  return null;
}

function looksLikeProject(root) {
  if (!root || root === path.dirname(root)) return false;
  return [
    ".git",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
  ].some((marker) => fs.existsSync(path.join(root, marker)));
}

function trimForHook(text, maxChars) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}\n...`;
}

function hasSupportedSchema(text) {
  return /<!--\s*context-harness:schema\s+v[23]\s*-->/.test(text);
}

function hasContextIndex(text) {
  return /<!--\s*context-harness:index:start\s*-->/.test(text);
}

function emitAdditionalContext(additionalContext) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name || eventNameForMode(mode),
        additionalContext,
      },
    })
  );
}

function eventNameForMode(value) {
  if (value === "catch-up") return "SessionStart";
  if (value === "init") return "UserPromptSubmit";
  if (value === "maintain") return "Stop";
  return "";
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}
