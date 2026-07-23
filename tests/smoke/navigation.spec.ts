import { expect, test } from '@playwright/test';
import {
  actionByText,
  expectAuthGate,
  expectCurrentUrl,
  expectGlobalNav,
  expectNoAppError,
  expectSearchVisible,
  openPath,
  openTopSignInModal,
  runGlobalHeaderSearch
} from '../../support/site';

test.describe('Guest navigation smoke', () => {
  test.slow();

  test('TC-COM-001 TC-COM-002 TC-COM-003 TC-COM-004 TC-COM-005 TC-COM-006 TC-COM-011 TC-FLOW-006', async ({
    page
  }) => {
    await openPath(page, '/news', /\/news/);
    await expectGlobalNav(page);
    await expectSearchVisible(page);

    await actionByText(page, 'Market').click();
    await expectCurrentUrl(page, /\/market/);

    await actionByText(page, 'Events').click();
    await expectCurrentUrl(page, /\/events/);

    await actionByText(page, 'Signal').click();
    await expectCurrentUrl(page, /\/signal/);

    await actionByText(page, 'News').click();
    await expectCurrentUrl(page, /\/news/);
  });

  test('TC-COM-008 theme control stays usable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);

    const html = page.locator('html');
    const themeToggle = page.getByRole('button', { name: /toggle theme/i }).first();

    const beforeClass = (await html.getAttribute('class')) ?? '';
    await themeToggle.click();
    await expect
      .poll(async () => (await html.getAttribute('class')) ?? '', { timeout: 8_000 })
      .not.toBe(beforeClass);
  });

  test('TC-COM-007 language entry click stays usable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    const languageButton = page.getByRole('button', { name: /^EN$/ }).first();
    await expect(languageButton).toBeVisible();
    await languageButton.click({ force: true });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Application error|Something went wrong/i);
  });

  test('TC-COM-009 sign in entry opens auth gate', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);
    await expectAuthGate(page);
  });

  test('TC-COM-012 logo click returns to the product default entry', async ({ page }) => {
    await openPath(page, '/market', /\/market/);

    const logoLink = page.getByRole('banner').locator('a[href="/news"]').first();
    await expect(logoLink).toBeVisible({ timeout: 20_000 });
    await logoLink.click();

    await expect(page).toHaveURL(/\/(home|news|market|events|signal)?$/i);
    await expectGlobalNav(page);
    await expect(page.locator('main')).toBeVisible();
    await expectNoAppError(page);
  });

  test('TC-COM-013 focusing empty global search keeps suggestions/history panel safe', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await expectSearchVisible(page);

    const search = page.getByPlaceholder(/Search Markets or Events|搜索市场或活动/i).first();
    await search.click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(page.locator('main')).toBeVisible();
    await expectNoAppError(page);

    const overlayText = await page.locator('body').innerText();
    expect(overlayText).not.toMatch(/NaN|undefined|null|\[object Object\]/i);
  });

  test('TC-COM-016 guest auth-only header entry opens login handling', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);
    await expectAuthGate(page);
    await expectNoAppError(page);
  });

  test('TC-COM-014 TC-COM-015 search history item routes and can be cleared', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await runGlobalHeaderSearch(page, 'iran');
    await expect(page).toHaveURL(/\/search\?q=iran/i);

    await openPath(page, '/market', /\/market/);
    const search = page.getByPlaceholder(/Search Markets or Events|搜索市场或活动/i).first();
    await search.click();

    const historyItem = page.getByText(/iran|伊朗/i).first();
    await expect(historyItem).toBeVisible({ timeout: 15_000 });
    await historyItem.click();
    await expect(page).toHaveURL(/\/search\?q=/i);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    await openPath(page, '/market', /\/market/);
    await search.click();
    const clearAll = page.getByText(/Clear All|全部清除/i).first();
    await expect(clearAll).toBeVisible({ timeout: 15_000 });
    await clearAll.click();
    await expectNoAppError(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('TC-FLOW-013 Home navigation returns to home entry', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await actionByText(page, 'Home').click();
    await expectCurrentUrl(page, /\/home/);
  });

  test('TC-COM-010 back to top returns viewport to page top', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main a[href*="/news/"]').first()).toBeVisible({ timeout: 45_000 });
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const height = Math.max(
              document.scrollingElement?.scrollHeight ?? 0,
              document.documentElement?.scrollHeight ?? 0,
              document.body?.scrollHeight ?? 0
            );

            return height - window.innerHeight;
          }),
        { timeout: 45_000 }
      )
      .toBeGreaterThan(500);
    await page.evaluate(() => {
      const height = Math.max(
        document.scrollingElement?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0
      );

      window.scrollTo(0, height);
    });
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(500);
    await page.waitForTimeout(500);

    const backToTop = page.getByRole('button', { name: /back to top/i }).first();
    await expect(backToTop).toBeVisible();
    await backToTop.click({ force: true });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const topMarker = Array.from(document.querySelectorAll('main *')).find((node) =>
              /Live Updates In Progress|Live Updates/i.test(node.textContent ?? '')
            );
            const markerRect = topMarker?.getBoundingClientRect();

            return Boolean(markerRect && markerRect.top >= 0 && markerRect.top < window.innerHeight / 2);
          }),
        { timeout: 10_000 }
      )
      .toBeTruthy();
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeLessThan(250);
  });

  test('TC-FLOW-012 theme state stays consistent across core pages', async ({ page }) => {
    await openPath(page, '/news', /\/news/);

    const html = page.locator('html');
    const themeToggle = page.getByRole('button', { name: /toggle theme/i }).first();
    const beforeClass = (await html.getAttribute('class')) ?? '';

    await themeToggle.click();
    await expect
      .poll(async () => (await html.getAttribute('class')) ?? '', { timeout: 8_000 })
      .not.toBe(beforeClass);
    const changedClass = (await html.getAttribute('class')) ?? '';

    for (const path of ['/market', '/events', '/signal'] as const) {
      await openPath(page, path, new RegExp(path));
      await expect
        .poll(async () => (await page.locator('html').getAttribute('class')) ?? '', { timeout: 8_000 })
        .toBe(changedClass);
    }
  });
});
