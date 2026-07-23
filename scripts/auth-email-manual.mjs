import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.BASE_URL ?? 'https://predx.pro';
const storageStatePath = process.env.STORAGE_STATE ?? '.auth/user.json';
const testUserEmail = process.env.TEST_USER_EMAIL ?? '';
const channel = process.env.PW_CHANNEL ?? 'chrome';
const userDataDir = process.env.AUTH_USER_DATA_DIR ?? '.auth/real-chrome-profile';

if (!testUserEmail) {
  throw new Error('Missing TEST_USER_EMAIL.');
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function openEventAuthGate(page) {
  await gotoBestEffort(page, '/event/world-cup-winner');
  await page.waitForTimeout(4_000);

  const tradeButton = page.getByRole('button', { name: /^Trade$/ }).last();
  const plusOne = page.getByText('+1$', { exact: true }).first();

  if ((await plusOne.isVisible().catch(() => false)) && (await plusOne.isEnabled().catch(() => false))) {
    await plusOne.click();
  }

  await tradeButton.click();
  await page.getByRole('dialog', { name: /Connect to PredX/i }).first().waitFor({ state: 'visible', timeout: 15_000 });
}

async function gotoBestEffort(page, pathName) {
  const target = `${baseURL}${pathName}`;

  try {
    await page.goto(target, { waitUntil: 'commit', timeout: 60_000 });
  } catch (error) {
    log(`Navigation did not fully settle for ${target}: ${error instanceof Error ? error.message : String(error)}`);
  }

  await page.waitForTimeout(5_000);
}

async function authGateVisible(page) {
  return (
    (await page.getByRole('dialog', { name: /Connect to PredX/i }).first().isVisible().catch(() => false)) ||
    (await page.locator('input[placeholder="you@example.com"]').first().isVisible().catch(() => false)) ||
    (await page.getByText(/Continue with Email/i).first().isVisible().catch(() => false))
  );
}

async function openTopAuthGate(page) {
  await gotoBestEffort(page, '/news');

  const signIn = page.getByRole('button', { name: /sign in/i }).first();
  await signIn.waitFor({ state: 'visible', timeout: 30_000 });

  const openers = [
    async () => signIn.click(),
    async () => signIn.click({ force: true }),
    async () => {
      await signIn.focus();
      await page.keyboard.press('Enter');
    },
    async () => signIn.evaluate((node) => node.click())
  ];

  for (const open of openers) {
    await open();
    await page.waitForTimeout(1_500);

    if (await authGateVisible(page)) {
      return;
    }
  }

  throw new Error('Global Sign In did not open the Connect to PredX dialog.');
}

async function openAuthGate(page) {
  try {
    await openTopAuthGate(page);
  } catch (error) {
    log(`Top Sign In did not open auth gate, falling back to event trade: ${error instanceof Error ? error.message : String(error)}`);
    await openEventAuthGate(page);
  }
}

async function sendEmailCode(page) {
  const dialog = page.getByRole('dialog', { name: /Connect to PredX/i }).first();
  const emailInput = dialog.locator('input[placeholder="you@example.com"]').first();
  const emailButton = dialog.getByRole('button', { name: /Continue with Email/i }).first();

  await emailInput.fill(testUserEmail);
  await emailButton.click();
}

async function waitForSignedIn(page) {
  const signInButton = page.getByRole('button', { name: /sign in/i }).first();
  const deadline = Date.now() + 900_000;

  while (Date.now() < deadline) {
    const signInVisible = await signInButton.isVisible().catch(() => false);
    const gateVisible = await authGateVisible(page);
    const headerText = await page.locator('header').innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasSignedInHeader = /Cash|Portfolio|Deposit|文件夹|现金|订金|钱包|Wallet/i.test(headerText);
    const hasBrowserVerificationError = /unable to verify your browser|无法验证您的浏览器|code\s*21|代码\s*21/i.test(bodyText);

    if (hasBrowserVerificationError) {
      throw new Error('PredX/Magic reported browser verification failure in the real Chrome profile.');
    }

    if (!signInVisible && !gateVisible && hasSignedInHeader) {
      return;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error('Timed out waiting for logged-in shell after manual code entry.');
}

fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  slowMo: 150,
  viewport: { width: 1440, height: 900 }
  ,...(channel ? { channel } : {})
});

const page = context.pages()[0] ?? (await context.newPage());

let saved = false;

try {
  log(`Opening ${baseURL} auth flow...`);
  await gotoBestEffort(page, '/news');
  const alreadySignedIn = !(await page.getByRole('button', { name: /sign in/i }).first().isVisible().catch(() => true));
  if (alreadySignedIn) {
    await context.storageState({ path: storageStatePath, indexedDB: true });
    saved = true;
    log(`Saved auth state to ${storageStatePath}`);
  } else {
    await openAuthGate(page);
    log(`Sending email code to ${testUserEmail}...`);
    await sendEmailCode(page);
    log('If prompted, enter the 6-digit email code in the browser window.');
    log('Waiting for the logged-in shell...');
    await waitForSignedIn(page);
    await context.storageState({ path: storageStatePath, indexedDB: true });
    saved = true;
    log(`Saved auth state to ${storageStatePath}`);
  }
} catch (error) {
  log(`Auth email manual flow error: ${error instanceof Error ? error.message : String(error)}`);
  log('Keeping the browser window open for manual inspection.');
  await page.waitForTimeout(600_000);
} finally {
  if (!saved) {
    log('Manual email auth did not complete.');
  }
  await context.close();
}
