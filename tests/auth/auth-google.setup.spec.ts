import { expect, test } from '@playwright/test';
import { completeGoogleSignIn, openSignInDialog, persistStorageState, startGoogleSignIn, waitForSignedInShell } from '../../support/auth';
import { env, hasCredentialLogin } from '../../support/env';
import { openPath } from '../../support/site';

test.describe('Credential login setup', () => {
  test.slow();

  test.skip(
    !env.manualAuthAssist && !hasCredentialLogin,
    'Credential login setup requires TEST_USER_EMAIL and TEST_USER_PASSWORD unless MANUAL_AUTH_ASSIST=true.'
  );

  test('Create logged-in storage state via Google', async ({ page, context }) => {
    await openPath(page, '/news', /\/news/);
    await openSignInDialog(page);
    if (env.manualAuthAssist) {
      await startGoogleSignIn(page);
      await waitForSignedInShell(page, 300_000);
    } else {
      await completeGoogleSignIn(page);
      await waitForSignedInShell(page, 60_000);
    }

    await expect(page).toHaveURL(/predx\.pro/i, { timeout: 60_000 });

    if (process.env.AUTH_SHELL_DUMP === 'true') {
      const buttons = await page.getByRole('button').evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: (node.textContent ?? '').trim(),
            aria: node.getAttribute('aria-label') ?? '',
            title: node.getAttribute('title') ?? ''
          }))
          .filter((item) => item.text || item.aria || item.title)
      );
      console.log('AUTH_SHELL_BUTTONS=' + JSON.stringify(buttons));
    }

    await persistStorageState(context);
    await expect
      .poll(async () => {
        try {
          return await page.locator('body').innerText();
        } catch {
          return '';
        }
      })
      .not.toContain('Connect to PredX');

    test.info().annotations.push({
      type: 'storage-state',
      description: env.storageStatePath
    });
  });
});
