# Coverage Governance

## Coverage Model

Track four different counts separately:

- Inventory: every designed test case from PRD and exploratory coverage.
- Scripted: cases that have Playwright or deterministic API automation.
- Runnable today: scripted cases included in the current command and not blocked by missing conditions.
- Passed latest: runnable cases that passed in the latest recorded execution.

Never collapse these into one number.

## Case Record Minimum Fields

Every maintained case should have:

- Case ID
- Module
- Scenario
- Entry path or URL
- Preconditions
- Steps
- Expected result
- Automation status
- Latest result
- Evidence or blocker
- Bug ID when failed as product bug

## Missing Coverage Rules

Add a new case when a real product path is not represented by an existing case, especially:

- Browser back/forward after SPA navigation
- Refresh after filters, search, detail entry, or auth state changes
- Card-to-detail and detail-to-related jumps
- Order book, price, liquidity, volume, and activity data rendering
- Error, empty, slow network, and recoverable API states
- Logged-in shell, logout, auth gate restoration, and safe order entry

## Automation Readiness

Use these automation states:

- Automated: executable and included in normal or targeted runs.
- Conditional automated: executable only with documented fixtures, auth state, browser profile, or stable data.
- Manual: should not run unattended because it requires wallet, OAuth, irreversible action, or external verification.
- Needs design: case exists but expected behavior or sample data is not stable enough.

## Change Control

When adding or changing tests:

1. Link the test to case IDs.
2. State whether it increases inventory, scripted coverage, or daily-run coverage.
3. Run targeted validation.
4. Update the report only after validation.
