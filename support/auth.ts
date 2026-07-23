import fs from 'node:fs';
import path from 'node:path';
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { env, hasCredentialLogin } from './env';
import { EVENT_DETAIL_PATH, actionByText, openPath, openTopSignInModal, tradeSubmitButton } from './site';

function authDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /Connect to PredX/i }).first();
}

function googleEmailInput(page: Page): Locator {
  return page
    .getByRole('textbox', { name: /Email or phone/i })
    .or(page.locator('input[type="email"]'))
    .first();
}

function googlePasswordInput(page: Page): Locator {
  return page
    .locator('input[type="password"]')
    .or(page.getByLabel(/Enter your password/i))
    .first();
}

function authEmailInput(page: Page): Locator {
  return authDialog(page).locator('input[placeholder="you@example.com"]').first();
}

function authEmailContinueButton(page: Page): Locator {
  return authDialog(page).getByRole('button', { name: /Continue with Email/i }).first();
}

function emailCodeInputs(page: Page): Locator {
  return page
    .locator('[role="dialog"]')
    .last()
    .locator('input:not([type="email"]):not([disabled])');
}

export function ensureAuthStorageDir(): void {
  fs.mkdirSync(path.dirname(env.storageStatePath), { recursive: true });
}

export async function openSignInDialog(page: Page): Promise<void> {
  try {
    await openTopSignInModal(page);
    await expect(authDialog(page)).toBeVisible({ timeout: 15_000 });
    return;
  } catch {
    await openPath(page, EVENT_DETAIL_PATH, /\/event\//);
    await actionByText(page, '+1$').first().click();
    await tradeSubmitButton(page).click();
    await expect(authDialog(page)).toBeVisible({ timeout: 15_000 });
  }
}

export async function startGoogleSignIn(page: Page): Promise<Page> {
  const popupPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);
  await page.getByRole('button', { name: /Continue with Google/i }).click();

  const popup = await popupPromise;
  const googlePage = popup ?? page;
  await googlePage.waitForLoadState('domcontentloaded');
  return googlePage;
}

export async function startEmailSignIn(page: Page, emailAddress = env.testUserEmail): Promise<void> {
  if (!emailAddress) {
    throw new Error('Missing TEST_USER_EMAIL in environment.');
  }

  await expect(authEmailInput(page)).toBeVisible({ timeout: 15_000 });
  await authEmailInput(page).fill(emailAddress);
  await expect(authEmailContinueButton(page)).toBeEnabled({ timeout: 15_000 });
  await authEmailContinueButton(page).click();
}

export async function waitForEmailCodePrompt(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          const body = await page.locator('body').innerText();
          const inputCount = await emailCodeInputs(page).count();
          return /code sent to|secured by magic/i.test(body) || inputCount > 0;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBeTruthy();
}

export async function completeEmailCode(page: Page, code = env.testUserEmailCode): Promise<void> {
  if (!code) {
    throw new Error('Missing TEST_USER_EMAIL_CODE in environment.');
  }

  await waitForEmailCodePrompt(page);
  const inputs = emailCodeInputs(page);
  const count = await inputs.count();

  if (count < 1) {
    throw new Error('No enabled OTP input was found for Email login.');
  }

  await inputs.first().click();
  await page.keyboard.type(code, { delay: 80 });
}

export async function waitForSignedInShell(page: Page, timeout = 60_000): Promise<void> {
  await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden({ timeout });
}

export async function waitForSignedOutShell(page: Page, timeout = 30_000): Promise<void> {
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout });
}

function signOutEntry(page: Page): Locator {
  return signOutEntryCandidates(page)[0];
}

function signOutEntryCandidates(page: Page): Locator[] {
  return [
    page.getByRole('menuitem', { name: /sign out|log out|logout|退出登录|退出|登出/i }).first(),
    page.getByRole('button', { name: /sign out|log out|logout|退出登录|退出|登出/i }).first(),
    page.getByText(/^(sign out|log out|logout|退出登录|退出|登出)$/i).first()
  ];
}

async function clickVisibleSignOutEntry(page: Page): Promise<boolean> {
  for (const entry of signOutEntryCandidates(page)) {
    if (!(await entry.isVisible().catch(() => false))) {
      continue;
    }

    await entry.click({ force: true });
    await waitForSignedOutShell(page);
    return true;
  }

  return false;
}

export async function signOut(page: Page): Promise<void> {
  const accountMenuTriggers = [
    page.locator('header [data-radix-dropdown-menu-trigger]').last(),
    page.locator('header .cursor-pointer').last(),
    page.locator('header').locator('div').filter({ has: page.locator('svg') }).last()
  ];

  for (const trigger of accountMenuTriggers) {
    if (!(await trigger.isVisible().catch(() => false))) {
      continue;
    }

    await trigger.click({ force: true });
    await page.waitForTimeout(800);

    if (await clickVisibleSignOutEntry(page)) {
      return;
    }

    await page.keyboard.press('Escape').catch(() => undefined);
  }

  const headerButtons = page.locator('header button');
  const count = await headerButtons.count();

  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = headerButtons.nth(index);
    const visible = await candidate.isVisible().catch(() => false);

    if (!visible) {
      continue;
    }

    const innerText = await candidate.innerText().catch(() => '');
    const ariaLabel = (await candidate.getAttribute('aria-label').catch(() => '')) ?? '';
    const label = `${innerText} ${ariaLabel}`.replace(/\s+/g, ' ').trim();

    if (/sign in|toggle theme|notifications|deposit|withdraw|^en$|^cn$/i.test(label)) {
      continue;
    }

    await candidate.click({ force: true });
    await page.waitForTimeout(800);

    if (await clickVisibleSignOutEntry(page)) {
      return;
    }

    await page.keyboard.press('Escape').catch(() => undefined);
  }

  throw new Error('Unable to locate a usable sign-out entry in the signed-in shell.');
}

export async function completeGoogleSignIn(page: Page): Promise<void> {
  if (!hasCredentialLogin) {
    throw new Error('Missing TEST_USER_EMAIL or TEST_USER_PASSWORD in environment.');
  }

  const googlePage = await startGoogleSignIn(page);
  await expect(googleEmailInput(googlePage)).toBeVisible({ timeout: 30_000 });
  await googleEmailInput(googlePage).fill(env.testUserEmail);
  await googlePage.getByRole('button', { name: /Next/i }).click();

  await expect(googlePasswordInput(googlePage)).toBeVisible({ timeout: 30_000 });
  await googlePasswordInput(googlePage).fill(env.testUserPassword);
  await googlePage.getByRole('button', { name: /Next/i }).click();
}

export async function persistStorageState(context: BrowserContext): Promise<void> {
  ensureAuthStorageDir();
  await context.storageState({ path: env.storageStatePath, indexedDB: true });
}
