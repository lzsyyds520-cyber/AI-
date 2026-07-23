# Failure Triage

## Classification

Classify every failed case into one of these buckets:

- Product bug: headed/manual reproduction matches the failed behavior.
- Script issue: selector, timing, viewport, headless-only, or assertion is too brittle.
- Data drift: live product data changed and the test lacks a stable fixture.
- Environment gap: login state, wallet, browser profile, network, or permission is missing.
- Manual-only: real trade, wallet signing, third-party OAuth, or irreversible action.

## Evidence Standard

Do not mark a failure as product bug from one headless run alone unless the bug is deterministic and visible in captured artifacts. For user-reported bugs, reproduce the exact path, including whether navigation started from a top search, direct URL, card click, browser back, refresh, or deep link.

## Search Flow Notes

For PredX search, distinguish:

- Top navigation search with typed query and Enter
- Direct `/search?q=...` URL
- Search result page filters
- Browser back from search results to the originating page

These paths can produce different SPA history states, so they need separate case IDs or separate steps in the same case.

## Auth And Order Notes

Logged-in tests require a trusted storage state or browser profile. Order tests should remain in safe mode unless the user explicitly authorizes a real trade path for the current run.
