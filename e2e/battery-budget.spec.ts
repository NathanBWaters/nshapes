import { test, expect, type CDPSession } from '@playwright/test';

async function getMetricsMap(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map(m => [m.name, m.value]));
}

test.describe('Performance & Battery Budgets', () => {
  test.describe.configure({ mode: 'serial' });

  test('60-node Adventure Map stays within strict CPU, layout, and frame-loop budgets', async ({ page }) => {
    await page.goto('/dev/adventure?save=maxed');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      (window as any).__NSHAPES_PERF__?.resetViolations();
    });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    const m0 = await getMetricsMap(cdp);
    await page.waitForTimeout(3000);
    const m1 = await getMetricsMap(cdp);

    const snap = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());

    expect(snap.activeFrameLoops).toBeGreaterThan(0);
    expect(snap.activeFrameLoops).toBeLessThanOrEqual(6);
    expect(snap.violations).toEqual([]);
    expect((m1.ScriptDuration - m0.ScriptDuration) / 3).toBeLessThan(0.15);
    expect(m1.LayoutCount - m0.LayoutCount).toBeLessThan(20);

    await page.getByTestId('map-play-next').click();
    await expect(page.getByTestId('preview-play')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(200);

    const previewSnap = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());
    expect(previewSnap.activeFrameLoops).toBeLessThanOrEqual(6);
    expect(previewSnap.violations).toEqual([]);
  });

  test('Backgrounded fight suspends Web Audio, silences 3s note leaks, pauses clock, and drops CPU near zero', async ({ page }) => {
    await page.goto('/dev/adventure?save=maxed');
    await expect(page.getByTestId('map-play-next')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('map-play-next').click();
    await expect(page.getByTestId('preview-play')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('preview-play').click();

    await expect(page.getByTestId('run-foe-hp')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('gear-belt')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1600);

    const fgSnap = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());
    expect(fgSnap.audio.state).toBe('running');
    expect(fgSnap.audio.voiceCount).toBeGreaterThan(0);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.evaluate(() => {
      (window as any).__NSHAPES_PERF__?.resetViolations();
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });

    await page.waitForTimeout(400);
    await expect(page.getByText('PAUSED')).toBeVisible();

    const beforeBg = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());
    expect(beforeBg.audio.state).toBe('suspended');
    expect(beforeBg.activeFrameLoops).toBe(0);
    expect(beforeBg.activeIntervals).toBe(0);
    expect(beforeBg.violations).toEqual([]);

    const m0 = await getMetricsMap(cdp);
    await page.waitForTimeout(3200);
    const m1 = await getMetricsMap(cdp);

    const afterBg = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());
    expect(afterBg.audio.state).toBe('suspended');
    expect(afterBg.audio.voiceCount).toBe(beforeBg.audio.voiceCount);
    expect(afterBg.activeFrameLoops).toBe(0);
    expect(afterBg.activeIntervals).toBe(0);
    expect(afterBg.violations).toEqual([]);
    expect((m1.ScriptDuration - m0.ScriptDuration) / 3.2).toBeLessThan(0.05);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
    });

    await page.waitForTimeout(300);
    const resumedSnap = await page.evaluate(() => (window as any).__NSHAPES_PERF__.getSnapshot());
    expect(resumedSnap.audio.state).toBe('running');
    expect(resumedSnap.violations).toEqual([]);
  });
});
