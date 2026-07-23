import { expect, test, type Page } from '@playwright/test';
import { openPath } from '../../support/site';

const CORE_PATHS = ['/news', '/market', '/events'] as const;

async function expectNoHorizontalOverflow(page: Page, tolerance = 8): Promise<void> {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + tolerance);
}

async function expectMainUsable(page: Page): Promise<void> {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/Application error|Something went wrong/i);
  await expectNoHorizontalOverflow(page);
}

test.use({ channel: 'chrome' });

test.describe('Chrome compatibility guest coverage', () => {
  test.slow();

  test('TC-ROB-001 latest Chrome loads core guest pages', async ({ page }) => {
    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expectMainUsable(page);
    }
  });
});
