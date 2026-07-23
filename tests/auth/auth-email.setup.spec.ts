import { expect, test } from '@playwright/test';
import { env } from '../../support/env';
import { EVENT_DETAIL_PATH, openPath } from '../../support/site';
import {
  completeEmailCode,
  openSignInDialog,
  persistStorageState,
  startEmailSignIn,
  waitForEmailCodePrompt,
  waitForSignedInShell
} from '../../support/auth';

test.describe('Email login setup', () => {
  test.slow();

  test.skip(!env.testUserEmail, 'Email login setup requires TEST_USER_EMAIL.');

  test('TC-AUTH-006 create logged-in storage state via Email', async ({ page, context }) => {
    try {
      await openPath(page, '/news', /\/news/);
    } catch {
      await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    }

    await openSignInDialog(page);
    await startEmailSignIn(page);
    await waitForEmailCodePrompt(page);

    if (env.testUserEmailCode) {
      await completeEmailCode(page);
    }

    await waitForSignedInShell(page, 300_000);
    await expect(page).toHaveURL(/predx\.pro/i, { timeout: 60_000 });

    await persistStorageState(context);

    test.info().annotations.push({
      type: 'storage-state',
      description: env.storageStatePath
    });
  });
});
