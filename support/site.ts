import { expect, type Locator, type Page } from '@playwright/test';

export const SEARCH_PLACEHOLDER = /Search Markets or Events|搜索市场或活动/i;
export const EVENT_DETAIL_PATH = '/event/world-cup-winner';
export const ANALYSIS_DETAIL_PATH = '/analysis/story_275631';
export const ANALYSIS_EVENT_DETAIL_PATH = '/analysis/story_320162';
export const ANALYSIS_NON_MACRO_DETAIL_PATH = '/analysis/story_275582';
export const EVENT_MARKET_FLOW_PATH = '/event/what-will-be-in-a-us-iran-deal-in-2026-20260624150226501';
export const APP_ERROR_PATTERN = /Application error|Something went wrong|应用程序错误|客户端异常/i;
export const BROKEN_DATA_PATTERN = /\b(?:NaN|undefined|null)\b|\[object Object\]/i;

const NAV_LABELS = ['Home', 'Market', 'Events', 'News', 'Signal'] as const;
function activeSearchInput(page: Page): Locator {
  return page.getByPlaceholder(SEARCH_PLACEHOLDER).first();
}

export function actionByText(page: Page, text: string): Locator {
  return page
    .getByRole('link', { name: text, exact: true })
    .or(page.getByRole('button', { name: text, exact: true }))
    .or(page.getByText(text, { exact: true }).first());
}

export function tradeSubmitButton(page: Page): Locator {
  return page.getByRole('button', { name: /^(Trade|交易)$/i }).last();
}

export async function openPath(page: Page, path: string, expectedUrl: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'commit', timeout: 60_000 });
      break;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }

      await page.waitForTimeout(1_000);
    }
  }
  await expect(page).toHaveURL(expectedUrl);
}

export async function expectCurrentUrl(page: Page, expectedUrl: RegExp): Promise<void> {
  await expect(page).toHaveURL(expectedUrl);
}

export async function expectGlobalNav(page: Page): Promise<void> {
  for (const label of NAV_LABELS) {
    await expect(actionByText(page, label).first()).toBeVisible();
  }
}

export async function expectSearchVisible(page: Page): Promise<void> {
  await expect(activeSearchInput(page)).toBeVisible();
}

export async function expectNoAppError(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText(APP_ERROR_PATTERN);
}

export async function expectNoBrokenDataText(locator: Locator): Promise<void> {
  const text = await locator.innerText();
  expect(text).not.toMatch(BROKEN_DATA_PATTERN);
}

export async function runSearch(page: Page, term: string): Promise<void> {
  const search = activeSearchInput(page);
  await expect(search).toBeVisible();
  await search.fill(term);
  await expect(search).toHaveValue(term);
  await search.press('Enter');
}

export async function runGlobalHeaderSearch(page: Page, term: string): Promise<void> {
  const search = activeSearchInput(page);
  await expect(search).toBeVisible({ timeout: 20_000 });
  await search.scrollIntoViewIfNeeded();
  await page.waitForLoadState('domcontentloaded');
  await expect
    .poll(async () => (await search.isEnabled().catch(() => false)), { timeout: 15_000 })
    .toBeTruthy();
  const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await search.click();
    await page.keyboard.press(selectAllShortcut);
    await page.keyboard.press('Backspace');
    await page.keyboard.type(term, { delay: 50 });

    if ((await search.inputValue().catch(() => '')) !== term) {
      await search.evaluate((node, value) => {
        const input = node as HTMLInputElement;
        input.focus();
        input.value = value as string;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value as string, inputType: 'insertText' }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, term);
    }

    if ((await search.inputValue().catch(() => '')) === term) {
      for (const pressEnter of [() => search.press('Enter'), () => page.keyboard.press('Enter')]) {
        const routePromise = page
          .waitForURL(
            (url) => url.pathname === '/search' && (url.searchParams.get('q') ?? '').toLowerCase() === term.toLowerCase(),
            { timeout: 10_000 }
          )
          .catch(() => null);
        await pressEnter();
        await routePromise;

        const currentUrl = new URL(page.url());
        if (currentUrl.pathname === '/search' && (currentUrl.searchParams.get('q') ?? '').toLowerCase() === term.toLowerCase()) {
          return;
        }
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Global header search did not route to search results for term: ${term}`);
}

export async function clearSearch(page: Page): Promise<void> {
  const search = activeSearchInput(page);
  await search.fill('');
  await expect(search).toHaveValue('');
}

export async function clickFirstMainLink(page: Page, hrefFragments: string[]): Promise<void> {
  const selector = hrefFragments.map((fragment) => `main a[href*="${fragment}"]`).join(', ');
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  await target.click();
}

export async function clickFirstVisibleLink(page: Page, hrefFragments: string[]): Promise<void> {
  const selector = hrefFragments.map((fragment) => `a[href*="${fragment}"]`).join(', ');
  const target = page.locator(selector).filter({ visible: true }).first();
  await expect(target).toBeVisible({ timeout: 45_000 });
  await target.click();
}

export async function waitForMainHref(page: Page, hrefFragments: string[], timeout = 45_000): Promise<void> {
  await expect
    .poll(
      async () =>
        page.locator('main a').evaluateAll((nodes, fragments) => {
          return nodes.filter((node) => {
            const hrefValue = node.getAttribute('href') ?? '';
            return fragments.some((fragment) => hrefValue.includes(fragment));
          }).length;
        }, hrefFragments),
      { timeout }
    )
    .toBeGreaterThan(0);
}

export async function waitForMarketCatalog(page: Page): Promise<void> {
  const marketLinks = ['main a[href*="/event/"]', 'main a[href*="/market/"]'].join(', ');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await expect
        .poll(
          async () => {
            const cryptoVisible = await actionByText(page, 'Crypto')
              .first()
              .isVisible()
              .catch(() => false);
            const marketLinkCount = await page.locator(marketLinks).count().catch(() => 0);

            return cryptoVisible && marketLinkCount > 0;
          },
          { timeout: 25_000 }
        )
        .toBeTruthy();

      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2_000);
    }
  }
}

export async function openFirstMainHref(page: Page, hrefFragments: string[]): Promise<void> {
  await waitForMainHref(page, hrefFragments);

  const href = await page.locator('main a').evaluateAll((nodes, fragments) => {
    const match = nodes.find((node) => {
      const hrefValue = node.getAttribute('href') ?? '';
      return fragments.some((fragment) => hrefValue.includes(fragment));
    });

    return match?.getAttribute('href') ?? null;
  }, hrefFragments);

  if (!href) {
    throw new Error(`No main anchor matched fragments: ${hrefFragments.join(', ')}`);
  }

  await page.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded' });
}

export async function openTopSignInModal(page: Page): Promise<void> {
  const signIn = page.getByRole('button', { name: /sign in/i }).first();
  const openers: Array<() => Promise<void>> = [
    async () => {
      await signIn.click();
    },
    async () => {
      await signIn.click({ force: true });
    },
    async () => {
      await signIn.hover();
      await signIn.click({ force: true });
    },
    async () => {
      await signIn.focus();
      await page.keyboard.press('Enter');
    },
    async () => {
      await signIn.evaluate((node) => {
        (node as HTMLElement).click();
      });
    }
  ];

  for (let round = 0; round < 2; round += 1) {
    await expect(signIn).toBeVisible();
    await signIn.scrollIntoViewIfNeeded();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);

    for (const open of openers) {
      await open();
      await page.waitForTimeout(1_200);

      if (await authGateVisible(page)) {
        return;
      }
    }

    if (round === 0) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
  }

  throw new Error('Global Sign In did not open the Connect to PredX dialog');
}

function authModal(page: Page): Locator {
  return page.getByRole('dialog', { name: /Connect to PredX/i }).first();
}

function authEmailInput(page: Page): Locator {
  return authModal(page).locator('input[placeholder="you@example.com"]').first();
}

async function authGateVisible(page: Page): Promise<boolean> {
  const checks = [
    authModal(page).isVisible().catch(() => false),
    authEmailInput(page).isVisible().catch(() => false),
    page.getByText(/Connect to PredX/i).first().isVisible().catch(() => false),
    page.getByText(/Continue with Email/i).first().isVisible().catch(() => false)
  ];

  return (await Promise.all(checks)).some(Boolean);
}

export async function expectAuthGate(page: Page): Promise<void> {
  await expect(authModal(page)).toBeVisible();
  await expect(authEmailInput(page)).toBeVisible();
}

export async function closeOverlay(page: Page): Promise<void> {
  const modal = authModal(page);
  const closeTrigger = modal
    .locator('button')
    .first()
    .or(page.getByRole('button', { name: /close/i }).first())
    .or(page.locator('[aria-label*="close" i]').first());

  if (await closeTrigger.isVisible().catch(() => false)) {
    await closeTrigger.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(modal).toBeHidden();
}

export async function expectAnyMainText(page: Page, patterns: RegExp[]): Promise<void> {
  const main = page.locator('main');

  for (const pattern of patterns) {
    const match = main.getByText(pattern).first();
    if (await match.isVisible().catch(() => false)) {
      await expect(match).toBeVisible();
      return;
    }
  }

  throw new Error(`None of the expected patterns were visible: ${patterns.map(String).join(', ')}`);
}
