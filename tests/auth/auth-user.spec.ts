import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { signOut, waitForSignedOutShell } from '../../support/auth';
import { env } from '../../support/env';
import { EVENT_DETAIL_PATH, actionByText, openPath, tradeSubmitButton } from '../../support/site';

async function requireSignedInStorageState(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  const signedIn = await expect
    .poll(
      async () => {
        const signInVisible = await page.getByRole('button', { name: /sign in/i }).evaluateAll((buttons) =>
          buttons.some((button) => {
            const rect = (button as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(button as HTMLElement);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
        );
        const localizedLoginVisible = await page.getByRole('button', { name: /登录/i }).evaluateAll((buttons) =>
          buttons.some((button) => {
            const rect = (button as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(button as HTMLElement);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          })
        );
        const headerText = await page.locator('header, [role="banner"]').first().innerText().catch(() => '');
        const hasSignedInHeader = /Portfolio|Cash|Deposit|Positions|文件夹|现金|订金|钱包|Wallet/i.test(headerText);

        return !signInVisible && !localizedLoginVisible && hasSignedInHeader;
      },
      { timeout: 20_000 }
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);

  test.skip(
    !signedIn,
    `Stored auth state is not currently signed in (${env.storageStatePath}). Rerun auth setup before executing TC-AUTH-008~012.`
  );
}

test.use({ storageState: env.storageStatePath });
test.skip(!fs.existsSync(env.storageStatePath), `Missing storage state file: ${env.storageStatePath}`);
test.skip(
  !env.authAutomationReady,
  'Auth automation is blocked in the current environment by PredX/Magic browser verification (code 21). Keep logged-in cases manual unless a whitelisted environment or reusable trusted browser session is provided.'
);

test.describe('Logged-in user flows', () => {
  test.slow();

  test('TC-AUTH-006 reusable logged-in storage enters signed-in shell', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await requireSignedInStorageState(page);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('header, [role="banner"]').first()).toContainText(/Portfolio|Cash|Deposit|文件夹|现金|订金/i);
  });

  test('TC-AUTH-008 logged-in shell refresh keeps signed-in state', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await requireSignedInStorageState(page);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden({ timeout: 15_000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden({ timeout: 15_000 });
  });

  test('TC-AUTH-009 logged-in event trade does not immediately bounce to auth gate', async ({ page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await requireSignedInStorageState(page);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();

    await expect(page.getByRole('dialog', { name: /Connect to PredX/i })).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('body')).toContainText(/Trade|By trading, you agree to the Terms of Use/i);
  });

  test('TC-AUTH-010 sign out returns shell to guest state', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await requireSignedInStorageState(page);
    await signOut(page);
    await waitForSignedOutShell(page);
  });

  test('TC-AUTH-011 signed-out refresh keeps guest state', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await requireSignedInStorageState(page);
    await signOut(page);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForSignedOutShell(page);
  });

  test('TC-AUTH-012 signed-out trade action opens auth gate again', async ({ page }) => {
    await openPath(page, '/news', /\/news/);
    await requireSignedInStorageState(page);
    await signOut(page);

    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();
    await expect(page.getByRole('dialog', { name: /Connect to PredX/i })).toBeVisible({ timeout: 15_000 });
  });
});
