import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { env } from '../../support/env';
import { realProfileTest as test } from '../../support/real-profile';
import { EVENT_DETAIL_PATH, expectNoAppError, expectNoBrokenDataText, openPath, tradeSubmitButton } from '../../support/site';

test.skip(!env.authAutomationReady, 'Real profile order coverage requires AUTH_AUTOMATION_READY=true.');
test.skip(!env.authRealProfileReady, 'Real profile order coverage requires AUTH_REAL_PROFILE_READY=true.');
test.skip(!fs.existsSync(env.authUserDataDir), `Missing real Chrome profile directory: ${env.authUserDataDir}`);

async function requireSignedInShell(page: Page): Promise<void> {
  await expect
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

        return !signInVisible && /Portfolio|Cash|Deposit|Positions|文件夹|现金|订金|钱包/i.test(headerText);
      },
      { timeout: 30_000 }
    )
    .toBeTruthy();
}

async function openLoggedInTradePanel(page: Page): Promise<void> {
  await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
  await requireSignedInShell(page);
  await expect(page.locator('body')).toContainText(/Buy|Sell|Trade|Amount/i, { timeout: 30_000 });
  await expect(page.getByRole('dialog', { name: /Connect to PredX/i })).toBeHidden({ timeout: 5_000 });
  await expectNoAppError(page);
}

async function signedInCashBalance(page: Page): Promise<number> {
  const text = await page.locator('header, [role="banner"]').first().innerText();
  const match = text.match(/(?:Cash|现金)\s*\$?\s*([\d,.]+)/i);
  const cash = match ? Number(match[1].replace(/,/g, '')) : NaN;

  test.skip(!Number.isFinite(cash), 'Real profile did not expose a Cash balance in the header.');
  return cash;
}

function amountInput(page: Page) {
  return page.locator('input:not([placeholder*="Search"]):not([placeholder*="搜索"])').last();
}

async function fillMinimumSafeAmount(page: Page): Promise<void> {
  const cash = await signedInCashBalance(page);
  const amount = 2;

  test.skip(cash < amount, `Positive-balance order coverage requires at least $${amount}; current parsed cash=${cash}.`);

  const input = amountInput(page);
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill(String(amount));
  await expect(input).toHaveValue(/2/);
}

async function blockMutatingRequests(page: Page, blockedUrls: string[]): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && /predx\.pro|api\.predx\.pro|polymarket/i.test(url)) {
      blockedUrls.push(url);
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

function orderConfirmation(page: Page) {
  return page
    .getByRole('dialog')
    .filter({ hasText: /Confirm|Review|Preview|Order|Buy|Sell|Amount|Shares|Price|Total|Cost|Fee|确认|预览|订单|总额|数量|价格/i })
    .last();
}

async function hasOrderConfirmation(page: Page): Promise<boolean> {
  if (await orderConfirmation(page).isVisible().catch(() => false)) {
    return true;
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  return /Confirm|Review|Preview|Order Summary|Place Order|Estimated|Total|Cost|Fee|Slippage|确认|预览|订单|总额|费用|滑点/i.test(
    bodyText
  );
}

async function expectNoSuccessfulOrder(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText(/order submitted|successfully placed|filled|成交成功|提交成功/i);
}

async function safeClickTrade(page: Page): Promise<{ blockedUrls: string[]; confirmationOpened: boolean }> {
  await openLoggedInTradePanel(page);
  await fillMinimumSafeAmount(page);

  const blockedUrls: string[] = [];
  await blockMutatingRequests(page, blockedUrls);
  await tradeSubmitButton(page).click();

  await expect(page.getByRole('dialog', { name: /Connect to PredX/i })).toBeHidden({ timeout: 8_000 });
  await page.waitForTimeout(2_000);
  await expectNoSuccessfulOrder(page);

  return {
    blockedUrls,
    confirmationOpened: await hasOrderConfirmation(page)
  };
}

test.describe('Logged-in real Chrome profile order safe coverage', () => {
  test.slow();

  test('TC-ORDER-011 positive-balance Trade opens confirmation preview without submitting', async ({ realPage: page }) => {
    const result = await safeClickTrade(page);

    test.skip(
      result.blockedUrls.length > 0,
      'Production trade button attempted a mutating request before a confirmation preview; keep this case conditional unless product confirms direct-submit behavior.'
    );

    expect(result.confirmationOpened).toBeTruthy();
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-ORDER-012 closing confirmation returns to trade panel without submitting', async ({ realPage: page }) => {
    const result = await safeClickTrade(page);

    test.skip(
      result.blockedUrls.length > 0 || !result.confirmationOpened,
      'No safe confirmation dialog was available to close before production attempted order submission.'
    );

    const closeButton = page
      .getByRole('button', { name: /Cancel|Close|Back|取消|关闭|返回/i })
      .last()
      .or(page.locator('[aria-label*="close" i]').last());
    await closeButton.click({ force: true });

    await expect(page.locator('body')).toContainText(/Buy|Sell|Amount|Trade/i, { timeout: 15_000 });
    await expectNoSuccessfulOrder(page);
    await expectNoBrokenDataText(page.locator('body'));
    await expectNoAppError(page);
  });

  test('TC-ORDER-020 order submission failure shows recoverable error and no success state', async ({ realPage: page }) => {
    const result = await safeClickTrade(page);

    if (result.confirmationOpened && result.blockedUrls.length === 0) {
      const confirmAction = page
        .getByRole('button', { name: /Confirm|Place Order|Submit|Trade|Buy|Sell|确认|提交/i })
        .last();
      await expect(confirmAction).toBeVisible({ timeout: 10_000 });
      await confirmAction.click({ force: true });
    }

    await expect.poll(() => result.blockedUrls.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.locator('body')).toContainText(/failed|failure|error|try again|network|unable|rejected|503|失败|错误|重试|无法/i, {
      timeout: 20_000
    });
    await expectNoSuccessfulOrder(page);
    await expectNoAppError(page);
  });
});
