import { expect, test } from '@playwright/test';
import { openPath } from '../../support/site';

const CORE_PATHS = ['/news', '/market', '/events'] as const;

test.describe('Safari/WebKit guest coverage', () => {
  test.slow();

  test('TC-ROB-002 webkit loads core guest pages', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'TC-ROB-002 is executed in WebKit to approximate Safari coverage.');

    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/Application error|Something went wrong/i);
    }
  });
});
