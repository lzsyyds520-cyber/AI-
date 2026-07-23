# Usage

## What This Agent Reuses

The existing PredX testing workflow remains the source of truth:

1. Requirements and PRD define what should be tested.
2. Test cases define IDs, modules, steps, expected results, and automation level.
3. Playwright scripts execute the covered cases.
4. Reports record the latest result, evidence, and failure classification.
5. Bug records preserve product defects and current status.

The Agent does not replace the Playwright scripts. It coordinates them, checks coverage, classifies failures, and keeps reports aligned.

## Daily Human Workflow

From `/Users/frankzhang/Documents/New project/predx-ui-qa`:

```bash
npm run run:daily
npm run workbench
```

Then open `workbench/test-cases.html` to inspect the categorized case library.

## AI-Assisted Workflow

Ask Codex with the skill explicitly:

```text
Use $predx-qa-agent to run the PredX daily regression, triage failures, and update the QA report.
```

For focused work:

```text
Use $predx-qa-agent to add coverage for TC-NEWS-016 and update the workbench.
```

```text
Use $predx-qa-agent to classify the latest failed cases as product bug, script issue, data drift, environment gap, or manual-only.
```

## Workbench Workflow

Use the generated workbench for browsing and review:

- Left rail: switch between case library, runs, bugs, reports, and knowledge areas.
- Case library: filter by product module.
- Execution status: filter passed, review, failed, or conditional cases.
- Flow level: filter by F01-F10 coverage model.
- Main table: inspect case ID, module, priority, status, expected result, command, script mapping, and note.

## When To Update What

- New PRD behavior: update test cases first, then scripts.
- New automated script: update case mapping and workbench.
- Failed run: inspect evidence, classify failure, update report.
- Product bug confirmed: create or update bug record.
- Script instability confirmed: fix selector, wait, fixture, or route assertion, then rerun targeted test.
