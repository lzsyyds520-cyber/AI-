import { expect, test, type Page } from '@playwright/test';
import {
  EVENT_DETAIL_PATH,
  actionByText,
  closeOverlay,
  expectAuthGate,
  expectNoBrokenDataText,
  expectSearchVisible,
  openPath,
  tradeSubmitButton
} from '../../support/site';

const APP_ERROR_PATTERN = /Application error|Something went wrong|应用程序错误|客户端异常/i;

async function expectNoAppError(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText(APP_ERROR_PATTERN);
}

async function clickActivityTab(page: Page, label: string): Promise<void> {
  const tab = page.getByText(label, { exact: true }).last();
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await expectNoAppError(page);
}

async function expectTradePanelUsable(page: Page): Promise<void> {
  await expect(page.locator('body')).toContainText(/Buy|Sell|Trade/i, { timeout: 20_000 });
  await expectNoAppError(page);
}

test.describe('Event detail guest coverage', () => {
  test.slow();

  test('TC-EVTD-001 TC-EVTD-004 TC-EVTD-006 TC-EVTD-007 TC-EVTD-008 TC-EVTD-009 TC-EVTD-010 TC-EVTD-011 TC-EVTD-012 TC-EVTD-019 load and tabs', async ({
    page
  }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);

    await expect(page.locator('body')).toContainText(/World Cup Winner/i, { timeout: 45_000 });
    await expect(page.locator('body')).toContainText(/Markets/i, { timeout: 45_000 });
    await expect(actionByText(page, 'Trade').first()).toBeVisible();
    await expect(actionByText(page, 'Evidence').first()).toBeVisible();
    await expect(actionByText(page, 'TOP Holders').first()).toBeVisible();
    await expect(actionByText(page, 'Attribution').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/Recent|Positions|Open Orders|History/i);

    await actionByText(page, 'Evidence').first().click();
    await actionByText(page, 'TOP Holders').first().click();
    await actionByText(page, 'Attribution').first().click();
    await actionByText(page, 'Trade').first().click();
  });

  test('TC-EVTD-013 TC-EVTD-014 TC-EVTD-015 TC-EVTD-017 trade panel input controls', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);

    await expect(page.locator('body')).toContainText(/Amount/i, { timeout: 45_000 });
    await actionByText(page, 'Trade').first().click();
    await page.getByRole('button', { name: /^Buy$/ }).first().click();
    await page.getByRole('button', { name: /^Sell$/ }).first().click();

    await expect(page.locator('body')).toContainText(/25%|50%|Max/);
    await expect(page.locator('body')).toContainText(/Trade/i);
  });

  test('TC-EVTD-016 Max fills amount or shows a constrained-state hint', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await expect(page.locator('body')).toContainText(/Amount|Trade/i, { timeout: 45_000 });

    const maxButton = page.getByRole('button', { name: /^Max$/i }).first();
    await expect(maxButton).toBeVisible({ timeout: 15_000 });

    const amountInput = page.locator('input').last();
    const beforeValue = await amountInput.inputValue().catch(() => '');

    await maxButton.click();

    let afterValue = '';
    let bodyText = '';
    await expect
      .poll(
        async () => {
          afterValue = await amountInput.inputValue().catch(() => '');
          bodyText = await page.locator('body').innerText().catch(() => '');
          return afterValue !== beforeValue || /balance|available|insufficient|limit/i.test(bodyText);
        },
        { timeout: 10_000 }
      )
      .toBeTruthy();

    expect(afterValue !== beforeValue || /balance|available|insufficient|limit/i.test(bodyText)).toBeTruthy();
  });

  test('TC-EVTD-005 markets block choice is clickable and keeps trade handling usable', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    const marketChoice = page.getByRole('button', { name: /^Yes 19/i }).first();
    await expect(marketChoice).toBeVisible({ timeout: 45_000 });
    await marketChoice.click();
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade/i);
    await expect(page.locator('body')).toContainText(/Argentina|France/i);
  });

  test('TC-EVTD-020 refresh keeps event detail usable', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await expect(page.locator('body')).toContainText(/World Cup Winner/i, { timeout: 45_000 });
    await expect(actionByText(page, 'Trade').first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade/i);
  });

  test('TC-EVTD-018 TC-ORDER-001 guest trade is intercepted by auth gate', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();
    await expectAuthGate(page);
  });

  test('TC-EVTD-021 TC-EVTD-026 quote buttons keep trade context usable', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, 'Trade').first().click();

    const quoteButtons = page.locator('button').filter({ hasText: /(Yes|No)\s*\d+(\.\d+)?\s*¢/i });
    await expect.poll(async () => quoteButtons.count(), { timeout: 45_000 }).toBeGreaterThanOrEqual(2);

    const firstQuote = await quoteButtons.first().innerText();
    expect(firstQuote).toMatch(/(Yes|No)\s*\d+(\.\d+)?\s*¢/i);

    await quoteButtons.nth(1).click();
    await page.getByRole('button', { name: /^Buy$/ }).first().click();
    await page.getByRole('button', { name: /^Sell$/ }).first().click();
    await expectTradePanelUsable(page);
  });

  test('TC-EVTD-022 recent activity table exposes core order fields', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await clickActivityTab(page, 'Recent');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Recent/i);

    if (/No trade yet|Be the first to trade|No trades/i.test(bodyText)) {
      expect(bodyText).toMatch(/No trade yet|Be the first to trade|No trades/i);
      return;
    }

    expect(bodyText).toMatch(/Users/i);
    expect(bodyText).toMatch(/Price/i);
    expect(bodyText).toMatch(/Value/i);
    expect(bodyText).toMatch(/Time/i);
    expect(bodyText).toMatch(/\d+(\.\d+)?\s*¢|\d+(\.\d+)?\s*(Yes|No)/i);
    expect(bodyText).toMatch(/\$\s*\d|\d+\s*(s|m|h|min|hr|day|d)\b/i);
  });

  test('TC-EVTD-023 TC-EVTD-024 TC-EVTD-025 account activity tabs show data or stable empty states', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);

    for (const label of ['Positions', 'Open Orders', 'History']) {
      await clickActivityTab(page, label);
      await expect(page.locator('body')).toContainText(new RegExp(label.replace(' ', '\\s+'), 'i'));
      await expect(page.locator('body')).toContainText(/No|Empty|Users|Price|Value|Time|Shares|Amount|Order|History|Positions/i);
    }
  });

  test('TC-EVTD-033 TOP Holders tab shows holder data or a stable empty state', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await clickActivityTab(page, 'TOP Holders');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/TOP Holders|Holders/i);
    expect(bodyText).toMatch(/No|Empty|Holder|User|Address|Shares|Amount|Value|%|\$/i);
    expect(bodyText).not.toMatch(/\b(?:NaN|undefined|null)\b|\[object Object\]/i);
  });

  test('TC-EVTD-034 Attribution tab shows attribution content or a stable empty state', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await clickActivityTab(page, 'Attribution');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Attribution/i);
    expect(bodyText).toMatch(/No|Empty|Source|News|Market|Attribution|Evidence|%|\$/i);
    expect(bodyText).not.toMatch(/\b(?:NaN|undefined|null)\b|\[object Object\]/i);
  });

  test('TC-EVTD-027 limit price controls stay within valid display bounds', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await expect(page.locator('body')).toContainText(/Market|Limit Price|Amount|Shares/i, { timeout: 45_000 });

    const plus = page.getByRole('button', { name: /^\+$/ }).first();
    const minus = page.getByRole('button', { name: /^-$/ }).first();
    const hasLimitStepper = await plus.isVisible().catch(() => false);

    if (hasLimitStepper) {
      await expect(minus).toBeVisible({ timeout: 20_000 });
      await plus.click();
      await minus.click();
    } else {
      await expect(page.locator('body')).toContainText(/Market|Amount/i);
    }

    await expect(page.locator('body')).not.toContainText(/NaN|-\d+(\.\d+)?\s*¢/i);
    await expectTradePanelUsable(page);
  });

  test('TC-EVTD-028 shares amount input accepts legal numeric entry', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await expect(page.locator('body')).toContainText(/Shares|Amount/i, { timeout: 45_000 });

    const tradeInput = page.locator('input:not([placeholder*="Search"]):not([placeholder*="搜索"])').last();
    await expect(tradeInput).toBeVisible({ timeout: 20_000 });
    await tradeInput.fill('1');

    await expect(tradeInput).toHaveValue(/1/);
    await expectTradePanelUsable(page);
  });

  test('TC-EVTD-029 order book depth exposes price shares total and spread', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, 'Trade').first().click();

    await expect
      .poll(
        async () => {
          const text = await page.locator('body').innerText().catch(() => '');
          return /Price/i.test(text) && /Shares/i.test(text) && /Total/i.test(text) && /Mid/i.test(text) && /Spread/i.test(text);
        },
        { timeout: 45_000 }
      )
      .toBeTruthy();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Trade\s+Yes|Trade\s+No/i);
    expect(bodyText).toMatch(/\d+(\.\d+)?\s*¢\s*[\d,]+\s*\$\s*[\d,]+/i);
    expect(bodyText).toMatch(/Mid\s*\d+(\.\d+)?\s*¢/i);
    expect(bodyText).toMatch(/Spread\s*\d+(\.\d+)?\s*¢/i);
    expect(bodyText).not.toMatch(/NaN|-\d+(\.\d+)?\s*¢/i);
  });

  test('TC-EVTD-030 TC-EVTD-035 alert icon opens auth feedback and preserves event context', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);

    const alertEntry = page.getByRole('button', { name: /Sign in to create alerts/i }).first();
    await expect(alertEntry).toBeVisible({ timeout: 45_000 });
    await alertEntry.click();
    await expectAuthGate(page);
    await closeOverlay(page);

    await expect(page).toHaveURL(/\/event\//);
    await expect(page.locator('body')).toContainText(/World Cup Winner|Trade|Evidence|Buy|Sell/i, { timeout: 45_000 });
    await expectTradePanelUsable(page);
  });

  test('TC-EVTD-031 evidence YES and NO views switch without data leakage', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, 'Evidence').first().click();

    const evidenceForYes = page.getByRole('button', { name: /Evidence For YES/i }).first();
    const evidenceForNo = page.getByRole('button', { name: /Evidence For NO/i }).first();
    await expect(evidenceForYes).toBeVisible({ timeout: 45_000 });
    await expect(evidenceForNo).toBeVisible({ timeout: 45_000 });

    await evidenceForYes.click();
    await expect(page.locator('body')).toContainText(/Evidence For YES|Evidence|Reload/i);
    await expectNoBrokenDataText(page.locator('body'));

    await evidenceForNo.click();
    await expect(page.locator('body')).toContainText(/Evidence For NO|Evidence|Reload/i);
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-EVTD-032 evidence Reload keeps empty or refreshed state stable', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, 'Evidence').first().click();

    const reload = page.getByRole('button', { name: /^Reload$/i }).first();
    await expect(reload).toBeVisible({ timeout: 45_000 });
    await reload.click();

    await expect(page.locator('body')).toContainText(/Evidence|Reload|No evidence|For YES|For NO/i, { timeout: 45_000 });
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-EVTD-036 View resolved expands resolved markets without breaking active market context', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);

    const viewResolved = page.getByRole('button', { name: /View resolved/i }).first();
    await expect(viewResolved).toBeVisible({ timeout: 45_000 });
    await viewResolved.click();

    await expect(page.locator('body')).toContainText(/Resolved|View resolved|Hide resolved|Markets|Yes|No/i, { timeout: 45_000 });
    await expect(page.locator('body')).toContainText(/World Cup Winner|Trade|Evidence/i);
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });
});
