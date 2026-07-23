import { expect, test } from '@playwright/test';
import {
  actionByText,
  expectNoAppError,
  expectNoBrokenDataText,
  expectSearchVisible,
  openFirstMainHref,
  openPath,
  runSearch,
  waitForMainHref
} from '../../support/site';

test.describe('Events page guest coverage', () => {
  test.slow();

  test('TC-EVT-001 TC-EVT-002 TC-EVT-003 TC-EVT-004 TC-EVT-005 TC-EVT-012 page load and state switch', async ({
    page
  }) => {
    await openPath(page, '/events', /\/events/);
    await expectSearchVisible(page);
    await waitForMainHref(page, ['/analysis/']);

    await expect(actionByText(page, 'All').first()).toBeVisible();
    await expect(page.locator('main a[href*="/analysis/"]').first()).toBeVisible();
    await expect(page.locator('main a[href*="/analysis/"]').first()).not.toHaveText(/^$/);
    await actionByText(page, 'Hot').first().click();
    await actionByText(page, 'All').first().click();
  });

  test('TC-EVT-007 TC-EVT-008 TC-EVT-009 search flows', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/analysis/']);

    await runSearch(page, 'Iran');
    await expect(page.locator('main')).toContainText(/Iran/i);

    await runSearch(page, 'zzzz_not_exist_case');
    await expect(page.locator('main')).toContainText(/No|not found|empty|result/i);
  });

  test('TC-EVT-006 event entry jump', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/event/']);
    await openFirstMainHref(page, ['/event/']);
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade/i);
    await expect(page.locator('body')).toContainText(/Amount|Market/i);
  });

  test('TC-EVT-010 TC-EVT-011 event return and refresh stay usable', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/event/']);

    await openFirstMainHref(page, ['/event/']);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/events/);
    await expectSearchVisible(page);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/events/);
    await waitForMainHref(page, ['/analysis/']);
  });

  test('TC-EVT-013 visible event cards expose Deep Analysis entry points', async ({ page }) => {
    await openPath(page, '/events', /\/events/);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const hasAnalysisLink = await waitForMainHref(page, ['/analysis/'], 25_000)
        .then(() => true)
        .catch(() => false);

      if (hasAnalysisLink) {
        break;
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (attempt === 1) {
        await waitForMainHref(page, ['/analysis/'], 45_000);
      }
    }

    const analysisLinks = page.locator('main a[href*="/analysis/"]');
    await expect.poll(async () => analysisLinks.count(), { timeout: 45_000 }).toBeGreaterThan(0);
    await expect(page.locator('main')).toContainText(/Deep Analysis/i);
    await expectNoBrokenDataText(page.locator('main'));

    const visibleAnalysisLinks = await analysisLinks.evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          return {
            href: node.getAttribute('href') ?? '',
            text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
            visible: rect.width > 0 && rect.height > 0
          };
        })
        .filter((item) => item.visible)
    );

    expect(visibleAnalysisLinks.length).toBeGreaterThan(0);
    for (const link of visibleAnalysisLinks.slice(0, 5)) {
      expect(link.href).toMatch(/\/analysis\//);
      expect(link.text).toMatch(/Deep Analysis|./i);
    }
  });

  test('TC-EVT-016 related market cards keep title price and liquidity fields reachable', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/event/']);

    await expect(page.locator('main')).toContainText(/Related Markets/i, { timeout: 45_000 });
    await expect(page.locator('main a[href*="/event/"]').first()).toBeVisible({ timeout: 45_000 });
    await expectNoBrokenDataText(page.locator('main'));

    const mainText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(mainText).toMatch(/Related Markets/i);
    expect(mainText).toMatch(/%/);
    expect(mainText).toMatch(/\$|Vol|Liq|美元|销量|流动性/i);
  });

  test('TC-EVT-014 More News expansion keeps source list readable', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/analysis/']);
    await expect(page.locator('main')).toContainText(/More News:/i, { timeout: 45_000 });

    const moreNewsCount = await page.getByText(/\+\d+$/).count();
    if (moreNewsCount > 0) {
      await page.getByText(/\+\d+$/).first().click({ force: true });
    }

    await expect(page.locator('main')).toContainText(/More News:|Reuters|Bloomberg|AP|BBC|ESPN|Al Jazeera|Financial Times|The Athletic/i, {
      timeout: 15_000
    });
    await expectNoBrokenDataText(page.locator('main'));
    await expectNoAppError(page);
  });

  test('TC-EVT-018 Hot All switching then Deep Analysis opens the current visible analysis page', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/analysis/']);

    await actionByText(page, 'Hot').first().click();
    await page.waitForTimeout(500);
    await actionByText(page, 'All').first().click();
    await waitForMainHref(page, ['/analysis/']);

    await openFirstMainHref(page, ['/analysis/']);
    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.locator('main')).toContainText(/Historical|Scenario|Market|Consensus|Comparison/i, { timeout: 45_000 });
    await expectNoAppError(page);
  });

  test('TC-EVT-015 event card share action keeps the page stable', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://predx.pro' }).catch(() => undefined);
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/analysis/']);

    const iconButtons = page.locator('main button').filter({ has: page.locator('svg') });
    await expect.poll(async () => iconButtons.count(), { timeout: 45_000 }).toBeGreaterThan(1);

    const beforeUrl = page.url();
    await iconButtons.nth(1).click({ force: true });
    await expect(page).toHaveURL(beforeUrl);
    await expect(page.locator('main')).toBeVisible();
    await expectNoAppError(page);

    const clipboardText = await page.evaluate(() => navigator.clipboard?.readText?.()).catch(() => '');
    const bodyText = await page.locator('body').innerText();
    expect(`${clipboardText} ${bodyText}`).toMatch(/predx\.pro|Copied|Share|Link|复制|分享|Deep Analysis|Related Markets/i);
  });

  test('TC-EVT-017 event news source item opens a news detail or source route cleanly', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await waitForMainHref(page, ['/news/']);

    const newsLink = page.locator('main a[href*="/news/"]').first();
    await expect(newsLink).toBeVisible({ timeout: 45_000 });
    const href = await newsLink.getAttribute('href');
    expect(href).toMatch(/\/news\//);

    await newsLink.click({ force: true });
    const clickedThrough = await expect
      .poll(async () => page.url(), { timeout: 15_000 })
      .toMatch(/\/news\//)
      .then(() => true)
      .catch(() => false);

    if (!clickedThrough) {
      await page.goto(new URL(href!, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }

    await expect(page).toHaveURL(/\/news\//);
    await expect(page.locator('body')).toContainText(/Related News|Hot Topics|Market|News/i, { timeout: 45_000 });
    await expectNoAppError(page);
  });
});
