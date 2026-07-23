export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://predx.pro',
  safeMode: process.env.SAFE_MODE !== 'false',
  allowRealTrade: process.env.ALLOW_REAL_TRADE === 'true',
  authAutomationReady: process.env.AUTH_AUTOMATION_READY === 'true',
  authRealProfileReady: process.env.AUTH_REAL_PROFILE_READY === 'true',
  walletAuthAssist: process.env.WALLET_AUTH_ASSIST === 'true',
  conditionalAutomationReady: process.env.CONDITIONAL_AUTOMATION_READY === 'true',
  marketFilterAutomationReady: process.env.MARKET_FILTER_AUTOMATION_READY === 'true',
  marketFilterFixturePath: process.env.MARKET_FILTER_FIXTURE ?? '',
  eventChartAutomationReady: process.env.EVENT_CHART_AUTOMATION_READY === 'true',
  eventChartFixturePath:
    process.env.EVENT_CHART_FIXTURE ?? 'fixtures/conditional/event-chart.example.json',
  headedGlobalSearchReady: process.env.HEADED_GLOBAL_SEARCH_READY === 'true',
  manualAuthAssist: process.env.MANUAL_AUTH_ASSIST === 'true',
  authUserDataDir: process.env.AUTH_USER_DATA_DIR ?? '.auth/real-chrome-profile',
  authProfileDirectory: process.env.AUTH_PROFILE_DIRECTORY ?? '',
  authBrowserChannel: process.env.AUTH_BROWSER_CHANNEL ?? process.env.PW_CHANNEL ?? 'chrome',
  testUserEmail: process.env.TEST_USER_EMAIL ?? '',
  testUserEmailCode: process.env.TEST_USER_EMAIL_CODE ?? '',
  testUserPassword: process.env.TEST_USER_PASSWORD ?? '',
  storageStatePath: process.env.STORAGE_STATE ?? '.auth/user.json',
  walletStorageStatePath: process.env.WALLET_STORAGE_STATE ?? process.env.STORAGE_STATE ?? '.auth/wallet-user.json'
};

export const hasCredentialLogin = Boolean(env.testUserEmail && env.testUserPassword);
