import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://predx.pro';
const SEARCH_PLACEHOLDER = 'Search Markets or Events';

async function waitShort(page, ms = 4000) {
  await page.waitForTimeout(ms);
}

async function withPage(headless, fn) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  try {
    return await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function checkSignIn(headless) {
  return withPage(headless, async (page) => {
    await page.goto(`${BASE_URL}/news`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const signIn = page.getByRole('button', { name: /sign in/i }).first();
    const dialog = page.getByRole('dialog', { name: /Connect to PredX/i }).first();
    const beforeUrl = page.url();

    await signIn.click({ force: true });
    await waitShort(page);

    return {
      beforeUrl,
      afterUrl: page.url(),
      dialogVisible: await dialog.isVisible().catch(() => false),
      dialogTextSeen: await page.locator('body').getByText(/Connect to PredX/i).first().isVisible().catch(() => false)
    };
  });
}

async function checkSearch(headless, path) {
  return withPage(headless, async (page) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const search = page.getByPlaceholder(SEARCH_PLACEHOLDER).first();
    await search.click();
    await search.fill('iran');
    await search.press('Enter');
    await waitShort(page);

    return {
      path,
      finalUrl: page.url(),
      searchValue: await search.inputValue().catch(() => ''),
      globalSearchMatched: /\/search\?q=iran/i.test(page.url())
    };
  });
}

async function checkAnalysisSample(headless) {
  return withPage(headless, async (page) => {
    await page.goto(`${BASE_URL}/analysis/story_275631`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitShort(page, 1500);

    const mainText = await page.locator('main').innerText().catch(() => '');

    return {
      finalUrl: page.url(),
      hasHistoricalComparison: /Historical Comparison/i.test(mainText),
      hasFutureScenarios: /Future Development Scenarios/i.test(mainText),
      hasTurningPoints: /Key Turning Points/i.test(mainText),
      hasRelatedNews: /Related News/i.test(mainText)
    };
  });
}

async function checkEventAnalysisEntry(headless) {
  return withPage(headless, async (page) => {
    await page.goto(`${BASE_URL}/event/world-cup-winner`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitShort(page, 1500);

    const analysisHrefCount = await page.locator('a[href*="/analysis/"]').count();
    const analysisTextCount = await page.getByText(/Deep Analysis|Analysis/i).count();

    return {
      finalUrl: page.url(),
      analysisHrefCount,
      analysisTextCount
    };
  });
}

for (const headless of [true, false]) {
  const mode = headless ? 'headless' : 'headed';
  console.log(`\n=== ${mode.toUpperCase()} ===`);

  const signIn = await checkSignIn(headless);
  console.log('signIn', JSON.stringify(signIn, null, 2));

  const newsSearch = await checkSearch(headless, '/news');
  console.log('newsSearch', JSON.stringify(newsSearch, null, 2));

  const signalSearch = await checkSearch(headless, '/signal');
  console.log('signalSearch', JSON.stringify(signalSearch, null, 2));

  const analysisSample = await checkAnalysisSample(headless);
  console.log('analysisSample', JSON.stringify(analysisSample, null, 2));

  const eventAnalysisEntry = await checkEventAnalysisEntry(headless);
  console.log('eventAnalysisEntry', JSON.stringify(eventAnalysisEntry, null, 2));
}
