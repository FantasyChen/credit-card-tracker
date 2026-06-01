#!/usr/bin/env node
"use strict";

// eval-loop.js — lightweight GAN-style evaluator.
// Parses 3 Objectives from CONTEXT.md, runs testable commands, loops.
//
// Usage: node scripts/eval-loop.js [pre-command]
// Env vars:
//   MAX_ITERATIONS=5         Max evaluation loops (default: 5)
//   PASS_THRESHOLD=all       "all" | integer — how many must pass to stop
//   CONTEXT_FILE=CONTEXT.md  Path to context file
//
// Exit: 0 if objectives met, 1 otherwise.

const fs = require("fs");
const readline = require("readline");
const { readSection, runCheck } = require("./lib");

const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || "5", 10);
const PASS_THRESHOLD = process.env.PASS_THRESHOLD || "all";
const CONTEXT_FILE = process.env.CONTEXT_FILE || "CONTEXT.md";
const PRE_COMMAND = process.argv[2] || "";

if (!fs.existsSync(CONTEXT_FILE)) {
  console.error(`[eval-loop] ERROR: ${CONTEXT_FILE} not found`);
  process.exit(1);
}

const markdown = fs.readFileSync(CONTEXT_FILE, "utf8");
const objectivesBlock = readSection(markdown, "Objectives");
const objectives = parseObjectives(objectivesBlock);

if (objectives.length === 0) {
  console.error(`[eval-loop] ERROR: No objectives found in ${CONTEXT_FILE} under ### Objectives`);
  process.exit(1);
}

console.log(`[eval-loop] Found ${objectives.length} objectives:`);
objectives.forEach((o, i) => console.log(`  ${i + 1}. ${o.text}`));
console.log("");

(async () => {
  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    console.log("=========================================");
    console.log(`[eval-loop] Iteration ${iter}/${MAX_ITERATIONS}`);
    console.log("=========================================");

    if (PRE_COMMAND && iter === 1) {
      console.log(`[eval-loop] Running: ${PRE_COMMAND}`);
      runCheck(PRE_COMMAND);
      console.log("");
    }

    let passed = 0;
    let failed = 0;
    let manual = 0;
    const failDetails = [];

    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      if (!obj.command) {
        console.log(`  Objective ${i + 1}: ${obj.text} ... MANUAL CHECK`);
        manual++;
        continue;
      }
      process.stdout.write(`  Objective ${i + 1}: ${obj.text} ... `);
      const result = runCheck(obj.command);
      if (result.exitCode === obj.expected) {
        console.log("PASS");
        passed++;
      } else {
        console.log(`FAIL (exit ${result.exitCode}, expected ${obj.expected})`);
        failed++;
        failDetails.push(`  Objective ${i + 1}: ${obj.text} (exit ${result.exitCode})`);
      }
    }

    console.log("");
    console.log(`[eval-loop] Results: ${passed} passed, ${failed} failed, ${manual} manual`);

    let thresholdMet = false;
    if (PASS_THRESHOLD === "all") {
      thresholdMet = failed === 0;
    } else {
      thresholdMet = passed >= parseInt(PASS_THRESHOLD, 10);
    }

    if (thresholdMet) {
      console.log("[eval-loop] All objectives met. Done.");
      process.exit(0);
    }

    if (iter < MAX_ITERATIONS) {
      console.log("");
      console.log("[eval-loop] Failed objectives:");
      for (const d of failDetails) console.log(d);
      console.log("");
      console.log("[eval-loop] Fix the failures and re-run, or press Ctrl+C to stop.");
      if (process.stdin.isTTY) {
        await prompt("[eval-loop] Press Enter to re-evaluate... ");
      }
    }
  }

  console.log("");
  console.log(`[eval-loop] Max iterations (${MAX_ITERATIONS}) exhausted. Objectives not fully met.`);
  process.exit(1);
})();

// ---------------------------------------------------------------------------

function parseObjectives(block) {
  const out = [];
  const lines = block.split("\n");
  for (const raw of lines) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1];
    const cmdMatch = text.match(/\((.+?)\s+exits\s+(\d+)\)/);
    if (cmdMatch) {
      out.push({ text, command: cmdMatch[1].trim(), expected: parseInt(cmdMatch[2], 10) });
    } else {
      out.push({ text, command: null, expected: null });
    }
  }
  return out;
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}
