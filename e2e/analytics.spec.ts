import { test, expect, type Page } from '@playwright/test';

interface CapturedBatchEvent {
  uuid: string;
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

const findMmkvValue = (page: Page, keySuffix: string) =>
  page.evaluate((suffix: string) => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === suffix || k.endsWith(`/${suffix}`) || k.endsWith(`.${suffix}`) || k.endsWith(`\\${suffix}`) || k.includes(suffix))) {
        return localStorage.getItem(k);
      }
    }
    return null;
  }, keySuffix);

test.describe('NShapes PostHog game analytics E2E', () => {
  test.setTimeout(90_000);

  test('emits strictly one wide fight_ended per game with 👍 rating, tags, session, person profile & Camp opt-out', async ({
    page,
  }) => {
    const sentEvents: CapturedBatchEvent[] = [];

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.route('**/batch/**', async route => {
      const postData = route.request().postData();
      if (postData) {
        const parsed = JSON.parse(postData) as { batch?: CapturedBatchEvent[] };
        if (Array.isArray(parsed.batch)) {
          sentEvents.push(...parsed.batch);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 1 }),
      });
    });

    await page.goto('/dev/adventure?save=maxed&autoplay=true');

    // app_opened fires once at session start
    await expect
      .poll(() => sentEvents.filter(e => e.event === 'app_opened').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    // Start fast battle 1-1 via map -> preview -> play
    await page.getByTestId('map-node-1-1').click();
    await page.getByTestId('preview-play').click();

    // Autoplayer wins 1-1 quickly and reaches LevelResults
    await expect(page.getByTestId('results-fun-up')).toBeVisible({ timeout: 45_000 });

    // Strictly staged: ZERO fight_ended events posted while still on LevelResults
    expect(sentEvents.filter(e => e.event === 'fight_ended')).toHaveLength(0);

    // Rate 👍 + pick reason tag -> still staged in place with 0 emitted fight_ended events
    await page.getByTestId('results-fun-up').click();
    await expect(page.getByTestId('results-fun-saved')).toBeVisible();
    await page.getByTestId('results-fun-tag-close_call').click();
    expect(sentEvents.filter(e => e.event === 'fight_ended')).toHaveLength(0);

    // Leaving results commits & flushes ONE wide fight_ended event
    await page.getByTestId('results-map').click();
    await expect
      .poll(() => sentEvents.filter(e => e.event === 'fight_ended').length, { timeout: 10_000 })
      .toBe(1);

    const fightEvent = sentEvents.find(e => e.event === 'fight_ended')!;
    expect(fightEvent.properties.mode).toBe('adventure');
    expect(fightEvent.properties.level_id).toBe('1-1');
    expect(fightEvent.properties.fun_rating).toBe('up');
    expect(fightEvent.properties.fun_score).toBe(1);
    expect(fightEvent.properties.fun_tags).toEqual(['close_call']);
    expect(typeof fightEvent.properties.$session_id).toBe('string');
    expect(String(fightEvent.properties.$session_id).length).toBeGreaterThan(8);
    expect(String(fightEvent.properties.player_code)).toMatch(/^NSH-[A-Z0-9]{8}$/);
    expect(fightEvent.properties.$set).toBeDefined();
    expect(fightEvent.properties.$set_once).toBeDefined();
    expect(fightEvent.properties.recording).toBeDefined();

    // Check Camp Analytics Opt-Out switch
    await expect(page.getByTestId('map-dock-camp')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('map-dock-camp').click();
    await expect(page.getByTestId('camp-toggle-analytics')).toBeVisible();
    await page.getByTestId('camp-toggle-analytics').click();
    await expect
      .poll(async () => findMmkvValue(page, 'analytics_opt_out'), { timeout: 5_000 })
      .toBe('1');
  });

  test('persists offline HTTP 503 queue in storage and flushes cleanly when network recovers', async ({
    page,
  }) => {
    let failNetwork = true;
    const recoveredEvents: CapturedBatchEvent[] = [];

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.route('**/batch/**', async route => {
      if (failNetwork) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'offline' });
        return;
      }
      const postData = route.request().postData();
      if (postData) {
        const parsed = JSON.parse(postData) as { batch?: CapturedBatchEvent[] };
        if (Array.isArray(parsed.batch)) {
          recoveredEvents.push(...parsed.batch);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 1 }),
      });
    });

    await page.goto('/dev/adventure?save=maxed&autoplay=true');
    await page.getByTestId('map-node-1-1').click();
    await page.getByTestId('preview-play').click();
    await expect(page.getByTestId('results-fun-up')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('results-fun-down').click();
    await page.getByTestId('results-map').click();

    // Queue remains persisted locally while network returns 503
    await expect
      .poll(
        async () => {
          const raw = await findMmkvValue(page, 'analytics_queue');
          return raw ? JSON.parse(raw).length : 0;
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(1);
    expect(recoveredEvents).toHaveLength(0);

    // Recover network and flush from /dev/analytics
    failNetwork = false;
    await page.goto('/dev/analytics');
    await expect(page.getByTestId('analytics-dashboard-root')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('analytics-flush-btn')).toContainText(/Flush \([1-9]\d*/);

    await page.getByTestId('analytics-flush-btn').click();

    await expect
      .poll(() => recoveredEvents.filter(e => e.event === 'fight_ended').length, {
        timeout: 10_000,
      })
      .toBe(1);
    expect(recoveredEvents.find(e => e.event === 'fight_ended')?.properties.fun_rating).toBe('down');
    await expect(page.getByTestId('analytics-flush-btn')).toContainText('Flush (0)');
  });

  for (const vp of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 375, height: 667 },
  ]) {
    test(`/dev/analytics?source=simulated renders all 5 tabs & charts cleanly on ${vp.name}`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/dev/analytics?source=simulated');

      await expect(page.getByTestId('analytics-dashboard-root')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('analytics-retention-chart')).toBeVisible();

      await page.getByTestId('analytics-tab-funnel').click();
      await expect(page.getByTestId('analytics-funnel-chart')).toBeVisible();

      await page.getByTestId('analytics-tab-balance').click();
      await expect(page.getByTestId('analytics-balance-chart')).toBeVisible();
      await page.getByTestId('analytics-balance-fighters').click();
      await expect(page.getByText(/Fighters Balance/i)).toBeVisible();
      await page.getByTestId('analytics-balance-evolutions').click();
      await expect(page.getByText(/Evolutions Balance/i)).toBeVisible();
      await page.getByTestId('analytics-balance-arcana').click();
      await expect(page.getByText(/Arcana Balance/i)).toBeVisible();

      await page.getByTestId('analytics-tab-enjoyment').click();
      await expect(page.getByTestId('analytics-enjoyment-chart')).toBeVisible();

      await page.getByTestId('analytics-tab-posthog').click();
      await expect(page.getByText(/Project 738615/i)).toBeVisible();

      // Verify zero unintended horizontal page overflow and zero uncaught runtime errors
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
      expect(pageErrors).toHaveLength(0);
    });
  }
});
