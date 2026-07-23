import { expect, test, type Page } from '@playwright/test';
import { env } from '../../support/env';
import {
  ANALYSIS_DETAIL_PATH,
  EVENT_DETAIL_PATH,
  EVENT_MARKET_FLOW_PATH,
  actionByText,
  clickFirstVisibleLink,
  clickFirstMainLink,
  closeOverlay,
  expectAuthGate,
  expectNoAppError,
  openFirstMainHref,
  openPath,
  runGlobalHeaderSearch,
  tradeSubmitButton,
  waitForMainHref,
  waitForMarketCatalog
} from '../../support/site';

const EVENT_MARKET_LABEL = "Dilution of Iran's Uranium";

async function rightRailText(page: Page): Promise<string> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter((node) => {
        const rect = (node as HTMLElement).getBoundingClientRect?.();
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();

        return !!rect && rect.left >= window.innerWidth * 0.72 && rect.width > 40 && rect.height > 12 && text.length > 0 && text.length < 200;
      })
      .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
      .join(' ')
  );
}

async function openFirstRightRailHref(page: Page, hrefFragments: string[]): Promise<void> {
  const href = await expect
    .poll(
      async () =>
        page.locator('a').evaluateAll((nodes, fragments) => {
          const match = nodes.find((node) => {
            const href = node.getAttribute('href') ?? '';
            if (!fragments.some((fragment) => href.includes(fragment))) {
              return false;
            }

            const element = node as HTMLElement;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return (
              rect.left >= window.innerWidth * 0.66 &&
              rect.width > 10 &&
              rect.height > 10 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none'
            );
          });

          return match?.getAttribute('href') ?? null;
        }, hrefFragments),
      { timeout: 45_000 }
    )
    .toBeTruthy()
    .then(async () =>
      page.locator('a').evaluateAll((nodes, fragments) => {
        const match = nodes.find((node) => {
          const href = node.getAttribute('href') ?? '';
          if (!fragments.some((fragment) => href.includes(fragment))) {
            return false;
          }

          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return (
            rect.left >= window.innerWidth * 0.66 &&
            rect.width > 10 &&
            rect.height > 10 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });

        return match?.getAttribute('href') ?? null;
      }, hrefFragments)
    );

  if (!href) {
    throw new Error(`No right rail anchor matched fragments: ${hrefFragments.join(', ')}`);
  }

  await page.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
}

test.describe('Cross-page flows', () => {
  test.slow();

  test('TC-FLOW-001 news to event or market', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
  });

  test('TC-FLOW-002 event market row switches trade context without losing event context', async ({ page }) => {
    await openPath(page, EVENT_MARKET_FLOW_PATH, /\/event\//);

    const marketRow = page.locator('main div.cursor-pointer').filter({ hasText: EVENT_MARKET_LABEL }).first();
    await expect(marketRow).toBeVisible({ timeout: 45_000 });

    await marketRow.click();

    await expect
      .poll(() => rightRailText(page), { timeout: 15_000 })
      .toContain(EVENT_MARKET_LABEL);
    await expect(page.locator('body')).toContainText(/What will be in a US-Iran deal in 2026\?/i);
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade/i);
  });

  test('TC-FLOW-005 iran header search routes to shared search page across News Market Events Signal', async ({ page }) => {
    test.skip(
      !env.headedGlobalSearchReady,
      'Global header Enter search currently passes only in headed real Chrome; run with npm run test:flow:search:headed.'
    );

    const pages = [
      { label: 'News', path: '/news', url: /\/news/ },
      { label: 'Market', path: '/market', url: /\/market/ },
      { label: 'Events', path: '/events', url: /\/events/ },
      { label: 'Signal', path: '/signal', url: /\/signal/ }
    ] as const;

    for (const pageCase of pages) {
      await test.step(pageCase.label, async () => {
        await openPath(page, pageCase.path, pageCase.url);
        await runGlobalHeaderSearch(page, 'iran');
        await expect.soft(page, `${pageCase.label} should route to the shared search page`).toHaveURL(/\/search\?q=iran/i);
        await expect.soft(page.locator('main'), `${pageCase.label} search first screen should remain Iran-related`).toContainText(/Iran/i, {
          timeout: 15_000
        });
      });
    }
  });

  test('TC-FLOW-007 news detail browser back stays stable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openFirstMainHref(page, ['/news/']);
    await expect(page).toHaveURL(/\/news\//);
    await expect(page.locator('main')).toContainText(/Related|News|Market|Event/i, { timeout: 45_000 });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('TC-FLOW-008 event market switch then browser back returns to events cleanly', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await page.goto(EVENT_MARKET_FLOW_PATH, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const marketRow = page.locator('main div.cursor-pointer').filter({ hasText: EVENT_MARKET_LABEL }).first();
    await expect(marketRow).toBeVisible({ timeout: 45_000 });
    await marketRow.click();

    await expect
      .poll(() => rightRailText(page), { timeout: 15_000 })
      .toContain(EVENT_MARKET_LABEL);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/events/);
    await waitForMainHref(page, ['/event/']);
  });

  test('TC-FLOW-009 events card to analysis', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await openFirstMainHref(page, ['/analysis/']);
    await expect(page).toHaveURL(/\/analysis\//);
  });

  test('TC-FLOW-010 analysis to market', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
  });

  test('TC-FLOW-011 analysis to news', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await clickFirstVisibleLink(page, ['/news/', '/analysis/']);
    await expect(page).toHaveURL(/\/(news|analysis)\//);
  });

  test('TC-FLOW-016 market detail browser back returns to market list', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/market/);
    await waitForMarketCatalog(page);
  });

  test('TC-FLOW-017 search result detail browser back preserves query results', async ({ page }) => {
    await page.goto('/search?q=iran', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/search\?q=iran/i);
    await expect(page.locator('main')).toContainText(/Iran/i, { timeout: 45_000 });
    await waitForMainHref(page, ['/event/', '/market/', '/analysis/', '/news/']);

    await openFirstMainHref(page, ['/event/', '/market/', '/analysis/', '/news/']);
    await expect(page).toHaveURL(/\/(event|market|analysis|news)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/search\?q=iran/i);
    await expect(page.locator('main')).toContainText(/Iran/i, { timeout: 45_000 });
  });

  test('TC-FLOW-018 analysis right rail browser back returns to analysis', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    const analysisPath = new URL(page.url()).pathname;

    await openFirstRightRailHref(page, ['/event/', '/analysis/']);
    await expect(page).toHaveURL(/\/(event|analysis)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(analysisPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('main')).toContainText(/Historical|Scenario|Market|Consensus|Comparison/i, { timeout: 45_000 });
  });

  test('TC-FLOW-019 event tabs do not corrupt browser back forward state', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await page.goto('/event/world-cup-winner', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/event\/world-cup-winner/);

    const eventPath = new URL(page.url()).pathname;
    await actionByText(page, 'Evidence').first().click();
    await actionByText(page, 'Trade').first().click();
    expect(new URL(page.url()).pathname).toBe(eventPath);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/events/);
    await waitForMainHref(page, ['/event/', '/analysis/']);

    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/event\/world-cup-winner/);
    await expect(page.locator('body')).toContainText(/World Cup Winner|Buy|Sell|Trade/i, { timeout: 45_000 });
  });

  test('TC-FLOW-020 signal related market browser back returns to signal feed', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await expect(page.locator('main')).toContainText(/Show More|Buy YES|AI Recommendation/i, { timeout: 45_000 });

    await clickFirstMainLink(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/signal/);
    await expect(page.locator('main')).toContainText(/Show More|Buy YES|AI Recommendation/i, { timeout: 45_000 });
  });

  test('TC-FLOW-022 events Deep Analysis can continue to a related market', async ({ page }) => {
    await openPath(page, '/events', /\/events/);
    await openFirstMainHref(page, ['/analysis/']);
    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.locator('main')).toContainText(/Historical|Scenario|Market|Consensus|Comparison/i, { timeout: 45_000 });

    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade|Market/i, { timeout: 45_000 });
    await expectNoAppError(page);
  });

  test('TC-FLOW-023 closing auth gate keeps original event trade context', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();
    await expectAuthGate(page);
    await closeOverlay(page);

    await expect(page).toHaveURL(/\/event\//);
    await expect(page.locator('body')).toContainText(/World Cup Winner|Buy|Sell|Trade/i, { timeout: 45_000 });
    await expectNoAppError(page);
  });

  test('TC-FLOW-024 search result filter interaction can return to the previous page cleanly', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await page.goto('/search?q=iran', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/search\?q=iran/i);
    await expect(page.locator('main')).toContainText(/Iran/i, { timeout: 45_000 });

    const filterOrSort = page
      .getByText(/Liquidity|Volume|Latest|Ending Soon|Competitive|流动性|体积|最新|即将结束/i)
      .first();
    if (await filterOrSort.isVisible().catch(() => false)) {
      await filterOrSort.click({ force: true });
      await page.waitForTimeout(1_000);
    }
    await expectNoAppError(page);
    await expect(page.locator('main')).toBeVisible();

    for (let attempt = 0; attempt < 2 && !/\/news$/.test(new URL(page.url()).pathname); attempt += 1) {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expectNoAppError(page);
    }

    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
  });

  test('TC-FLOW-015 invalid detail url does not white-screen', async ({ page }) => {
    await page.goto('/event/not-a-real-case-for-qa', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(
        async () => {
          const bodyText = await page.locator('body').innerText().catch(() => '');
          return bodyText.replace(/\s+/g, ' ').trim();
        },
        { timeout: 25_000 }
      )
      .toMatch(/Unable to Load Data|could not be found|Try Again|Home Market Events News Signal/i);
  });
});
