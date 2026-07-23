import { expect, test, type Page } from '@playwright/test';
import { env } from '../../support/env';
import { actionByText, BROKEN_DATA_PATTERN, expectAuthGate, expectSearchVisible, openPath, runGlobalHeaderSearch } from '../../support/site';

const CORE_PATHS = ['/news', '/market', '/events'] as const;
const IMAGE_PATHS = ['/market', '/events', '/signal'] as const;
const IGNORE_CONSOLE_ERRORS = [/favicon/i, /ERR_BLOCKED_BY_CLIENT/i];
const APPLICATION_ERROR_PATTERN = /Application error|Something went wrong|应用程序错误|客户端异常/i;

async function expectNoHorizontalOverflow(page: Page, tolerance = 8): Promise<void> {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + tolerance);
}

async function expectMainUsable(page: Page): Promise<void> {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(APPLICATION_ERROR_PATTERN);
  await expectNoHorizontalOverflow(page);
}

async function collectTransientAppErrors(page: Page, durationMs = 5_000): Promise<string[]> {
  const errors: string[] = [];
  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline) {
    const text = await page
      .locator('body')
      .innerText({ timeout: 500 })
      .catch(() => '');

    if (APPLICATION_ERROR_PATTERN.test(text)) {
      errors.push(text.replace(/\s+/g, ' ').trim().slice(0, 240));
    }

    await page.waitForTimeout(100);
  }

  return [...new Set(errors)];
}

async function expectNoTransientAppErrorDuring(
  page: Page,
  action: () => Promise<unknown>,
  durationMs = 5_000
): Promise<void> {
  const monitorPromise = collectTransientAppErrors(page, durationMs);

  await action();

  const appErrors = await monitorPromise;
  expect(appErrors, `Transient application error appeared after navigation: ${appErrors.join('\n')}`).toEqual([]);
}

test.describe('Robustness and compatibility guest coverage', () => {
  test.slow();

  test('TC-ROB-003 desktop viewport layout stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expectMainUsable(page);
    }
  });

  test('TC-ROB-004 tablet viewport layout stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expectMainUsable(page);
    }
  });

  test('TC-ROB-005 mobile viewport layout stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expectMainUsable(page);
    }
  });

  test('TC-ROB-007 no blocking page or app console errors on core loads', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('console', (message) => {
      if (message.type() !== 'error') {
        return;
      }

      const text = message.text();
      if (IGNORE_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) {
        return;
      }

      const location = message.location();
      if (!location.url || /predx\.pro/i.test(location.url)) {
        consoleErrors.push(text);
      }
    });

    for (const path of CORE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(1_500);
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `Blocking console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('TC-ROB-008 core card images are not visibly broken', async ({ page }) => {
    for (const path of IMAGE_PATHS) {
      await openPath(page, path, new RegExp(path));
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2_000);

      const brokenVisibleImages = await page.locator('main img').evaluateAll((images) => {
        return images
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            return visible && image.complete && image.naturalWidth === 0;
          })
          .map((image) => image.getAttribute('src') ?? '<unknown>');
      });

      expect(brokenVisibleImages, `Broken visible images on ${path}: ${brokenVisibleImages.join(', ')}`).toEqual([]);
    }
  });

  test('TC-ROB-010 browser back and forward stays stable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await actionByText(page, 'Market').click();
    await expect(page).toHaveURL(/\/market/);
    await actionByText(page, 'Events').click();
    await expect(page).toHaveURL(/\/events/);

    await page.goBack();
    await expect(page).toHaveURL(/\/market/);
    await expect(page.locator('main')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator('main')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/market/);
    await expect(page.locator('main')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/events/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('BUG-SEARCH-001 search results browser back does not crash', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await page.goto('/search?q=iran', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/search\?q=iran/i);
    await expectMainUsable(page);
    await expect(page.locator('body')).toContainText(/Iran/i, { timeout: 30_000 });

    await expectNoTransientAppErrorDuring(page, () => page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }));
    await expect(page).toHaveURL(/\/news/);
    await expectMainUsable(page);
  });

  test('BUG-SEARCH-002 header search results browser back does not crash', async ({ page }) => {
    test.skip(
      !env.headedGlobalSearchReady,
      'Header search Enter navigation is only reliable enough for this regression in a headed real Chrome specialty run.'
    );

    await openPath(page, '/news', /\/news/);
    await runGlobalHeaderSearch(page, 'iran');
    await expect(page).toHaveURL(/\/search\?q=iran/i);
    await expectMainUsable(page);

    await expectNoTransientAppErrorDuring(page, () => page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }));
    await expect(page).toHaveURL(/\/news/);
    await expectMainUsable(page);
  });

  test('TC-ROB-006 rapid navigation switching does not white-screen', async ({ page }) => {
    await openPath(page, '/news', /\/news/);

    const sequence: Array<{ label: string; url: RegExp }> = [
      { label: 'Market', url: /\/market/ },
      { label: 'Events', url: /\/events/ },
      { label: 'Signal', url: /\/signal/ },
      { label: 'News', url: /\/news/ },
      { label: 'Home', url: /\/home/ }
    ];

    for (const step of sequence) {
      await actionByText(page, step.label).click();
      await page.waitForTimeout(120);
    }

    await expect(page).toHaveURL(/\/home/);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(APPLICATION_ERROR_PATTERN);
  });

  test('TC-ROB-009 long stay then navigation remains responsive', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await expect(page.locator('main')).toBeVisible();

    await page.waitForTimeout(20_000);

    const marketNav = page.getByRole('link', { name: 'Market', exact: true }).first();
    await expect(marketNav).toBeVisible();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const routePromise = page.waitForURL(/\/market/, { timeout: 10_000 }).catch(() => null);
      await marketNav.click();

      if (await routePromise) {
        break;
      }

      await page.waitForTimeout(500);
    }

    await expect(page).toHaveURL(/\/market/);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(APPLICATION_ERROR_PATTERN);
  });

  test('TC-ROB-013 keyboard Tab Enter can operate nav search auth entry', async ({ page }) => {
    await openPath(page, '/news', /\/news/);

    const marketNav = page.getByRole('link', { name: 'Market', exact: true }).first();
    await expect(marketNav).toBeVisible({ timeout: 20_000 });
    await marketNav.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/market/);
    await expectMainUsable(page);

    const search = page.getByPlaceholder(/Search Markets or Events|搜索市场或活动/i).first();
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.focus();
    await page.keyboard.type('iran');
    await expect(search).toHaveValue(/iran/i);
    await page.keyboard.press('Escape');

    const signIn = page.getByRole('button', { name: /sign in/i }).first();
    await expect(signIn).toBeVisible({ timeout: 20_000 });
    await signIn.focus();
    await expect(signIn).toBeFocused();

    for (const key of ['Enter', 'Space']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1_000);

      if (await page.getByText(/Connect to PredX/i).first().isVisible().catch(() => false)) {
        break;
      }
    }

    await expectAuthGate(page);
  });

  test('TC-ROB-014 core first-screen performance stays within daily smoke threshold', async ({ page }) => {
    const startedAt = Date.now();

    await openPath(page, '/market', /\/market/);
    await expect(page.locator('main')).toContainText(/%|\$|Vol|Liq|销售量|流动性/i, { timeout: 45_000 });
    await expectMainUsable(page);

    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs).toBeLessThan(60_000);

    const timing = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

      if (!navigation) {
        return null;
      }

      return {
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd
      };
    });

    if (timing) {
      expect(timing.domContentLoadedMs).toBeLessThan(60_000);
    }
  });

  test('TC-ROB-015 zh-CN locale and Asia Shanghai timezone keep formats usable', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const page = await context.newPage();

    for (const url of ['https://predx.pro/news', 'https://predx.pro/market']) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
      await expect(page.locator('body')).not.toContainText(APPLICATION_ERROR_PATTERN);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(BROKEN_DATA_PATTERN);
    }

    await context.close();
  });

  test('TC-ROB-011 market API 500 response shows a recoverable handled state', async ({ page }) => {
    await page.route('**/api/v1/polymarket?**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'QA simulated polymarket failure' })
      });
    });

    await page.goto('/market', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await expect(page.locator('body')).not.toContainText(APPLICATION_ERROR_PATTERN);
    await expect(page.locator('main')).toContainText(/No|Empty|Error|Failed|Try|Unable|Status/i, { timeout: 30_000 });
  });

  test('TC-ROB-012 market API empty list shows empty state and keeps controls usable', async ({ page }) => {
    await page.route('**/api/v1/polymarket?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            events_with_markets: [],
            total: 0
          }
        })
      });
    });

    await page.goto('/market', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await expect(page.locator('body')).not.toContainText(APPLICATION_ERROR_PATTERN);
    await expect(page.locator('main')).toContainText(/No|Empty|Status|End Date|Liquidity|Volume|Creation Time/i, { timeout: 30_000 });

    const eventLinks = page.locator('main a[href*="/event/"], main a[href*="/market/"]');
    await expect.poll(async () => eventLinks.count(), { timeout: 10_000 }).toBe(0);
  });
});
