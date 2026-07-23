import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import { env } from './env';

type RealProfileFixtures = {
  realContext: BrowserContext;
  realPage: Page;
};

function waitForCdp(port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`http://127.0.0.1:${port}/json/version`, (response) => {
        response.resume();

        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
          return;
        }

        retry();
      });

      request.on('error', retry);
      request.setTimeout(1_000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for Chrome CDP on port ${port}`));
        return;
      }

      setTimeout(check, 500);
    };

    check();
  });
}

async function launchRealChromeOverCdp(userDataDir: string): Promise<{
  context: BrowserContext;
  cleanup: () => Promise<void>;
}> {
  const cdpPort = Number(process.env.AUTH_REAL_PROFILE_CDP_PORT ?? '9335');
  const chromeExecutable =
    process.env.AUTH_REAL_CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const args = [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...(env.authProfileDirectory ? [`--profile-directory=${env.authProfileDirectory}`] : []),
    'about:blank'
  ];
  const chromeProcess: ChildProcessWithoutNullStreams = spawn(chromeExecutable, args, {
    stdio: 'pipe'
  });

  await waitForCdp(cdpPort, 45_000);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const context = browser.contexts()[0];

  if (!context) {
    await browser.close();
    throw new Error('Chrome CDP started but did not expose a browser context.');
  }

  return {
    context,
    cleanup: async () => {
      await browser.close().catch(() => undefined);
      chromeProcess.kill('SIGTERM');
    }
  };
}

export const realProfileTest = base.extend<RealProfileFixtures>({
  realContext: async ({}, use) => {
    const userDataDir = path.resolve(env.authUserDataDir);
    const slowMo = Number(process.env.AUTH_REAL_PROFILE_SLOWMO ?? '100');
    const args = env.authProfileDirectory ? [`--profile-directory=${env.authProfileDirectory}`] : [];
    const cdpMode = process.env.AUTH_REAL_PROFILE_CDP === 'true';
    const useSystemKeychain = process.env.AUTH_USE_SYSTEM_KEYCHAIN === 'true';
    const launched = cdpMode
      ? await launchRealChromeOverCdp(userDataDir)
      : {
          context: await chromium.launchPersistentContext(userDataDir, {
            ...(env.authBrowserChannel ? { channel: env.authBrowserChannel } : {}),
            args,
            headless: false,
            ignoreHTTPSErrors: true,
            ...(useSystemKeychain ? { ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic'] } : {}),
            slowMo,
            viewport: { width: 1440, height: 900 }
          }),
          cleanup: async () => undefined
        };

    try {
      await use(launched.context);
    } finally {
      await launched.context.close().catch(() => undefined);
      await launched.cleanup();
    }
  },

  realPage: async ({ realContext }, use) => {
    const page = realContext.pages()[0] ?? (await realContext.newPage());
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);
    await use(page);
  }
});
