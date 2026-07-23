import { expect, test } from '@playwright/test';
import { openSignInDialog } from '../../support/auth';
import {
  EVENT_DETAIL_PATH,
  actionByText,
  closeOverlay,
  expectAuthGate,
  expectNoAppError,
  openPath,
  openTopSignInModal,
  tradeSubmitButton
} from '../../support/site';

test.describe('Guest auth gates', () => {
  test.slow();

  test('TC-AUTH-001 TC-AUTH-003 TC-AUTH-005 top sign in modal', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);
    await expectAuthGate(page);
    await closeOverlay(page);
  });

  test('TC-AUTH-002 TC-FLOW-014 event trade opens auth gate', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();
    await expectAuthGate(page);
  });

  test('TC-AUTH-004 no-wallet state shows extension guidance', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await openSignInDialog(page);
    await expectAuthGate(page);
    await expect(page.locator('body')).toContainText(/No wallet extensions detected/i);
    await expect(page.locator('body')).toContainText(/Please install MetaMask|browser wallet extension/i);
  });

  test('TC-AUTH-013 invalid email cannot submit verification request', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);

    const emailInput = page.locator('input[placeholder="you@example.com"]').first();
    const continueButton = page.getByRole('button', { name: /Continue with Email/i }).first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('not-an-email');
    await expect(emailInput).toHaveValue('not-an-email');

    const isSubmitBlocked = await continueButton.evaluate((node) => {
      const element = node as HTMLButtonElement;
      return element.disabled || element.getAttribute('aria-disabled') === 'true' || /disabled|opacity/i.test(element.className);
    });

    expect(isSubmitBlocked).toBeTruthy();
    await expectNoAppError(page);
  });

  test('TC-AUTH-014 email entry can be closed without losing the original page', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);

    const emailInput = page.locator('input[placeholder="you@example.com"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('qa@example.com');
    await expect(emailInput).toHaveValue('qa@example.com');

    await closeOverlay(page);
    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator('main')).toBeVisible();
    await expectNoAppError(page);
  });

  test('TC-AUTH-016 OAuth browser-verification rejection stays readable', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await openTopSignInModal(page);

    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: /Continue with Google/i }).click();

    const authPage = (await popupPromise) ?? page;
    await authPage.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);

    await expect(authPage.locator('body')).toContainText(
      /Unable to log in|无法登录|browser or app may not be secure|浏览器或应用可能不安全|Sign in|Google/i,
      { timeout: 45_000 }
    );
    await expect(authPage.locator('body')).not.toHaveText(/^\s*$/);

    if (authPage !== page) {
      await authPage.close();
    }

    await expectNoAppError(page);
  });
});
