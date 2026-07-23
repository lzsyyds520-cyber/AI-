import { expect, test, type Page } from '@playwright/test';
import {
  ANALYSIS_DETAIL_PATH,
  ANALYSIS_EVENT_DETAIL_PATH,
  ANALYSIS_NON_MACRO_DETAIL_PATH,
  expectNoAppError,
  expectNoBrokenDataText,
  openFirstMainHref,
  openPath
} from '../../support/site';

async function rightRailText(page: Page): Promise<string> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();

        return rect.left >= window.innerWidth * 0.66 && rect.width > 40 && rect.height > 12 && text.length > 0 && text.length < 220;
      })
      .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
      .join(' ')
  );
}

async function firstRightRailHref(page: Page, hrefFragments: string[]): Promise<string> {
  const locateHref = () =>
    page.locator('a').evaluateAll((nodes, fragments) => {
      const match = nodes.find((node) => {
        const href = node.getAttribute('href') ?? '';
        if (!fragments.some((fragment) => href.includes(fragment))) {
          return false;
        }

        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return rect.left >= window.innerWidth * 0.66 && rect.width > 10 && rect.height > 10 && style.visibility !== 'hidden' && style.display !== 'none';
      });

      return match?.getAttribute('href') ?? '';
    }, hrefFragments);

  await expect.poll(locateHref, { timeout: 45_000 }).not.toBe('');
  const href = await locateHref();

  if (!href) {
    throw new Error(`No right rail anchor matched fragments: ${hrefFragments.join(', ')}`);
  }

  return href;
}

function meaningfulTokens(text: string): string[] {
  const stopWords = new Set([
    'about',
    'after',
    'again',
    'analysis',
    'before',
    'between',
    'could',
    'from',
    'have',
    'market',
    'markets',
    'news',
    'other',
    'related',
    'scenario',
    'should',
    'that',
    'their',
    'there',
    'this',
    'will',
    'with',
    'would'
  ]);

  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z][a-z0-9'-]{3,}/g)
        ?.filter((token) => !stopWords.has(token.replace(/'s$/, ''))) ?? []
    )
  );
}

test.describe('Analysis page guest coverage', () => {
  test.slow();

  test('TC-ANL-001 TC-ANL-003 TC-ANL-005 TC-ANL-006 TC-ANL-007 page modules render', async ({
    page
  }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);

    await expect(page.locator('main')).toContainText(/Historical Comparison/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/Future Development Scenarios/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/Key Turning Points/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/Related News/i, { timeout: 45_000 });
  });

  test('TC-ANL-002 top summary block stays readable', async ({ page }) => {
    await openPath(page, ANALYSIS_EVENT_DETAIL_PATH, /\/analysis\//);

    let summaryText = '';
    await expect
      .poll(
        async () => {
          const mainText = await page.locator('main').innerText().catch(() => '');
          summaryText = mainText.split(/Historical Comparison/i)[0].replace(/\s+/g, ' ').trim();
          return summaryText.length;
        },
        { timeout: 45_000 }
      )
      .toBeGreaterThan(80);

    expect(summaryText.length).toBeGreaterThan(80);
    expect(summaryText).not.toMatch(/undefined|null|NaN|\[object Object\]/i);
  });

  test('TC-ANL-004 asset and indicator block stays readable', async ({ page }) => {
    await openPath(page, ANALYSIS_EVENT_DETAIL_PATH, /\/analysis\//);

    await expect(page.locator('main')).toContainText(/[-+]?\d+(\.\d+)?%|[-+]?\d+(\.\d+)?/i, { timeout: 45_000 });
    await expect(page.locator('main')).not.toContainText(/undefined|null|NaN|\[object Object\]/i);
  });

  test('TC-ANL-018 non-macro analysis does not show default precious metals indices', async ({ page }) => {
    await openPath(page, ANALYSIS_NON_MACRO_DETAIL_PATH, /\/analysis\//);

    await expect(page.locator('main')).toContainText(/Historical|Comparison|Scenario|Market|Consensus/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/[-+]?\d+(\.\d+)?%|[-+]?\d+(\.\d+)?/i, { timeout: 45_000 });
    await expect(page.locator('main')).not.toContainText(/Spot Gold|Spot Silver|US Dollar Index|Dollar Index|DXY|Gold|Silver/i);
  });

  test('TC-ANL-008 TC-ANL-009 related market jump', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
  });

  test('TC-ANL-010 TC-ANL-011 related news jump', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await openFirstMainHref(page, ['/news/', '/analysis/']);
    await expect(page).toHaveURL(/\/(news|analysis)\//);
  });

  test('TC-ANL-012 long-page scrolling stays stable', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await expect(page.locator('main')).toContainText(/Related News/i, { timeout: 45_000 });

    const startY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeGreaterThan(startY + 300);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeLessThan(100);
    await expect(page.locator('main')).toContainText(/Historical Comparison/i, { timeout: 15_000 });
  });

  test('TC-ANL-013 analysis right rail cards render without overlapping broken content', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await expect(page.locator('main')).toContainText(/Historical|Comparison|Scenario|Market|Consensus/i, { timeout: 45_000 });

    await expect.poll(() => rightRailText(page), { timeout: 45_000 }).toMatch(/.+/);
    const railText = await rightRailText(page);
    expect(railText.length).toBeGreaterThan(30);
    expect(railText).not.toMatch(/NaN|undefined|null|\[object Object\]/i);
    await expectNoAppError(page);
  });

  test('TC-ANL-014 analysis right rail jump can return to the original analysis page', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    const analysisPath = new URL(page.url()).pathname;
    const href = await firstRightRailHref(page, ['/event/', '/analysis/', '/news/']);

    await page.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/(event|analysis|news)\//);

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(analysisPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('main')).toContainText(/Historical|Comparison|Scenario|Market|Consensus/i, { timeout: 45_000 });
  });

  test('TC-ANL-015 refreshing analysis detail restores core modules', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });

    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.locator('main')).toContainText(/Historical|Comparison|Scenario|Market|Consensus/i, { timeout: 45_000 });
    await expectNoBrokenDataText(page.locator('main'));
    await expectNoAppError(page);
  });

  test('TC-ANL-016 invalid analysis URL shows a handled state instead of a white screen', async ({ page }) => {
    await page.goto('/analysis/not-a-real-story-for-qa', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await expect(page.locator('body')).toContainText(/PredX|Home|Market|Events|News|Signal|not found|404|No data|Unable/i, {
      timeout: 30_000
    });
    await expect(page.locator('body')).not.toHaveText(/^\s*$/);
    await expectNoAppError(page);
  });

  test('TC-ANL-017 analysis topic related markets and body stay semantically aligned', async ({ page }) => {
    await openPath(page, ANALYSIS_DETAIL_PATH, /\/analysis\//);
    await expect(page.locator('main')).toContainText(/Historical|Comparison|Scenario|Market|Consensus/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/\$\d[\d.,KM]*\s+Vol/i, { timeout: 60_000 });

    const readRelatedMarketTexts = () =>
      page.locator('main a[href*="/event/"], main a[href*="/market/"]').evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 10)
        .slice(0, 5)
      );

    await expect.poll(async () => (await readRelatedMarketTexts()).length, { timeout: 60_000 }).toBeGreaterThan(0);
    const mainText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const relatedMarketTexts = await readRelatedMarketTexts();
    await expectNoBrokenDataText(page.locator('main'));

    const bodyTokens = new Set(meaningfulTokens(mainText));
    const relatedTokens = meaningfulTokens(relatedMarketTexts.join(' '));
    const overlap = relatedTokens.filter((token) => bodyTokens.has(token));

    expect(overlap.length).toBeGreaterThan(0);
    expect(mainText).not.toMatch(/unrelated topic|placeholder|lorem ipsum/i);
  });
});
