import { expect, test, type Page } from '@playwright/test';
import {
  actionByText,
  clickFirstMainLink,
  expectNoBrokenDataText,
  expectSearchVisible,
  openPath,
  runGlobalHeaderSearch
} from '../../support/site';

test.describe('Signal page guest coverage', () => {
  test.slow();

  async function waitForSignalReady(page: Page): Promise<void> {
    await expect(page.locator('main')).toContainText(/Show More|Buy YES|AI Recommendation/i, { timeout: 45_000 });
  }

  function numericPrice(value: string): number | null {
    const match = value.match(/(\d+(?:\.\d+)?)\s*(?:¢|%)/);
    return match ? Number(match[1]) : null;
  }

  test('TC-SIG-001 TC-SIG-002 TC-SIG-003 TC-SIG-004 TC-SIG-005 TC-SIG-006 TC-SIG-007 TC-SIG-008 TC-SIG-009 TC-SIG-011 TC-SIG-017 page modules render', async ({
    page
  }) => {
    await openPath(page, '/signal', /\/signal/);
    await expectSearchVisible(page);
    await waitForSignalReady(page);
    await expect(page.locator('main')).toContainText(/3-Dimension Cross-Validation/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/AI Recommendation/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/PRICE|Price/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/wallet|volume/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/Multi-Wallet/i, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText(/Coming Soon|Crowd Divergence|News Timing/i, { timeout: 45_000 });
  });

  test('TC-SIG-010 TC-SIG-019 TC-SIG-020 TC-SIG-021 TC-SIG-022 card AI analysis expands with core fields', async ({
    page
  }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);
    await actionByText(page, 'Show More').first().click();
    await expect(page.locator('main')).toContainText(/Suggested Action|Entry Price/i);
    await expect(page.locator('main')).toContainText(/Reason|Risk|Confidence|AI Recommendation|Recommended|Action/i);
    await expectNoBrokenDataText(page.locator('main'));
  });

  test('TC-SIG-012 TC-FLOW-003 related market jump', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);
    await clickFirstMainLink(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
  });

  test('TC-SIG-013 TC-FLOW-004 buy entry opens trade handling path', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);
    await page.getByRole('button', { name: /Buy YES/i }).first().click();
    await expect(page.locator('body')).toContainText(/By trading, you agree to the Terms of Use|Trade/i);
  });

  test('TC-SIG-024 Buy NO entry opens the matching trade handling path', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);

    const buyNo = page.getByRole('button', { name: /Buy NO/i }).first();
    await expect(buyNo).toBeVisible({ timeout: 30_000 });
    await buyNo.click();

    await expect(page.locator('body')).toContainText(/Trade|Buy|Sell|Connect to PredX|By trading, you agree/i, { timeout: 45_000 });
    await expect(page.locator('body')).toContainText(/No|NO/i);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-SIG-023 signal recommendation price and related market price stay directionally aligned', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);

    const signalCard = page.locator('main').locator('xpath=.//*[.//button[contains(., "Buy ")] and .//a[contains(@href, "/event/")]]').first();
    await expect(signalCard).toBeVisible({ timeout: 45_000 });

    const cardText = await signalCard.innerText();
    const buyButtonText = await signalCard.getByRole('button', { name: /Buy (YES|NO)/i }).first().innerText();
    const relatedMarketText = await signalCard.locator('a[href*="/event/"]').first().innerText();

    const buttonPrice = numericPrice(buyButtonText);
    const relatedPrice = numericPrice(relatedMarketText);

    expect(buyButtonText).toMatch(/Buy (YES|NO) at \d+(\.\d+)?¢/i);
    expect(cardText).toMatch(/Price|AI Recommendation|Related Market/i);
    expect(buttonPrice).not.toBeNull();
    expect(relatedPrice).not.toBeNull();
    expect(Math.abs((buttonPrice ?? 0) - (relatedPrice ?? 0))).toBeLessThanOrEqual(5);
    await expectNoBrokenDataText(signalCard);
  });

  test('TC-SIG-025 consecutive signal card expansions stay independent and usable', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);

    const showMoreButtons = page.getByRole('button', { name: /Show More/i });
    await expect.poll(async () => showMoreButtons.count(), { timeout: 45_000 }).toBeGreaterThanOrEqual(2);

    await showMoreButtons.nth(0).click();
    await expect(page.locator('main')).toContainText(/Suggested Action|Entry Price|AI Recommendation/i, { timeout: 20_000 });

    await showMoreButtons.nth(1).click();
    await expect(page.locator('main')).toContainText(/Suggested Action|Entry Price|AI Recommendation/i, { timeout: 20_000 });

    await expect.poll(async () => showMoreButtons.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator('main')).toContainText(/Related Market|Participant Addresses|Trading Recommendation|AI Recommendation/i);
    await expectNoBrokenDataText(page.locator('main'));
  });

  test('TC-SIG-026 slow signal API still resolves to usable cards', async ({ page }) => {
    await page.route('**/api/v1/signals/?limit=10&offset=0&signal_type=cross_validated', async (route) => {
      await page.waitForTimeout(1_500);
      await route.continue();
    });

    await page.goto('/signal', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('body')).toContainText(/Signal|AI Recommendation|Show More|Buy YES|Buy NO/i, { timeout: 60_000 });
    await waitForSignalReady(page);
    await expectNoBrokenDataText(page.locator('main'));
  });

  test('TC-SIG-027 signal API failure keeps page recoverable', async ({ page }) => {
    await page.route('**/api/v1/signals/?limit=10&offset=0&signal_type=cross_validated', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'QA simulated signal failure' })
      });
    });

    await page.goto('/signal', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await expect(page.locator('body')).not.toContainText(/Application error|Something went wrong|应用程序错误|客户端异常/i);
    await expect(page.locator('body')).toContainText(/Signal|No|Empty|Error|Retry|Failed|Try|AI Recommendation|Show More/i, {
      timeout: 30_000
    });
  });

  test('TC-SIG-014 TC-SIG-015 TC-SIG-016 signal header search should route to global search page', async ({
    page
  }) => {
    await openPath(page, '/signal', /\/signal/);

    await runGlobalHeaderSearch(page, 'iran');
    await expect(page).toHaveURL(/\/search\?q=iran/i);
  });

  test('TC-SIG-018 refresh keeps signal page usable', async ({ page }) => {
    await openPath(page, '/signal', /\/signal/);
    await waitForSignalReady(page);
    await expect(page.locator('main')).toContainText(/AI Recommendation/i, { timeout: 45_000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await waitForSignalReady(page);
    await expect(page.locator('main')).toContainText(/AI Recommendation/i, { timeout: 45_000 });
  });
});
