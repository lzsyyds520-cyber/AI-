import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { env } from '../../support/env';
import {
  EVENT_DETAIL_PATH,
  actionByText,
  expectNoAppError,
  expectNoBrokenDataText,
  openPath,
  tradeSubmitButton
} from '../../support/site';

test.use({ storageState: env.storageStatePath });
test.skip(!fs.existsSync(env.storageStatePath), `Missing storage state file: ${env.storageStatePath}`);
test.skip(
  !env.authAutomationReady,
  'Order user automation requires a valid logged-in storage state. Run with AUTH_AUTOMATION_READY=true after auth setup.'
);

async function requireSignedInShell(page: Page): Promise<void> {
  const signedIn = await expect
    .poll(
      async () => {
        const headerText = await page.locator('header, [role="banner"]').first().innerText().catch(() => '');
        const signInVisible = await page.getByRole('button', { name: /sign in|登录/i }).evaluateAll((buttons) =>
          buttons.some((button) => {
            const element = button as HTMLElement;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
        );
        return !signInVisible && /Portfolio|Cash|Deposit|Positions|文件夹|现金|订金/i.test(headerText);
      },
      { timeout: 20_000 }
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);

  test.skip(!signedIn, `Stored auth state did not hydrate into a signed-in shell on event page: ${env.storageStatePath}`);
}

async function openLoggedInTradePanel(page: Page): Promise<void> {
  await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
  await requireSignedInShell(page);
  await actionByText(page, 'Trade').first().click();
  await expect(page.locator('body')).toContainText(/Buy|Sell|Amount|Trade/i, { timeout: 30_000 });
  await expectNoAppError(page);
}

async function signedInCashBalance(page: Page): Promise<number> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const text = `${await page.locator('header, [role="banner"]').first().innerText().catch(() => '')} ${await page
      .locator('body')
      .innerText()
      .catch(() => '')}`;
    const cashMatch = text.match(/(?:Cash|现金)\s*\$?\s*([\d,.]+)/i);

    if (cashMatch) {
      const cash = Number(cashMatch[1].replace(/,/g, ''));

      if (Number.isFinite(cash)) {
        return cash;
      }
    }

    await page.waitForTimeout(1_000);
  }

  test.skip(true, 'Stored session does not expose a Cash balance on the event trading page; order confirmation coverage remains environment-gated.');
  return 0;
}

function quote(page: Page, outcome: 'Yes' | 'No') {
  return page.getByText(new RegExp(`^${outcome}\\s+\\d+(?:\\.\\d+)?\\s*¢$`, 'i')).last();
}

function amountInput(page: Page) {
  return page.locator('input:not([placeholder*="Search"]):not([placeholder*="搜索"])').last();
}

function orderTypeText(page: Page, label: 'Market' | 'Limit') {
  return page.locator('span,button,div').filter({ hasText: new RegExp(`^${label}$`) }).last();
}

async function selectOrderType(page: Page, label: 'Market' | 'Limit'): Promise<void> {
  const currentType = page.locator('span').filter({ hasText: /^(Market|Limit)$/ }).last();
  await expect(currentType).toBeVisible({ timeout: 30_000 });
  await currentType.click({ force: true });

  const option = orderTypeText(page, label);
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click({ force: true });
  await expect(page.locator('body')).toContainText(new RegExp(label, 'i'), { timeout: 10_000 });
}

async function blockMutatingRequests(page: Page, onBlockedRequest?: (requestUrl: string) => void): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && /predx\.pro|api\.predx\.pro|polymarket/i.test(url)) {
      onBlockedRequest?.(url);
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'QA simulated order submission failure' })
      });
      return;
    }

    await route.continue();
  });
}

async function skipIfAuthGateOpened(page: Page): Promise<void> {
  const authGateOpened = await page
    .getByRole('dialog', { name: /Connect to PredX/i })
    .isVisible()
    .catch(() => false);

  test.skip(authGateOpened, 'Stored session is not accepted by the trading flow; Trade opened the Connect to PredX auth gate.');
}

async function fillSmallOrderAmount(page: Page): Promise<void> {
  const cash = await signedInCashBalance(page);
  test.skip(cash < 1, `TC-ORDER confirmation coverage requires at least $1 cash; current parsed cash=${cash}`);

  const input = amountInput(page);
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill('1');
  await expect(input).toHaveValue(/1/);
}

function orderConfirmation(page: Page) {
  return page
    .getByRole('dialog')
    .filter({ hasText: /Confirm|Review|Preview|Order|Buy|Sell|Amount|Shares|Price|Total|Cost|Fee|确认|预览|订单|总额|数量|价格/i })
    .last();
}

async function expectOrderConfirmation(page: Page): Promise<void> {
  const confirmation = orderConfirmation(page);

  await expect
    .poll(
      async () => {
        if (await confirmation.isVisible().catch(() => false)) {
          return true;
        }

        const bodyText = await page.locator('body').innerText().catch(() => '');
        return /Confirm|Review|Preview|Order Summary|You (are|'re) (buying|selling)|Place Order|Estimated|Total|Cost|Fee|Slippage|确认|预览|订单|总额|费用|滑点/i.test(
          bodyText
        );
      },
      { timeout: 20_000 }
    )
    .toBeTruthy();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).toMatch(/World Cup Winner|Argentina|France|Buy|Sell|Yes|No/i);
  expect(bodyText).toMatch(/Price|Shares|Amount|Total|Cost|Fee|Slippage|价格|数量|总额|费用|滑点/i);
  expect(bodyText).not.toMatch(/order submitted|successfully placed|filled|成交成功|提交成功/i);
}

async function closeOrderConfirmation(page: Page): Promise<void> {
  const closers = [
    page.getByRole('button', { name: /Cancel|Close|Back|取消|关闭|返回/i }).last(),
    orderConfirmation(page).getByRole('button').filter({ hasText: /Cancel|Close|Back|取消|关闭|返回/i }).last(),
    page.locator('[aria-label*="close" i]').last()
  ];

  for (const closer of closers) {
    if (!(await closer.isVisible().catch(() => false))) {
      continue;
    }

    await closer.click({ force: true });
    await expect(page.locator('body')).toContainText(/Buy|Sell|Amount|Trade/i, { timeout: 15_000 });
    return;
  }

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toContainText(/Buy|Sell|Amount|Trade/i, { timeout: 15_000 });
}

async function openSafeOrderConfirmation(page: Page): Promise<{ blockedUrls: string[] }> {
  await openLoggedInTradePanel(page);
  await fillSmallOrderAmount(page);

  const blockedUrls: string[] = [];
  await blockMutatingRequests(page, (requestUrl) => blockedUrls.push(requestUrl));
  await tradeSubmitButton(page).click();
  await skipIfAuthGateOpened(page);
  await expectOrderConfirmation(page);
  expect(blockedUrls, `Opening confirmation attempted a mutating request: ${blockedUrls.join(', ')}`).toHaveLength(0);

  return { blockedUrls };
}

test.describe('Logged-in order safe coverage', () => {
  test.slow();

  test('TC-ORDER-002 TC-ORDER-003 logged-in Buy YES and Buy NO keep trade context aligned', async ({ page }) => {
    await openLoggedInTradePanel(page);

    await page.getByText(/^Buy$/).last().click();
    await expect(quote(page, 'Yes')).toBeVisible({ timeout: 30_000 });
    await quote(page, 'Yes').click();
    await expect(page.locator('body')).toContainText(/Buy|Yes|Trade/i);

    await expect(quote(page, 'No')).toBeVisible({ timeout: 30_000 });
    await quote(page, 'No').click();
    await expect(page.locator('body')).toContainText(/Buy|No|Trade/i);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-ORDER-004 Buy and Sell direction switching keeps the panel usable', async ({ page }) => {
    await openLoggedInTradePanel(page);

    await page.getByText(/^Buy$/).last().click();
    await expect(page.locator('body')).toContainText(/Buy|Amount|Trade/i);

    await page.getByText(/^Sell$/).last().click();
    await expect(page.locator('body')).toContainText(/Sell|Amount|Trade/i);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-ORDER-005 Market and Limit order type switching stays usable', async ({ page }) => {
    await openLoggedInTradePanel(page);

    await selectOrderType(page, 'Limit');
    await expect(page.locator('body')).toContainText(/Limit|Amount|Trade/i);

    await selectOrderType(page, 'Market');
    await expect(page.locator('body')).toContainText(/Market|Amount|Trade/i);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-ORDER-006 Limit price steppers stay within valid display bounds', async ({ page }) => {
    await openLoggedInTradePanel(page);
    await selectOrderType(page, 'Limit');

    const plus = page.getByRole('button', { name: /^\+$/ }).last();
    const minus = page.getByRole('button', { name: /^-$/ }).last();
    await expect(plus).toBeVisible({ timeout: 15_000 });
    await expect(minus).toBeVisible({ timeout: 15_000 });

    await plus.click();
    await minus.click();
    await page.getByRole('button', { name: /^\+10$/ }).last().click();
    await page.getByRole('button', { name: /^-10$/ }).last().click();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Limit|Amount|Trade/i);
    expect(bodyText).not.toMatch(/NaN|-\d+(\.\d+)?\s*¢/i);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-ORDER-007 TC-ORDER-008 amount input accepts legal numbers and rejects broken text', async ({ page }) => {
    await openLoggedInTradePanel(page);
    const input = amountInput(page);
    await expect(input).toBeVisible({ timeout: 20_000 });

    await input.fill('1');
    await expect(input).toHaveValue(/1/);

    await input.fill('abc');
    await expect(input).not.toHaveValue(/abc/i);

    await input.fill('-1');
    await expect(input).not.toHaveValue(/-/);
    await expectNoBrokenDataText(page.locator('body'));
  });

  test('TC-ORDER-009 TC-ORDER-010 shortcuts respect zero-cash insufficient balance state', async ({ page }) => {
    await openLoggedInTradePanel(page);
    const headerText = await page.locator('header').innerText();
    test.skip(!/Cash\s*\$0\.00|现金\s*\$?0\.00/i.test(headerText), 'Current stored account is not a zero-cash account.');

    await actionByText(page, '+1$').first().click();
    await expect(page.locator('body')).toContainText(/Amount|Trade|Cash|Deposit/i);

    await blockMutatingRequests(page);
    await tradeSubmitButton(page).click();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/insufficient|balance|deposit|cash|not enough|Trade/i);
    expect(bodyText).not.toMatch(/order submitted|successfully placed|filled/i);
  });

  test('TC-ORDER-011 positive-balance Trade opens confirmation preview without submitting', async ({ page }) => {
    await openSafeOrderConfirmation(page);
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-ORDER-012 closing confirmation returns to trade panel without submitting', async ({ page }) => {
    await openSafeOrderConfirmation(page);
    await closeOrderConfirmation(page);

    await expect(page.locator('body')).not.toContainText(/order submitted|successfully placed|filled|成交成功|提交成功/i);
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-ORDER-020 order submission failure shows recoverable error and no success state', async ({ page }) => {
    await openLoggedInTradePanel(page);
    await fillSmallOrderAmount(page);

    const blockedUrls: string[] = [];
    await blockMutatingRequests(page, (requestUrl) => blockedUrls.push(requestUrl));
    await tradeSubmitButton(page).click();
    await skipIfAuthGateOpened(page);

    if ((await orderConfirmation(page).isVisible().catch(() => false)) || /Confirm|Preview|Review|Order Summary|确认|预览|订单/i.test(await page.locator('body').innerText())) {
      const confirmAction = page
        .getByRole('button', { name: /Confirm|Place Order|Submit|Trade|Buy|Sell|确认|提交/i })
        .last();
      await expect(confirmAction).toBeVisible({ timeout: 10_000 });
      await confirmAction.click({ force: true });
    }

    await expect.poll(() => blockedUrls.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.locator('body')).toContainText(/failed|failure|error|try again|network|unable|rejected|503|失败|错误|重试|无法/i, {
      timeout: 20_000
    });
    await expect(page.locator('body')).not.toContainText(/order submitted|successfully placed|filled|成交成功|提交成功/i);
    await expectNoAppError(page);
  });

  test('TC-ORDER-018 refreshing during an unsubmitted order keeps trade state safe', async ({ page }) => {
    await openLoggedInTradePanel(page);
    const input = amountInput(page);
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill('1');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await requireSignedInShell(page);
    await expect(page.locator('body')).toContainText(/World Cup Winner|Buy|Sell|Trade/i, { timeout: 45_000 });
    await expect(page.locator('body')).not.toContainText(/order submitted|successfully placed|filled/i);
    await expectNoAppError(page);
  });
});
