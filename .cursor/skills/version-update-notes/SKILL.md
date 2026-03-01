---
name: version-update-notes
description: Generate CouponCycle version update notes in Chinese (一行格式) and track versions. Use when the user asks for a version note, release note, update note, 更新说明, 版本说明, or to add or bump a version.
---

# Version Update Notes (CouponCycle)

Generate release/version update text in the project's standard format and keep [VERSION_HISTORY.md](VERSION_HISTORY.md) in sync.

## Format

- **One line per version**: `V主.次: 简短中文描述（可多句，逗号/句号分隔）`
- **Style**: 中文、口语化、面向用户（坛友/用户），不要英文技术术语堆砌；可多句说明，用逗号或句号分隔。
- **Current version** and full history: see [VERSION_HISTORY.md](VERSION_HISTORY.md). Always read it before generating or appending.

## When User Asks for an Update Note

1. **Read** [VERSION_HISTORY.md](VERSION_HISTORY.md) to get current version (e.g. v1.14) and recent entries for style.
2. **Summarize** the changes from the conversation or from context (e.g. new feature, bugfix, UI change) in Chinese.
3. **Output** one line in the same format as existing entries, e.g.:
   - `V1.15：简短描述功能或修复，可再补一句说明。`
4. If the user wants it **recorded**, add the new line to the top of the "历史记录 / History" section in VERSION_HISTORY.md and bump "当前版本 / Current version" to the new version (e.g. v1.15).

## When User Asks to Bump Version or "Add This as vX.XX"

1. **Read** [VERSION_HISTORY.md](VERSION_HISTORY.md).
2. Determine next version: if current is v1.14, next is v1.15 (or use the version the user specified).
3. **Prepend** the new entry to the history list in VERSION_HISTORY.md (below the "历史记录 / History" heading).
4. **Update** the "当前版本 / Current version" line to the new version.

## Examples (style reference)

From history:

- `V1.14：支持福利部分完成追踪，并精简视图选项。福利可记录部分使用金额（如 $30/$50）、显示进度条，ROI 按实际使用金额计算；新增「Mark Complete」与「Partial Complete」按钮。福利展示仅保留「按信用卡分组」与「按类别分组」，移除列表视图。`
- `V1.12: 优化卡片添加/编辑页面：可折叠福利展示、智能提示工具、信用卡昵称功能，界面更简洁易用`
- `V1.5: 将按钮替换为三个独立的视图按钮（列表视图、按类别分组、按信用卡分组），并移除了拖拽重排功能，使界面更清晰直观。`

Keep the same tone: 简短、清晰、用户向。
