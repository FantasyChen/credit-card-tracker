---
name: session-recap
description: Self-reflect on the current chat session, summarize changes made, and update project documentation (AGENTS.md, VERSION_HISTORY.md). Use when the user asks to summarize, recap, reflect on, or document what was done in this session, or asks to update docs/documentation after making changes.
---

# Session Recap & Documentation Update

Reflect on the current chat session, produce a structured summary, and update the project's documentation to keep it in sync with reality.

## Workflow

### Step 1: Gather Context

Collect what happened in this session. Sources to check:

1. **Conversation history** — review your own tool calls, file edits, and user messages
2. **Git diff** — run `git diff --stat` and `git diff` to see all uncommitted changes
3. **Recent commits** — run `git log --oneline -10` if commits were made this session
4. **Agent transcript** — if the conversation summary is insufficient, search the transcript file (path is in the system prompt under `agent_transcripts`) for specific details

### Step 2: Produce the Session Summary

Output a structured summary to the user covering:

```
## Session Summary

### What Changed
- Bullet list of concrete changes (files modified, features added, bugs fixed)

### Why
- Root cause or motivation for the changes

### Key Decisions
- Architectural or design decisions made and their rationale

### Testing
- What was tested and how (local curl, build, lint, etc.)

### Risk / Follow-ups
- Anything left incomplete, deferred, or worth monitoring
```

Keep it concise — a few bullets per section, not paragraphs.

### Step 3: Decide What Documentation to Update

Use this decision table:

| Change type | Update AGENTS.md? | Update .cursor/rules/? |
|---|---|---|
| New feature or page | Yes — add to Features, Architecture, or Roadmap | Rarely |
| Bug fix or perf improvement | Yes — add to Recent Updates | No |
| Schema / migration change | Yes — update Schema section | No |
| New script or workflow | Yes — update Scripts Reference | Maybe |
| Infra / deployment change | Yes — update Deployment section | Maybe |
| New dev pattern or safety rule | Yes — update Guidelines | Yes |
| Lesson learned / incident | Yes — note in relevant section | Yes — if it should prevent recurrence |

**VERSION_HISTORY.md**: Only update when the user explicitly requests it.

When unsure, default to updating AGENTS.md — it is the primary AI reference.

### Step 4: Update AGENTS.md

Read `AGENTS.md` first. Then apply changes:

1. **Recent Updates section** (near the bottom): Prepend a new entry using the existing format:
   ```markdown
   ### Month Year: Short Title
   **Date**: Month Year
   **Implementation Status**: ✅ Complete

   **Changes Implemented**:
   - **Item**: Description
   - **Item**: Description

   ---
   ```
2. **Other sections**: Update any section whose content is now stale (Architecture, Scripts, Features, Schema, Deployment, etc.). Only touch sections affected by this session's changes.
3. **Version number**: Bump the `*Version: X.XX*` line at the bottom if a Recent Updates entry was added. Use minor bump (e.g., 1.18 → 1.19).
4. **Last Updated date**: Update the `*Last Updated:` line.

### Step 5: Update VERSION_HISTORY.md (only when explicitly requested)

**Do NOT update VERSION_HISTORY.md unless the user explicitly asks for it.** Version bumps are user-initiated — the user decides when and how to announce changes to end users. If you think a version bump is warranted, mention it in the summary but do not write it.

### Step 6: Update .cursor/rules/ (if applicable)

Only if the session established a new safety rule or recurring pattern that future agents should always follow. Create or edit a `.mdc` file in `.cursor/rules/`.

### Step 7: Confirm with User

Present the summary and list which docs you plan to update. Wait for user approval before writing. The user may want to adjust wording, skip certain updates, or add context you missed.

## Important Guidelines

- **Read before writing**: Always read the target file before editing to avoid overwriting recent changes.
- **Preserve existing content**: Add or edit sections — never delete existing entries unless they are factually wrong.
- **Match existing style**: Copy the tone, heading level, and formatting of surrounding entries.
- **Don't duplicate the version-update-notes skill**: If the user explicitly asks for a version note, defer to that skill. This skill covers the broader documentation update.
- **Be honest about gaps**: If something was left incomplete or a known issue exists, document it in the "Risk / Follow-ups" section rather than omitting it.
