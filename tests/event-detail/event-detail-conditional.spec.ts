import { expect, test } from '@playwright/test';
import { expectLargeEventChart, loadJsonFixture, type EventChartFixture } from '../../support/conditional';
import { env } from '../../support/env';
import { EVENT_DETAIL_PATH, openPath } from '../../support/site';

const CONDITIONAL_EVENT_READY = env.conditionalAutomationReady && env.eventChartAutomationReady;
const EVENT_SKIP_REASON =
  'Event chart conditional automation requires CONDITIONAL_AUTOMATION_READY=true and EVENT_CHART_AUTOMATION_READY=true.';

async function loadEventFixture(): Promise<EventChartFixture> {
  return loadJsonFixture<EventChartFixture>(env.eventChartFixturePath);
}

test.describe('Event detail conditional coverage', () => {
  test.slow();
  test.skip(!CONDITIONAL_EVENT_READY, EVENT_SKIP_REASON);

  test('TC-EVTD-002 chart area renders and history source is reachable', async ({ page }) => {
    const fixture = await loadEventFixture();
    const historyUrls: string[] = [];

    page.on('response', (response) => {
      if (response.status() === 200 && response.url().includes('prices-history')) {
        historyUrls.push(response.url());
      }
    });

    await openPath(page, fixture.path ?? EVENT_DETAIL_PATH, /\/event\//);
    await expect(page.getByRole('button', { name: '1H', exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await expectLargeEventChart(page, fixture.chartMinWidth ?? 200, fixture.chartMinHeight ?? 150);
    await expect
      .poll(() => historyUrls.some((url) => url.includes('interval=all')), { timeout: 45_000 })
      .toBeTruthy();
  });

  test('TC-EVTD-003 time-range buttons refetch chart history', async ({ page }) => {
    const fixture = await loadEventFixture();
    const historyUrls: string[] = [];

    page.on('response', (response) => {
      if (response.status() === 200 && response.url().includes('prices-history')) {
        historyUrls.push(response.url());
      }
    });

    await openPath(page, fixture.path ?? EVENT_DETAIL_PATH, /\/event\//);
    await expectLargeEventChart(page, fixture.chartMinWidth ?? 200, fixture.chartMinHeight ?? 150);

    for (const range of fixture.ranges) {
      await test.step(`switch chart range to ${range.label}`, async () => {
        const beforeCount = historyUrls.length;
        await page.getByRole('button', { name: range.label, exact: true }).first().click();

        await expect
          .poll(
            () =>
              historyUrls
                .slice(beforeCount)
                .some((url) => range.requestIncludes.every((part) => url.includes(part))),
            { timeout: 45_000 }
          )
          .toBeTruthy();
      });
    }
  });
});
