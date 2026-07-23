# Reporting

## Daily Report Shape

Use this structure for daily output:

1. Summary: target, run time, environment, total cases, passed, failed, skipped, blocked.
2. High-risk failures: P0/P1 issues with case ID, module, reproduction path, evidence, current conclusion.
3. Full case table: case ID, module, scenario, automation status, result, evidence, note.
4. Conditional automation table: case ID, required condition, current condition state, priority, next action.
5. Bug list: bug ID, severity, reproduction path, expected, actual, owner/status if known.

## Result Marking

When the user asks for simple status symbols, use only:

- `✅` for passed
- `❌` for failed
- `⏭` for skipped
- `⚠️` for blocked or needs condition

Avoid embedding HTML in Markdown tables unless the user explicitly asks for styled HTML.

## Coverage Language

Separate these counts:

- Test-case inventory: all designed cases.
- Automated coverage: cases with executable scripts.
- Daily run coverage: cases included in the current daily command.
- Passed coverage: daily run cases that passed in the latest execution.
