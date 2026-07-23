import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { openSignInDialog, waitForSignedInShell } from '../../support/auth';
import { env } from '../../support/env';
import { openPath } from '../../support/site';

const METAMASK_EXTENSION_ID = 'nkbihfbeogaeaoehlefnkodbefgpgknn';

function profileDirs(): string[] {
  return fs
    .readdirSync(env.authUserDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/.test(entry.name)))
    .map((entry) => path.join(env.authUserDataDir, entry.name));
}

function walletExtensionDirs(): string[] {
  return profileDirs().map((profileDir) => path.join(profileDir, 'Extensions', METAMASK_EXTENSION_ID));
}

function ensureWalletStorageDir(): void {
  fs.mkdirSync(path.dirname(env.walletStorageStatePath), { recursive: true });
}

test.describe('Wallet login setup', () => {
  test.slow();

  test.skip(
    !env.walletAuthAssist,
    'Wallet login setup requires WALLET_AUTH_ASSIST=true and a dedicated real Chrome profile with MetaMask installed.'
  );

  test('TC-AUTH-007 create logged-in storage state via MetaMask wallet', async ({ browserName }) => {
    test.setTimeout(15 * 60_000);
    test.skip(browserName !== 'chromium', 'Wallet auth setup only runs on Chromium/Chrome.');

    if (!walletExtensionDirs().some((extensionDir) => fs.existsSync(extensionDir))) {
      throw new Error(
        `MetaMask was not found in ${env.authUserDataDir}. Open the dedicated Chrome profile, install MetaMask, unlock it once, then rerun auth:setup:wallet.`
      );
    }

    ensureWalletStorageDir();

    let context;
    try {
      context = await chromium.launchPersistentContext(env.authUserDataDir, {
        channel: env.authBrowserChannel,
        headless: false,
        slowMo: 150,
        viewport: { width: 1440, height: 900 }
      });
    } catch (error) {
      throw new Error(
        `Unable to open the dedicated Chrome profile at ${env.authUserDataDir}. Close any Chrome window already using that profile, then rerun auth:setup:wallet. Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const page = context.pages()[0] ?? (await context.newPage());

    try {
      await openPath(page, '/news', /\/news/);

      const alreadySignedIn = !(await page.getByRole('button', { name: /sign in/i }).first().isVisible().catch(() => true));

      if (!alreadySignedIn) {
        await openSignInDialog(page);

        const noWalletHint = /No wallet extensions detected|Please install MetaMask|browser wallet extension/i;
        const dialogText = await page.locator('body').innerText().catch(() => '');
        if (noWalletHint.test(dialogText)) {
          throw new Error(
            'PredX still reports that no wallet extension was detected. Make sure MetaMask is installed in the dedicated Chrome profile and unlocked before rerunning.'
          );
        }

        const metaMaskButton = page.getByRole('button', { name: /MetaMask/i }).first();
        await expect(metaMaskButton).toBeVisible({ timeout: 20_000 });
        await metaMaskButton.click();

        // Manual assist handoff: the user can unlock / connect / sign inside the real wallet popup.
        await waitForSignedInShell(page, 10 * 60_000);
      }

      await context.storageState({ path: env.walletStorageStatePath, indexedDB: true });
      await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeHidden({ timeout: 15_000 });

      test.info().annotations.push({
        type: 'wallet-storage-state',
        description: env.walletStorageStatePath
      });
    } finally {
      await context.close();
    }
  });
});
