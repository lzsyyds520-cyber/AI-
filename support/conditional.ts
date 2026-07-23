import { expect, type Locator, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type RawRecord = Record<string, unknown>;

export type AssertionOperator =
  | 'eq'
  | 'neq'
  | 'gte'
  | 'lte'
  | 'not_null'
  | 'within_next_days'
  | 'within_last_days'
  | 'within_request_range';

export interface MarketFieldAssertion {
  scope: 'event' | 'market';
  quantifier?: 'all' | 'any';
  field: string;
  operator: AssertionOperator;
  value?: string | number | boolean;
  requestStartParam?: string;
  requestEndParam?: string;
}

export interface RequestParamExpectation {
  param: string;
  value?: string;
}

export interface MarketRequestExpectation {
  param?: string;
  value?: string;
  includes?: RequestParamExpectation[];
}

export interface MarketFilterCase {
  id: string;
  enabled: boolean;
  filterLabel: string;
  optionLabel: string;
  expectedRequest: MarketRequestExpectation;
  minItems?: number;
  assertions: MarketFieldAssertion[];
  expectedVisibleTitles?: string[];
  notes?: string;
}

export interface MarketFilterFixture {
  cases: MarketFilterCase[];
}

export interface EventChartRangeCase {
  label: string;
  requestIncludes: string[];
}

export interface EventChartFixture {
  path?: string;
  chartMinWidth?: number;
  chartMinHeight?: number;
  ranges: EventChartRangeCase[];
}

interface MarketApiEntry {
  event: RawRecord;
  markets: RawRecord[];
  market_count?: number;
}

interface MarketApiResponse {
  _requestUrl?: string;
  data?: {
    events_with_markets?: MarketApiEntry[];
    total_events?: number;
    total_markets?: number;
  };
}

export async function loadJsonFixture<T>(fixturePath: string): Promise<T> {
  const resolved = path.isAbsolute(fixturePath) ? fixturePath : path.resolve(process.cwd(), fixturePath);
  const raw = await fs.readFile(resolved, 'utf8');
  return JSON.parse(raw) as T;
}

export async function waitForVisibleMarketCards(page: Page, minCount = 1): Promise<void> {
  await expect
    .poll(
      async () => page.locator('main a[href*="/event/"], main a[href*="/market/"]').count().catch(() => 0),
      { timeout: 45_000 }
    )
    .toBeGreaterThanOrEqual(minCount);
}

export async function waitForMarketFilterBar(page: Page): Promise<void> {
  const filters = ['Status', 'End Date', 'Liquidity (TVL)', 'Volume 24h', 'Creation Time'];

  for (const filterLabel of filters) {
    await expect(marketFilterLabel(page, filterLabel)).toBeVisible({ timeout: 15_000 });
    await expect(marketFilterTrigger(page, filterLabel)).toBeVisible({ timeout: 15_000 });
  }
}

export async function waitForMarketInteractiveState(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await waitForMarketFilterBar(page);

  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
}

export function marketFilterLabel(page: Page, filterLabel: string): Locator {
  return page.getByText(`${filterLabel}:`, { exact: true }).first();
}

export function marketFilterTrigger(page: Page, filterLabel: string): Locator {
  return page.locator('div.cursor-pointer').filter({ hasText: `${filterLabel}:` }).first();
}

export async function applyMarketFilterAndCapture(
  page: Page,
  filterCase: MarketFilterCase
): Promise<MarketApiResponse> {
  await waitForMarketInteractiveState(page);

  const triggerLabel = marketFilterLabel(page, filterCase.filterLabel);
  const trigger = marketFilterTrigger(page, filterCase.filterLabel);
  await expect(triggerLabel).toBeVisible({ timeout: 15_000 });
  await expect(trigger).toBeVisible({ timeout: 15_000 });

  const expectedParts = resolveExpectedRequestParts(filterCase.expectedRequest).map(
    ({ param, value }) => (value === undefined ? `${param}=` : `${param}=${encodeURIComponent(value)}`)
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/polymarket?') &&
      expectedParts.every((part) => response.url().includes(part)) &&
      response.status() === 200,
    { timeout: 45_000 }
  );

  const option = await openMarketFilterOption(page, triggerLabel, trigger, filterCase.optionLabel);
  await option.click();

  const response = await responsePromise;

  await expect(trigger).toContainText(filterCase.optionLabel);
  await expect(page.locator('main')).toContainText(/Clear Filters/i, { timeout: 15_000 });
  await waitForVisibleMarketCards(page, filterCase.minItems ?? 1);

  const body = (await response.json()) as MarketApiResponse;
  return { ...body, _requestUrl: response.url() };
}

async function openMarketFilterOption(
  page: Page,
  triggerLabel: Locator,
  trigger: Locator,
  optionLabel: string
): Promise<Locator> {
  const option = page.getByText(optionLabel, { exact: true }).last();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt === 0) {
      await triggerLabel.click();
    } else if (attempt === 1) {
      await triggerLabel.hover();
      await triggerLabel.click();
    } else if (attempt === 2) {
      await triggerLabel.evaluate((node) => (node as HTMLElement).click());
    } else {
      await page.locator('body').press('Escape').catch(() => undefined);
      await page.waitForTimeout(250);
      const box = await trigger.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
      } else {
        await trigger.click({ force: true });
      }
    }

    if (await option.isVisible().catch(() => false)) {
      return option;
    }

    await page.waitForTimeout(500);
  }

  await expect(option).toBeVisible({ timeout: 10_000 });
  return option;
}

function resolveExpectedRequestParts(expectedRequest: MarketRequestExpectation): RequestParamExpectation[] {
  if (expectedRequest.includes?.length) {
    return expectedRequest.includes;
  }

  if (expectedRequest.param && expectedRequest.value !== undefined) {
    return [{ param: expectedRequest.param, value: expectedRequest.value }];
  }

  throw new Error('expectedRequest must include either param/value or includes[].');
}

export function assertMarketFilterResponse(response: MarketApiResponse, filterCase: MarketFilterCase): void {
  const entries = response.data?.events_with_markets ?? [];
  expect(entries.length, `${filterCase.id} should return at least one filtered event`).toBeGreaterThanOrEqual(
    filterCase.minItems ?? 1
  );

  for (const assertion of filterCase.assertions) {
    if (assertion.scope === 'event') {
      const items = entries.map((entry) => entry.event);
      expect(items.length, `${filterCase.id} has no event records to validate`).toBeGreaterThan(0);

      for (const item of items) {
        assertFieldCondition(item, assertion, filterCase.id);
      }
      continue;
    }

    if (assertion.quantifier === 'any') {
      for (const entry of entries) {
        expect(
          entry.markets.length,
          `${filterCase.id} event ${String(entry.event.slug ?? entry.event.id)} has no markets`
        ).toBeGreaterThan(0);
        expect(
          entry.markets.some((market) => fieldConditionPasses(market, assertion, response)),
          `${filterCase.id} expected at least one market to satisfy ${assertion.field} ${assertion.operator}`
        ).toBeTruthy();
      }
      continue;
    }

    const items = entries.flatMap((entry) => entry.markets);
    expect(items.length, `${filterCase.id} has no market records to validate`).toBeGreaterThan(0);

    for (const item of items) {
      assertFieldCondition(item, assertion, filterCase.id, response);
    }
  }
}

export async function assertVisibleTitles(page: Page, titles: string[]): Promise<void> {
  for (const title of titles) {
    await expect(page.locator('main')).toContainText(title);
  }
}

export async function expectLargeEventChart(
  page: Page,
  minWidth = 200,
  minHeight = 150
): Promise<void> {
  await expect
    .poll(
      async () =>
        page.locator('main svg').evaluateAll(
          (nodes, dims) =>
            nodes.some((node) => {
              const width = Number(node.getAttribute('width') ?? 0);
              const height = Number(node.getAttribute('height') ?? 0);
              return width >= dims.minWidth && height >= dims.minHeight;
            }),
          { minWidth, minHeight }
        ),
      { timeout: 45_000 }
    )
    .toBeTruthy();
}

function assertFieldCondition(
  record: RawRecord,
  assertion: MarketFieldAssertion,
  caseId: string,
  response?: MarketApiResponse
): void {
  expect(
    fieldConditionPasses(record, assertion, response),
    buildFieldFailureMessage(assertion, caseId, readField(record, assertion.field))
  ).toBeTruthy();
}

function fieldConditionPasses(
  record: RawRecord,
  assertion: MarketFieldAssertion,
  response?: MarketApiResponse
): boolean {
  const rawValue = readField(record, assertion.field);

  switch (assertion.operator) {
    case 'not_null':
      return rawValue !== null && rawValue !== undefined && rawValue !== '';
    case 'eq': {
      const left = normalizeValue(rawValue);
      const right = normalizeValue(assertion.value);
      return left === right;
    }
    case 'neq': {
      const left = normalizeValue(rawValue);
      const right = normalizeValue(assertion.value);
      return left !== right;
    }
    case 'gte': {
      const actual = asNumber(rawValue);
      return actual !== null && actual >= Number(assertion.value);
    }
    case 'lte': {
      const actual = asNumber(rawValue);
      return actual !== null && actual <= Number(assertion.value);
    }
    case 'within_next_days': {
      const actual = asDate(rawValue);
      if (!actual) {
        return false;
      }
      const now = Date.now();
      const deadline = now + Number(assertion.value) * 24 * 60 * 60 * 1000;
      return actual.getTime() >= now && actual.getTime() <= deadline;
    }
    case 'within_last_days': {
      const actual = asDate(rawValue);
      if (!actual) {
        return false;
      }
      const now = Date.now();
      const start = now - Number(assertion.value) * 24 * 60 * 60 * 1000;
      return actual.getTime() >= start && actual.getTime() <= now;
    }
    case 'within_request_range': {
      const actual = asDate(rawValue);
      const range = requestDateRange(response?._requestUrl, assertion.requestStartParam, assertion.requestEndParam);
      if (!actual || !range) {
        return false;
      }

      return actual.getTime() >= range.start.getTime() && actual.getTime() <= range.end.getTime();
    }
  }
}

function buildFieldFailureMessage(assertion: MarketFieldAssertion, caseId: string, rawValue: unknown): string {
  const base = `${caseId} expected ${assertion.scope}.${assertion.field}`;

  switch (assertion.operator) {
    case 'not_null':
      return `${base} to be present`;
    case 'eq':
      return `${base} to equal ${String(normalizeValue(assertion.value))}, got ${String(normalizeValue(rawValue))}`;
    case 'neq':
      return `${base} to differ from ${String(normalizeValue(assertion.value))}`;
    case 'gte':
      return `${base} >= ${String(assertion.value)}, got ${String(rawValue)}`;
    case 'lte':
      return `${base} <= ${String(assertion.value)}, got ${String(rawValue)}`;
    case 'within_next_days':
      return `${base} within next ${String(assertion.value)} days, got ${String(rawValue)}`;
    case 'within_last_days':
      return `${base} within last ${String(assertion.value)} days, got ${String(rawValue)}`;
    case 'within_request_range':
      return `${base} within request range ${String(assertion.requestStartParam)}..${String(assertion.requestEndParam)}, got ${String(rawValue)}`;
  }
}

function readField(record: RawRecord, field: string): unknown {
  return field.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as RawRecord)[key];
    }

    return undefined;
  }, record);
}

function normalizeValue(rawValue: unknown): unknown {
  const numeric = asNumber(rawValue);
  if (numeric !== null) {
    return numeric;
  }

  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }

  return rawValue;
}

function asNumber(rawValue: unknown): number | null {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asDate(rawValue: unknown): Date | null {
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    const isoWithoutZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);
    const parsed = new Date(isoWithoutZone ? `${trimmed}Z` : trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function requestDateRange(
  requestUrl: string | undefined,
  startParam: string | undefined,
  endParam: string | undefined
): { start: Date; end: Date } | null {
  if (!requestUrl || !startParam || !endParam) {
    return null;
  }

  const url = new URL(requestUrl);
  const start = asUnixSecondsDate(url.searchParams.get(startParam));
  const end = asUnixSecondsDate(url.searchParams.get(endParam));

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function asUnixSecondsDate(rawValue: string | null): Date | null {
  if (!rawValue) {
    return null;
  }

  const timestamp = Number(rawValue);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}
