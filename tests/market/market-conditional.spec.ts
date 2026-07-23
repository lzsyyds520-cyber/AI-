import { test } from '@playwright/test';
import {
  applyMarketFilterAndCapture,
  assertMarketFilterResponse,
  assertVisibleTitles,
  loadJsonFixture,
  type MarketFilterCase,
  type MarketFilterFixture
} from '../../support/conditional';
import { env } from '../../support/env';
import { openPath } from '../../support/site';

const CASE_IDS = ['TC-MKT-006', 'TC-MKT-007', 'TC-MKT-008', 'TC-MKT-009', 'TC-MKT-010'] as const;
const CONDITIONAL_MARKET_READY = env.conditionalAutomationReady && env.marketFilterAutomationReady;
const MARKET_SKIP_REASON =
  'Market conditional automation requires CONDITIONAL_AUTOMATION_READY=true, MARKET_FILTER_AUTOMATION_READY=true, and a fixture with enabled cases.';

async function loadCase(caseId: string): Promise<MarketFilterCase | null> {
  if (!env.marketFilterFixturePath) {
    return null;
  }

  const fixture = await loadJsonFixture<MarketFilterFixture>(env.marketFilterFixturePath);
  return fixture.cases.find((item) => item.id === caseId && item.enabled) ?? null;
}

test.describe('Market conditional coverage', () => {
  test.slow();
  test.skip(!CONDITIONAL_MARKET_READY, MARKET_SKIP_REASON);

  for (const caseId of CASE_IDS) {
    test(`${caseId} filter contract matches API response`, async ({ page }) => {
      test.skip(!env.marketFilterFixturePath, 'Set MARKET_FILTER_FIXTURE to a configured JSON file.');

      const filterCase = await loadCase(caseId);
      test.skip(!filterCase, `${caseId} is not enabled in MARKET_FILTER_FIXTURE.`);

      await openPath(page, '/market', /\/market/);
      const response = await applyMarketFilterAndCapture(page, filterCase);
      assertMarketFilterResponse(response, filterCase);

      if (filterCase.expectedVisibleTitles?.length) {
        await assertVisibleTitles(page, filterCase.expectedVisibleTitles);
      }
    });
  }
});
