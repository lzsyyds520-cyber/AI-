import { expect, test, type Page } from '@playwright/test';
import {
  expectAnyMainText,
  expectNoAppError,
  expectNoBrokenDataText,
  expectSearchVisible,
  openFirstMainHref,
  openPath,
  runGlobalHeaderSearch,
  waitForMainHref
} from '../../support/site';

const SOURCE_NAME_PATTERN = /AP|Reuters|Bloomberg|Financial Times|Associated Press|Twitter|YouTube|CNBC|CNN|BBC|Axios|Politico|Forbes|WSJ|Wall Street Journal|ESPN/i;
const DETAIL_TIME_PATTERN = /(\d+|[一二两三四五六七八九十]+)\s*(m|min|h|hr|d|day)s?\s*ago|ago|分钟前|小时前|天前|周前|月前|年前|昨天|今天/i;

test.describe('News page guest coverage', () => {
  test.slow();

  async function openFirstNewsDetail(page: Page): Promise<Page> {
    const titleLink = page.locator('main a[href*="/news/"]').first();
    await expect(titleLink).toBeVisible();

    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);
    await titleLink.click();

    const popup = await popupPromise;
    const detailPage = popup ?? page;
    await detailPage.waitForLoadState('domcontentloaded');
    return detailPage;
  }

  async function openNewsDetailWithMultipleRelatedTargets(page: Page): Promise<{
    detailPath: string;
    firstHref: string;
    secondHref: string;
  }> {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const detailPaths = await page
      .locator('main a[href*="/news/"]')
      .evaluateAll((nodes) =>
        Array.from(new Set(nodes.map((node) => node.getAttribute('href')).filter(Boolean))).slice(0, 10) as string[]
      );

    for (const detailPath of detailPaths) {
      await page.goto(new URL(detailPath, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

      const hasMultipleTargets = await page
        .waitForFunction(() => {
          const related = Array.from(document.querySelectorAll('main a[href*="/event/"], main a[href*="/analysis/"], main a[href*="/market/"]'));
          return new Set(related.map((item) => item.getAttribute('href')).filter(Boolean)).size >= 2;
        }, null, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

      if (!hasMultipleTargets) {
        continue;
      }

      const pair = await page.locator('main').evaluate((main) => {
        const related = Array.from(main.querySelectorAll('a[href*="/event/"], a[href*="/analysis/"], a[href*="/market/"]'));
        const distinct = Array.from(new Map(related.map((item) => [item.getAttribute('href') ?? '', item])).values()).filter((item) =>
          item.getAttribute('href')
        );

        if (distinct.length < 2) {
          return null;
        }

        const [first, second] = distinct;
        return {
          firstHref: first.getAttribute('href') ?? '',
          secondHref: second.getAttribute('href') ?? ''
        };
      });

      if (pair?.firstHref && pair.secondHref) {
        return {
          detailPath,
          firstHref: pair.firstHref,
          secondHref: pair.secondHref
        };
      }
    }

    throw new Error('No news detail page exposed at least two distinct related card targets');
  }

  async function externalMainHrefCount(page: Page): Promise<number> {
    return page.locator('main a').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const href = node.getAttribute('href') ?? '';

        if (!href || href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return false;
        }

        try {
          return new URL(href, window.location.href).hostname !== window.location.hostname;
        } catch {
          return false;
        }
      }).length
    );
  }

  async function waitForNewsDetailContent(page: Page): Promise<void> {
    await expect
      .poll(
        async () => {
          const title = await page
            .locator('main h1')
            .first()
            .innerText()
            .catch(() => '');
          const mainText = await page
            .locator('main')
            .innerText()
            .catch(() => '');

          return title.replace(/\s+/g, ' ').trim().length > 8 && mainText.replace(/\s+/g, ' ').trim().length > 120;
        },
        { timeout: 60_000 }
      )
      .toBeTruthy();
  }

  test('TC-NEWS-001 TC-NEWS-002 TC-NEWS-003 TC-NEWS-018 page load', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await expectSearchVisible(page);
    await expectAnyMainText(page, [/Live Updates In Progress/i, /Live Updates/i, /news/i]);
  });

  test('TC-NEWS-004 TC-NEWS-005 news card text stays readable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const firstNewsCard = page.locator('main a[href*="/news/"]').first();
    await expect(firstNewsCard).toBeVisible();

    const cardText = (await firstNewsCard.innerText()).replace(/\s+/g, ' ').trim();
    expect(cardText).not.toMatch(/<[^>]+>|undefined|null|^\s*$/i);

    const cardFits = await firstNewsCard.evaluate((node) => {
      const cardRect = node.getBoundingClientRect();
      const title = node.querySelector('h1,h2,h3,h4,p,span');

      if (!title) {
        return false;
      }

      const titleRect = title.getBoundingClientRect();
      return titleRect.bottom <= cardRect.bottom + 2 && titleRect.right <= cardRect.right + 2;
    });

    expect(cardFits).toBeTruthy();
  });

  test('TC-NEWS-009 TC-NEWS-010 TC-NEWS-011 TC-NEWS-012 news header search should route to global search page', async ({
    page
  }) => {
    await openPath(page, '/news', /\/news/);

    await runGlobalHeaderSearch(page, 'iran');
    await expect(page).toHaveURL(/\/search\?q=iran/i);
  });

  test('TC-NEWS-007 TC-NEWS-019 TC-NEWS-020 related card jump', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openFirstMainHref(page, ['/event/', '/analysis/', '/market/']);
    await expect(page).toHaveURL(/\/(event|analysis|market)\//);
  });

  test('TC-NEWS-006 news detail open stays readable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);
    const detailPage = await openFirstNewsDetail(page);
    await expect(detailPage).toHaveURL(/\/news\//);
    await expect(detailPage.locator('main')).toContainText(/Related|News|Market|Event/i, { timeout: 45_000 });

    if (detailPage !== page) {
      await detailPage.close();
      await expect(page).toHaveURL(/\/news/);
      await expectSearchVisible(page);
    }
  });

  test('TC-NEWS-022 news detail header keeps title source and time context', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const href = await page.locator('main a[href*="/news/"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(new URL(href ?? '', page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/news\//);
    await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
    await waitForNewsDetailContent(page);
    await expectNoBrokenDataText(page.locator('main'));

    const pageText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    expect(pageText.length).toBeGreaterThan(120);
    expect(pageText).toMatch(SOURCE_NAME_PATTERN);
    expect(pageText).toMatch(DETAIL_TIME_PATTERN);
  });

  test('TC-NEWS-023 news detail related markets expose usable core fields or stable empty state', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    const sample = await openNewsDetailWithMultipleRelatedTargets(page);
    await page.goto(new URL(sample.detailPath, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const related = page.locator('main a[href*="/event/"], main a[href*="/analysis/"], main a[href*="/market/"]');
    await expect.poll(async () => related.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expectNoBrokenDataText(page.locator('main'));

    const relatedText = (await related.first().innerText()).replace(/\s+/g, ' ').trim();
    expect(relatedText.length).toBeGreaterThan(5);
    await expect(page.locator('main')).toContainText(/Related|Market|Event|Analysis|%|Vol|Liq|Trade/i);
  });

  test('TC-NEWS-024 TC-FLOW-021 news detail related-card jump can return to the original detail page', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    const sample = await openNewsDetailWithMultipleRelatedTargets(page);
    const detailPath = new URL(sample.detailPath, page.url()).pathname;

    await page.goto(new URL(sample.firstHref, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/(event|analysis|market)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(detailPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
    await expectNoBrokenDataText(page.locator('main'));
  });

  test('TC-NEWS-025 source names are display-only and do not expose external jumps', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);
    await expect(page.locator('main')).toContainText(SOURCE_NAME_PATTERN, { timeout: 45_000 });
    await expect.poll(() => externalMainHrefCount(page), { timeout: 10_000 }).toBe(0);

    const beforeUrl = page.url();
    await page.locator('main').getByText(SOURCE_NAME_PATTERN).first().click({ force: true });
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(beforeUrl);
    await expectNoAppError(page);

    const href = await page.locator('main a[href*="/news/"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(new URL(href ?? '', page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/news\//);
    await expect(page.locator('main')).toBeVisible({ timeout: 45_000 });
    await expect.poll(() => externalMainHrefCount(page), { timeout: 10_000 }).toBe(0);
    await expectNoAppError(page);
  });

  test('TC-NEWS-008 related objects under one news item render in multiples', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const groupedRelatedCount = await page.locator('main').evaluate((main) => {
      const newsLinks = Array.from(main.querySelectorAll('a[href*="/news/"]'));

      for (const link of newsLinks) {
        let node: HTMLElement | null = link.parentElement;

        while (node && node !== main) {
          const related = node.querySelectorAll('a[href*="/event/"], a[href*="/analysis/"], a[href*="/market/"]');
          if (related.length >= 2) {
            return related.length;
          }
          node = node.parentElement;
        }
      }

      return 0;
    });

    expect(groupedRelatedCount).toBeGreaterThanOrEqual(2);
  });

  test('TC-NEWS-013 visible news time markers stay in descending order', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const visibleTimes = await page.locator('main').evaluate((main) =>
      Array.from(main.querySelectorAll('*'))
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((text) => /^\d{2}:\d{2}$/.test(text))
        .slice(0, 8)
    );

    expect(visibleTimes.length).toBeGreaterThanOrEqual(3);

    const minuteValues = visibleTimes.map((time) => {
      const [hour, minute] = time.split(':').map(Number);
      return hour * 60 + minute;
    });

    for (let index = 1; index < minuteValues.length; index += 1) {
      expect(minuteValues[index]).toBeLessThanOrEqual(minuteValues[index - 1]);
    }
  });

  test('TC-NEWS-014 refresh keeps page usable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await expect(page.getByRole('button', { name: /refresh news/i })).toBeVisible();
    await expect(page.locator('main')).toContainText(/Trending|Hot Topics|Live Updates In Progress/i);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await expect(page.getByRole('button', { name: /refresh news/i })).toBeVisible();
    await expect(page.locator('main')).toContainText(/Trending|Hot Topics|Live Updates In Progress/i);
  });

  test('TC-NEWS-015 offline reload then recover stays usable', async ({ page, context }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    let sawFailedRequest = false;
    page.on('requestfailed', (request) => {
      if (/predx\.pro|api\.predx\.pro/i.test(request.url())) {
        sawFailedRequest = true;
      }
    });

    await context.setOffline(true);
    await page.getByRole('button', { name: /refresh news/i }).click({ force: true });
    await expect.poll(() => sawFailedRequest, { timeout: 10_000 }).toBeTruthy();
    await expect(page.locator('main')).toBeVisible();

    await context.setOffline(false);
    await page.getByRole('button', { name: /refresh news/i }).click({ force: true });
    await expectSearchVisible(page);
    await expectAnyMainText(page, [/Live Updates In Progress/i, /Trending/i, /Hot Topics/i]);
  });

  test('TC-NEWS-016 slow network shows loading placeholders before content resolves', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 1_200,
      downloadThroughput: 80 * 1024,
      uploadThroughput: 40 * 1024,
      connectionType: 'cellular3g'
    });

    await page.goto('/news', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/news/);

    const loadingBlocks = page.locator('main [class*="animate-pulse"]');
    await expect.poll(async () => loadingBlocks.count(), { timeout: 10_000 }).toBeGreaterThan(10);
    expect(await page.locator('main a[href*="/news/"]').count()).toBe(0);

    await waitForMainHref(page, ['/news/']);
    await expectSearchVisible(page);
    await expectAnyMainText(page, [/Live Updates In Progress/i, /Trending/i, /Hot Topics/i]);
  });

  test('TC-NEWS-017 deep scrolling keeps more news content reachable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await waitForMainHref(page, ['/news/']);

    const firstTitles = await page
      .locator('main a[href*="/news/"]')
      .evaluateAll((nodes) =>
        nodes
          .slice(0, 3)
          .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
      );

    expect(firstTitles.length).toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeGreaterThan(400);
    await expect(page.getByRole('button', { name: /back to top/i })).toBeVisible();

    const lastTitle = await page
      .locator('main a[href*="/news/"]')
      .last()
      .innerText()
      .then((text) => text.replace(/\s+/g, ' ').trim());

    expect(lastTitle.length).toBeGreaterThan(0);
    expect(firstTitles).not.toContain(lastTitle);
  });

  test('TC-NEWS-021 rapid consecutive related-card clicks land on the last target', async ({ page }) => {
    const sample = await openNewsDetailWithMultipleRelatedTargets(page);

    await page.evaluate(({ firstHref, secondHref }) => {
      const anchors = Array.from(document.querySelectorAll('main a'));
      const first = anchors.find((node) => node.getAttribute('href') === firstHref);
      const second = anchors.find((node) => node.getAttribute('href') === secondHref);

      if (!first || !second) {
        return;
      }

      first.click();
      setTimeout(() => second.click(), 10);
    }, sample);

    await expect(page).toHaveURL(new RegExp(sample.secondHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade|Markets/i);
  });
});
