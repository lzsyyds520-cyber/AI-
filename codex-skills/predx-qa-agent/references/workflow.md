# Workflow

## Intake

Start by classifying the request into one primary task:

- Add or repair coverage
- Run daily regression
- Triage failed cases
- Generate a report
- Prepare GitHub-safe project synchronization
- Convert a manual observation into an automated scenario

## Test Asset Loop

1. Locate the case ID, page, path, and expected product behavior.
2. Check whether the case is already scripted.
3. If scripted, run the narrowest case first.
4. If unscripted, add the smallest reliable Playwright test that proves the behavior.
5. Attach stable evidence: Playwright result, screenshot, trace, API URL, or manual note.
6. Update the report or case table.

## Workbench UI Direction

When building the left-side workbench UI, keep modules aligned to this operational model:

- Cases: inventory, case detail, priority, automation status, latest result.
- Collection: captured URLs, API requests, selectors, screenshots, manual notes.
- Runs: daily runs, targeted runs, history, environment, command used.
- Bugs: failed cases grouped by product bug, script issue, data drift, environment gap, manual-only.
- Reports: summary dashboard, full table, exportable Markdown or HTML.
- Knowledge: stable samples, field contracts, search/history rules, auth/order constraints.

The UI should expose the current workflow state, not just decorate command output.

## Execution Order

Prefer this order when the user asks to continue from easy to hard:

1. Static page rendering and navigation
2. Search and back/forward browser history
3. Card click-through and detail page integrity
4. API-backed filters with captured query parameters
5. Analysis page modules and related content
6. Auth gate and logged-in shell checks
7. Order entry safe-mode checks
8. Wallet or real trade paths only with explicit manual authorization

## Validation

After editing tests, run a targeted command first. Run `npm run test:daily` or `npm run run:daily` only after targeted checks are stable or when the user explicitly asks for a daily report.
