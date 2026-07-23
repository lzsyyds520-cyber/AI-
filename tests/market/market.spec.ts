import { expect, test, type Page } from '@playwright/test';
import {
  actionByText,
  expectNoAppError,
  expectNoBrokenDataText,
  expectSearchVisible,
  openFirstMainHref,
  openPath,
  runSearch,
  waitForMarketCatalog
} from '../../support/site';

test.describe('Market page guest coverage', () => {
  test.slow();

  async function chooseFilterOption(page: Page, triggerPattern: RegExp, optionLabel: string): Promise<void> {
    const trigger = page.getByText(triggerPattern).first();
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click({ force: true });

    const option = page.getByText(optionLabel, { exact: true }).last();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  }

  test('TC-MKT-001 TC-MKT-002 TC-MKT-003 TC-MKT-004 TC-MKT-005 TC-MKT-015 TC-MKT-018 load and category switch', async ({
    page
  }) => {
    await openPath(page, '/market', /\/market/);
    await expectSearchVisible(page);
    await waitForMarketCatalog(page);

    await expect(actionByText(page, 'All').first()).toBeVisible();
    await expect(page.locator('main')).toContainText(/Vol|Liq/i);
    await expect(page.locator('main')).toContainText(/%/i);
    await actionByText(page, 'Crypto').first().click();
    await expect(page.locator('body')).toContainText(/Bitcoin ETF|Ethereum ETF|Solana|Dogecoin|Bitcoin Up or Down/i);
  });

  test('TC-MKT-011 TC-MKT-013 TC-MKT-014 search flows', async ({ page }) => {
    await openPath(page, '/market', /\/market/);

    await runSearch(page, 'Iran');
    await expect(page.locator('main')).toContainText(/Iran|No markets found/i);

    await runSearch(page, 'zzzz_not_exist_case');
    await expect(page.locator('main')).toContainText(/No|not found|empty|result/i);
  });

  test('TC-MKT-016 market card jump', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await openFirstMainHref(page, ['/event/', '/market/']);
    await expect(page).toHaveURL(/\/(event|market)\//);
  });

  test('TC-MKT-012 category and search combination stays aligned', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    await actionByText(page, 'Crypto').first().click();
    await expect(page.locator('main')).toContainText(/Bitcoin|Ethereum|Solana|Dogecoin/i);

    await runSearch(page, 'Bitcoin');
    await expect(page.locator('main')).toContainText(/Bitcoin/i);
  });

  test('TC-MKT-017 refresh keeps market page usable', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await waitForMarketCatalog(page);
  });

  test('TC-MKT-019 filter dropdowns open and close without blocking the catalog', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    const filters = [
      /Status:\s*Active|地位：|状态：/i,
      /End Date:\s*Any|结束日期：/i,
      /Liquidity\s*\(TVL\):\s*Any|流动性/i,
      /Volume\s*24h:\s*Any|24小时/i,
      /Creation Time:\s*Any|创建时间/i
    ];

    for (const filter of filters) {
      const trigger = page.getByText(filter).first();
      await expect(trigger, `filter trigger ${filter.toString()} should be visible`).toBeVisible({ timeout: 20_000 });
      await trigger.click({ force: true });
      await expect(page.locator('body')).toContainText(/Any|Active|Resolved|Today|Week|Month|所有|任何|已解决|积极的|任意/i, {
        timeout: 10_000
      });
      await page.keyboard.press('Escape');
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('TC-MKT-023 market cards expose sane price volume and liquidity formats', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    await expectNoBrokenDataText(page.locator('main'));
    await expect(page.locator('main')).toContainText(/%/i);
    await expect(page.locator('main')).toContainText(/\$|美元|Vol|Liq|销量|液体|流动性/i);
    await expect(page.locator('main')).not.toContainText(/-\d+(\.\d+)?\s*%|-\$\s*\d/i);
  });

  test('TC-MKT-020 category and liquidity filters can be combined without breaking results', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    await actionByText(page, 'Crypto').first().click();
    await expect(page.locator('main')).toContainText(/Bitcoin|Ethereum|Solana|Dogecoin|Crypto/i, { timeout: 20_000 });

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/polymarket?') && response.url().includes('liquidity_min=100000') && response.status() === 200,
      { timeout: 45_000 }
    );
    await chooseFilterOption(page, /Liquidity\s*\(TVL\):\s*Any|流动性/i, '≥ $100k');
    const response = await responsePromise;
    expect(response.url()).toContain('liquidity_min=100000');

    await expect(page.locator('main')).toContainText(/Clear Filters|%|\$|Vol|Liq/i, { timeout: 20_000 });
    await expectNoBrokenDataText(page.locator('main'));
    await expectNoAppError(page);
  });

  test('TC-MKT-021 refreshing after a filter leaves market page in a defined usable state', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    await chooseFilterOption(page, /Liquidity\s*\(TVL\):\s*Any|流动性/i, '≥ $100k');
    await expect(page.locator('main')).toContainText(/Clear Filters|%|\$|Vol|Liq/i, { timeout: 20_000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expectSearchVisible(page);
    await waitForMarketCatalog(page);
    await expect(page.locator('body')).toContainText(/Liquidity \(TVL\):\s*(Any|≥ \$100k)|流动性/i);
    await expectNoAppError(page);
  });

  test('TC-MKT-022 rapid category switching settles on a usable final catalog', async ({ page }) => {
    await openPath(page, '/market', /\/market/);
    await waitForMarketCatalog(page);

    for (const label of ['Politics', 'Crypto', 'Sports', 'Tech'] as const) {
      await actionByText(page, label).first().click();
      await page.waitForTimeout(150);
    }

    await expect(page.locator('main')).toContainText(/%|\$|Vol|Liq|No markets found|result/i, { timeout: 30_000 });
    await expectNoBrokenDataText(page.locator('main'));
    await expectNoAppError(page);
  });
});
