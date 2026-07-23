---
name: predx-qa-agent
description: Run and maintain PredX Pro Playwright QA automation as a testing workbench agent. Use when the user asks for PredX automated regression, daily testing, test case coverage, condition-based automation, login/order safety flows, bug triage, execution reports, or converting captured product behavior into repeatable QA scripts.
---

# PredX QA Agent

## Overview

Use this skill to operate the PredX QA project as a structured testing workbench rather than a pile of Playwright commands. Keep the loop anchored on test assets, execution evidence, defect classification, and report updates.

## Project Context

- Default local project root: `/Users/frankzhang/Documents/New project/predx-ui-qa`
- Primary target: `https://predx.pro`
- Main runner: Playwright
- Default safety posture: no real trade submission, no wallet signature automation, no secret commits
- Important local-only folders: `.auth/`, `test-results/`, `playwright-report/`, `artifacts/`

## Workbench Modules

Map requests into these modules before acting:

1. Test assets: PRD, test-case tables, coverage matrix, fixtures, known stable sample URLs.
2. Collection: page observation, network/API capture, selector discovery, response shape checks.
3. Execution: smoke, guest regression, conditional automation, authenticated safe flows.
4. Defect triage: classify failure as product bug, script instability, data drift, environment/auth gap, or intentionally manual.
5. Reporting: daily report, bug list, execution result table, pass/fail summary.
6. Knowledge base: lessons learned, stable selectors, query parameters, risky flows, manual-only boundaries.

## Default Workflow

1. Inspect `README.md`, `package.json`, and the relevant `tests/`, `support/`, `fixtures/`, and `scripts/` files.
2. Identify the requested scope: new coverage, daily run, failing case triage, report generation, or auth/order conditional flow.
3. Choose the narrowest safe command or file edit that advances that scope.
4. Run a targeted check before broad regression when changing scripts.
5. Update reports or test-case documentation only after evidence is collected.
6. Summarize with case IDs, pass/fail status, evidence path, and any blocker.

## Command Map

- Daily baseline: `npm run run:daily`
- Full daily Playwright suite: `npm run test:daily`
- Guest pages: `npm run test:guest`
- Market conditional filters: `npm run test:conditional:market`
- Event detail conditional charts: `npm run test:conditional:event`
- Top search headed check: `npm run test:flow:search:headed`
- Auth safe flows: `npm run test:conditional:auth-user`
- Order safe flows: `npm run test:conditional:order-user`
- Report generation: inspect `scripts/generate-full-test-report.mjs` and existing report outputs before changing format.

## Safety Rules

- Never commit `.auth/`, `.env`, traces, videos, browser profiles, cookies, tokens, or storage state.
- Treat real order submission, wallet signature, OAuth login, and payment-like flows as manual or explicitly authorized conditional automation.
- For order flows, prefer pre-submit validation: button state, error toast, auth gate, preview/confirmation, and cancel path.
- If a failure appears only in headless mode, classify it separately from product behavior until a headed/browser-profile run confirms it.
- If product data is volatile, pin a stable fixture or record the API field contract in the report.

## References

- Read `references/workflow.md` for execution and update sequence.
- Read `references/failure-triage.md` before marking any failed case as a product bug.
- Read `references/reporting.md` before generating daily reports or coverage tables.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Codex for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Codex's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Codex should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Codex produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Not every skill requires all three types of resources.**
