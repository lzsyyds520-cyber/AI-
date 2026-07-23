import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { env } from '../../support/env';
import { realProfileTest as test } from '../../support/real-profile';
import { EVENT_DETAIL_PATH, actionByText, expectNoAppError, openPath, tradeSubmitButton } from '../../support/site';

test.skip(!env.authAutomationReady, 'Real profile auth coverage requires AUTH_AUTOMATION_READY=true.');
test.skip(!env.authRealProfileReady, 'Real profile auth coverage requires AUTH_REAL_PROFILE_READY=true.');
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

test.describe('Logged-in real Chrome profile flows', () => {
  test.slow();

  test('TC-AUTH-009 real Chrome profile event trade stays authenticated', async ({ realPage: page }) => {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await requireSignedInShell(page);

    const plusOne = actionByText(page, '+1$').first();
    if (await plusOne.isVisible().catch(() => false)) {
      await plusOne.click();
    }

    await tradeSubmitButton(page).click();

    await expect(page.getByRole('dialog', { name: /Connect to PredX/i })).toBeHidden({ timeout: 8_000 });
    await expect(page.locator('body')).toContainText(/Buy|Sell|Trade|Amount|Amount must be at least|最低|最小/i);
    await expectNoAppError(page);
  });
});
