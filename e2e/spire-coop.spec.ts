import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';

const COOP_PORT = Number(process.env.COOP_TEST_PORT || 8787);
const COOP_SERVER_URL = `http://127.0.0.1:${COOP_PORT}`;
const COOP_WS_BASE = `ws://127.0.0.1:${COOP_PORT}`;
const SHOT_DIR = process.env.COOP_SHOT_DIR || '';

async function maybeShot(page: Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function isWorkerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${COOP_SERVER_URL}/health`);
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json?.ok === true;
  } catch {
    return false;
  }
}

async function startLocalCoopWorker(): Promise<ChildProcess | null> {
  if (await isWorkerHealthy()) {
    return null;
  }
  const workerDir = path.resolve(__dirname, '../workers/coop-room');
  const child = spawn(
    'npx',
    ['wrangler', 'dev', '--port', String(COOP_PORT), '--local', '--ip', '127.0.0.1'],
    {
      cwd: workerDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1' },
    }
  );

  let logs = '';
  child.stdout?.on('data', chunk => {
    logs += String(chunk);
  });
  child.stderr?.on('data', chunk => {
    logs += String(chunk);
  });

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited prematurely (${child.exitCode}):\n${logs}`);
    }
    if (await isWorkerHealthy()) {
      return child;
    }
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  child.kill('SIGKILL');
  throw new Error(`Timed out waiting for local wrangler dev on ${COOP_SERVER_URL}:\n${logs}`);
}

async function stopLocalCoopWorker(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function readFoeHp(page: Page): Promise<{ hp: number; max: number }> {
  const label = await page.getByTestId('run-foe-hp').getAttribute('aria-label');
  const match = label ? /Foe health\s+(\d+)\s+of\s+(\d+)/i.exec(label) : null;
  if (!match) {
    throw new Error(`Unexpected run-foe-hp aria-label: "${label}"`);
  }
  return { hp: Number.parseInt(match[1], 10), max: Number.parseInt(match[2], 10) };
}

async function assertAllTextVisible(page: Page, contextLabel: string): Promise<void> {
  const violations = await page.evaluate(label => {
    const out: string[] = [];
    const vw = window.innerWidth;

    if (document.documentElement.scrollWidth > vw + 2) {
      out.push(
        `[${label}] Document horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${vw}`
      );
    }

    const isHidden = (el: Element): boolean => {
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          return true;
        }
        if (cur.getAttribute('aria-hidden') === 'true') {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? '').trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest('svg')) continue;
      if (isHidden(parent)) continue;

      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0.5 || rect.height <= 0.5) continue;

      let hScroller: Element | null = null;
      const clippingAncestors: { el: Element; rect: DOMRect }[] = [];
      let anc: Element | null = parent.parentElement;
      while (anc && anc !== document.body) {
        const cs = getComputedStyle(anc);
        if (
          (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          anc.scrollWidth > anc.clientWidth + 2
        ) {
          hScroller = anc;
          break;
        }
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
          clippingAncestors.push({ el: anc, rect: anc.getBoundingClientRect() });
        }
        anc = anc.parentElement;
      }

      if (hScroller) {
        const sr = hScroller.getBoundingClientRect();
        if (sr.left < -2 || sr.right > vw + 2) {
          out.push(
            `[${label}] Horizontal scroller overflows viewport (${Math.round(sr.left)}..${Math.round(sr.right)} vs 0..${vw}) around "${text.slice(0, 40)}"`
          );
        }
        continue;
      }

      const parentStyle = getComputedStyle(parent);
      const allowsEllipsis = parentStyle.textOverflow === 'ellipsis';
      const checkRect = allowsEllipsis ? parent.getBoundingClientRect() : rect;

      if (checkRect.left < -2 || checkRect.right > vw + 2) {
        out.push(
          `[${label}] Text clipped off viewport (${Math.round(checkRect.left)}..${Math.round(checkRect.right)} vs 0..${vw}): "${text.slice(0, 60)}"`
        );
        continue;
      }

      if (!allowsEllipsis) {
        for (const ca of clippingAncestors) {
          if (ca.rect.width <= 1) continue;
          if (rect.left < ca.rect.left - 3 || rect.right > ca.rect.right + 3) {
            out.push(
              `[${label}] Text clipped by ancestor (${Math.round(rect.left)}..${Math.round(rect.right)} vs box ${Math.round(ca.rect.left)}..${Math.round(ca.rect.right)}): "${text.slice(0, 60)}"`
            );
            break;
          }
        }
      }
    }

    return out;
  }, contextLabel);

  expect(violations, `Layout/text clipping violations on ${contextLabel}`).toEqual([]);
}

interface WsHarness {
  ws: WebSocket;
  messages: Record<string, unknown>[];
  send: (msg: Record<string, unknown>) => void;
  waitFor: (predicate: (msg: Record<string, unknown>) => boolean, timeoutMs?: number) => Promise<Record<string, unknown>>;
  close: () => void;
}

async function openCoopWs(
  code: string,
  params: { playerId: string; name: string; fighter: string }
): Promise<WsHarness> {
  const query = new URLSearchParams({
    playerId: params.playerId,
    name: params.name,
    fighter: params.fighter,
  });
  const ws = new WebSocket(`${COOP_WS_BASE}/room/${code}/ws?${query.toString()}`);
  const messages: Record<string, unknown>[] = [];
  const waiters: {
    predicate: (msg: Record<string, unknown>) => boolean;
    resolve: (msg: Record<string, unknown>) => void;
  }[] = [];

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 10_000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket connection error'));
    });
  });

  ws.addEventListener('message', ev => {
    const raw = typeof ev.data === 'string' ? ev.data : '';
    if (!raw || raw === 'pong') return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      messages.push(parsed);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].predicate(parsed)) {
          const w = waiters.splice(i, 1)[0];
          w.resolve(parsed);
        }
      }
    } catch {
      // ignore non-JSON frames
    }
  });

  return {
    ws,
    messages,
    send: msg => ws.send(JSON.stringify(msg)),
    waitFor: (predicate, timeoutMs = 15_000) => {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const entry = {
          predicate,
          resolve: (m: Record<string, unknown>) => {
            clearTimeout(timer);
            resolve(m);
          },
        };
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(entry);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error(`Timed out waiting for co-op WS message (received ${messages.length})`));
        }, timeoutMs);
        waiters.push(entry);
      });
    },
    close: () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    },
  };
}

test.describe('Starfall Summit 2P Co-Op (Real Cloudflare DO + Two-Browser E2E)', () => {
  test.describe.configure({ mode: 'serial' });

  let workerProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    test.setTimeout(60_000);
    workerProcess = await startLocalCoopWorker();
  });

  test.afterAll(async () => {
    await stopLocalCoopWorker(workerProcess);
    workerProcess = null;
  });

  test('Full Two-Browser Duo Climb: Create → Invite URL Auto-Join → Dual Map Vote → Shared Combat & Reload Hydration → KO → Ready Barrier → Shop Gift', async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const vp = { width: 390, height: 844 };
    const hostCtx = await browser.newContext({ viewport: vp });
    const guestCtx = await browser.newContext({ viewport: vp });
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    const hostErrors: string[] = [];
    const guestErrors: string[] = [];
    hostPage.on('pageerror', err => hostErrors.push(err.message));
    guestPage.on('pageerror', err => guestErrors.push(err.message));

    try {
      // (a) Host opens Summit Setup, creates a Duo room against the real local Cloudflare DO
      await hostPage.goto(
        `/?mode=summit&seed=4242&autoplayer=true&coopServer=${encodeURIComponent(COOP_SERVER_URL)}`
      );
      await expect(hostPage.getByTestId('spire-setup')).toBeVisible({ timeout: 25_000 });
      await hostPage.getByTestId('spire-mode-coop').click();
      await expect(hostPage.getByTestId('coop-create-btn')).toBeVisible({ timeout: 10_000 });

      await hostPage.getByTestId('coop-create-btn').click();
      await expect(hostPage.getByTestId('coop-room-code')).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByTestId('coop-connection-status')).toContainText('CONNECTED', {
        timeout: 15_000,
      });

      const roomCode = (await hostPage.getByTestId('coop-room-code').innerText()).trim();
      expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);

      const inviteUrl = (await hostPage.getByTestId('coop-invite-url').innerText()).trim();
      expect(inviteUrl).toContain('mode=summit');
      expect(inviteUrl).toContain(`coop=${roomCode}`);
      expect(inviteUrl).toContain('coopServer=');

      // (b) Guest opens the exact invite URL, auto-joins the SAME Durable Object room
      await guestPage.goto(inviteUrl);
      await expect(guestPage.getByTestId('coop-room-code')).toHaveText(roomCode, {
        timeout: 25_000,
      });
      await expect(guestPage.getByTestId('coop-connection-status')).toContainText('CONNECTED', {
        timeout: 15_000,
      });

      // Pick two distinct fighters (Host: Orange Tabby, Guest: Sly Fox) and ready up
      await hostPage.getByTestId('coop-fighter-Orange Tabby').click();
      await guestPage.getByTestId('coop-fighter-Sly Fox').click();

      await expect(hostPage.getByTestId('coop-ally-status')).toContainText('Sly Fox', {
        timeout: 10_000,
      });
      await expect(guestPage.getByTestId('coop-ally-status')).toContainText('Orange Tabby', {
        timeout: 10_000,
      });

      await hostPage.getByTestId('coop-ready-btn').click();
      await guestPage.getByTestId('coop-ready-btn').click();

      await expect(hostPage.getByTestId('coop-ally-status')).toContainText('Ready', {
        timeout: 10_000,
      });
      await expect(hostPage.getByTestId('coop-start-btn')).toBeEnabled({ timeout: 10_000 });

      await hostPage.waitForTimeout(300);
      await assertAllTextVisible(hostPage, 'Co-Op Duo Lobby Ready (390x844)');
      await maybeShot(hostPage, '01-coop-lobby-ready');

      // Launch Duo Climb — both players enter Act 1 Map simultaneously
      await hostPage.getByTestId('coop-start-btn').click();
      await expect(hostPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByTestId('coop-banner-room-code')).toContainText(roomCode);
      await expect(guestPage.getByTestId('coop-banner-room-code')).toContainText(roomCode);

      // (c) Map Voting: dual-pin mismatch first, then consensus launch on Floor 1 entrance (a1-r0-c0)
      await hostPage.getByTestId('spire-node-a1-r0-c0').click({ force: true });
      await guestPage.getByTestId('spire-node-a1-r0-c1').click({ force: true });

      await expect(hostPage.getByTestId('spire-map-coop-status')).toContainText(
        'Waiting for ally to agree',
        { timeout: 10_000 }
      );
      await expect(hostPage.getByTestId('spire-node-vote-local-a1-r0-c0')).toBeVisible();
      await expect(hostPage.getByTestId('spire-node-vote-ally-a1-r0-c1')).toBeVisible();

      await hostPage.waitForTimeout(300);
      await assertAllTextVisible(hostPage, 'Co-Op Map Dual-Pin Voting (390x844)');
      await maybeShot(hostPage, '02-coop-map-dual-vote');

      // Guest agrees on a1-r0-c0 → both enter combat simultaneously!
      await guestPage.getByTestId('spire-node-a1-r0-c0').click({ force: true });

      await expect(hostPage.getByTestId('run-stage')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('run-stage')).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByTestId('coop-ally-hud')).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.getByTestId('coop-ally-hud')).toBeVisible({ timeout: 10_000 });

      // (d) Live Co-Op Combat: verify 1.75x duo Boss HP (145 * 1.75 = 254) and real-time sync
      const guestInitialHp = await readFoeHp(guestPage);
      expect(guestInitialHp.max).toBe(254);

      // Wait until Host's autoplayer lands Sets and Guest's Boss HP drops strictly below max
      // (Guest does NOT have autoplayer enabled, proving 100% live Durable Object sync!)
      await expect
        .poll(
          async () => {
            const cur = await readFoeHp(guestPage);
            return cur.hp;
          },
          { timeout: 25_000, message: 'Guest Boss HP should drop from Host Sets via DO' }
        )
        .toBeLessThan(guestInitialHp.max);

      const hostMidHp = await readFoeHp(hostPage);
      const guestMidHp = await readFoeHp(guestPage);
      expect(hostMidHp.hp).toBeLessThan(254);
      expect(guestMidHp.hp).toBeLessThan(254);

      await guestPage.waitForTimeout(250);
      await assertAllTextVisible(guestPage, 'Co-Op Live Twin-Critter Stage (390x844)');
      await maybeShot(guestPage, '03-coop-live-combat-stage');

      // (f) Reconnect resilience: Guest reloads mid-fight and immediately hydrates authoritative DO SNAPSHOT!
      if (guestMidHp.hp > 0) {
        await guestPage.reload();
        // Guest should skip setup and hydrate straight back into the active fight (or rewards if boss just died)
        await expect(
          guestPage.getByTestId('run-stage').or(guestPage.getByTestId('spire-reward-screen'))
        ).toBeVisible({ timeout: 20_000 });

        if (await guestPage.getByTestId('run-stage').isVisible()) {
          const hydratedHp = await readFoeHp(guestPage);
          expect(hydratedHp.max).toBe(254);
          expect(hydratedHp.hp).toBeLessThan(254);
          expect(hydratedHp.hp).toBeLessThanOrEqual(guestMidHp.hp);
        }
      }

      // Wait for Host to finish Boss KO → BOTH Host & Guest advance to SpireRewardScreen!
      await expect(hostPage.getByTestId('spire-reward-screen')).toBeVisible({ timeout: 60_000 });
      await expect(guestPage.getByTestId('spire-reward-screen')).toBeVisible({ timeout: 20_000 });

      // (e) Ready Barrier on Rewards: Host drafts & readies up → waits until Guest readies up!
      await hostPage.getByTestId('spire-draft-pick-0').click();
      if (await hostPage.getByTestId('spire-skill-pick-0').isVisible()) {
        await hostPage.getByTestId('spire-skill-pick-0').click();
      }
      await hostPage.getByTestId('spire-reward-continue').click();
      await expect(hostPage.getByTestId('spire-reward-coop-status')).toContainText(
        'Waiting for Sly Fox',
        { timeout: 10_000 }
      );
      await expect(guestPage.getByTestId('spire-reward-coop-status')).toContainText(
        'Orange Tabby is ready',
        { timeout: 10_000 }
      );

      // Guest drafts & readies up → BOTH advance back to Row 1 Map simultaneously!
      await guestPage.getByTestId('spire-draft-pick-0').click();
      if (await guestPage.getByTestId('spire-skill-pick-0').isVisible()) {
        await guestPage.getByTestId('spire-skill-pick-0').click();
      }
      await guestPage.getByTestId('spire-reward-continue').click();

      await expect(hostPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });

      // Both vote on Row 1 Merchant Shop (a1-r1-c0) → enter Shop & test Shop Gift + Ready Barrier
      await hostPage.getByTestId('spire-node-a1-r1-c0').click({ force: true });
      await guestPage.getByTestId('spire-node-a1-r1-c0').click({ force: true });
      await expect(hostPage.getByTestId('spire-shop')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('spire-shop')).toBeVisible({ timeout: 15_000 });

      // Host toggles Gift Mode and gifts an affordable weapon to Guest!
      await hostPage.getByTestId('spire-shop-gift-toggle').click();
      await expect(hostPage.getByTestId('spire-shop-gift-toggle')).toContainText('GIFT MODE ON');

      let gifted = false;
      for (let i = 0; i < 4; i++) {
        const btn = hostPage.getByTestId(`spire-shop-gift-weapon-${i}`);
        if ((await btn.count()) > 0 && (await btn.isEnabled())) {
          await btn.click();
          gifted = true;
          break;
        }
      }
      expect(gifted, 'Host should afford at least one weapon gift in Row 1 shop').toBe(true);
      await expect(guestPage.getByTestId('coop-banner-notice')).toContainText('Orange Tabby gifted', {
        timeout: 10_000,
      });

      // Shop Ready Barrier: Host marks ready → waits for Guest → Guest marks ready → both return to Map
      await hostPage.getByTestId('spire-shop-leave').click();
      await expect(hostPage.getByTestId('spire-shop-coop-status')).toContainText(
        'Waiting for Sly Fox',
        { timeout: 10_000 }
      );
      await guestPage.getByTestId('spire-shop-leave').click();
      await expect(hostPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });

      expect(hostErrors).toEqual([]);
      expect(guestErrors).toEqual([]);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('Live Real-DO Combat Sync: Cross-Parry Stagger, Shared Synergy, Wild Card Gift, and Golden Cage + Cheer + 3-Set Revive', async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const guestPage = await ctx.newPage();
    const pageErrors: string[] = [];
    guestPage.on('pageerror', err => pageErrors.push(err.message));

    // Create room via real Worker HTTP API & connect real Host WebSocket directly to Durable Object
    const createRes = await fetch(`${COOP_SERVER_URL}/room`, { method: 'POST' });
    expect(createRes.status).toBe(201);
    const { code } = (await createRes.json()) as { code: string; wsPath: string };
    const hostWs = await openCoopWs(code, {
      playerId: 'e2e_host_ws',
      name: 'Orange Tabby',
      fighter: 'Orange Tabby',
    });

    try {
      await hostWs.waitFor(m => m.type === 'SNAPSHOT');
      hostWs.send({ type: 'UPDATE_LOBBY', fighter: 'Orange Tabby', name: 'Orange Tabby', ready: true });

      // Real browser Guest joins via invite URL (manual play, no autoplayer)
      await guestPage.goto(
        `/?mode=summit&coop=${code}&coopServer=${encodeURIComponent(COOP_SERVER_URL)}`
      );
      await expect(guestPage.getByTestId('coop-room-code')).toHaveText(code, { timeout: 25_000 });
      await expect(guestPage.getByTestId('coop-connection-status')).toContainText('CONNECTED', {
        timeout: 15_000,
      });

      await guestPage.getByTestId('coop-fighter-Sly Fox').click();
      await guestPage.getByTestId('coop-ready-btn').click();

      // Wait until DO confirms Guest is ready, then Host launches climb
      await hostWs.waitFor(m => {
        if (m.type !== 'SNAPSHOT') return false;
        const snap = m.snapshot as { players: { playerId: string; ready: boolean }[] };
        const guest = snap.players.find(p => p.playerId !== 'e2e_host_ws');
        return Boolean(guest?.ready);
      });

      hostWs.send({ type: 'START_CLIMB', seed: 4242, ascension: 0 });
      await expect(guestPage.getByTestId('spire-map')).toBeVisible({ timeout: 15_000 });

      // Both vote a1-r0-c0 → Guest enters combat
      hostWs.send({ type: 'VOTE_NODE', nodeId: 'a1-r0-c0', nodeKind: 'skirmish', nextPhase: 'fight' });
      await guestPage.getByTestId('spire-node-a1-r0-c0').click({ force: true });
      await expect(guestPage.getByTestId('run-stage')).toBeVisible({ timeout: 15_000 });
      await hostWs.waitFor(m => m.type === 'FIGHT_STARTED');

      // 1. Ally Hit sync + Combo badge
      hostWs.send({ type: 'DEAL_DAMAGE', amount: 44, combo: 3, isRainbow: true });
      await expect
        .poll(async () => (await readFoeHp(guestPage)).hp, { timeout: 10_000 })
        .toBe(210);
      await expect(guestPage.getByTestId('coop-ally-combo')).toContainText('×3');

      // 2. Shared Synergy + Cross-Parry Stagger sync
      hostWs.send({ type: 'SYNERGY_DELTA', deltas: { burn: 4, parries: 1 } });
      hostWs.send({ type: 'PARRY_REPORT', kind: 'perfect', staggerMs: 6000 });
      await expect(guestPage.getByTestId('run-parry-bar')).toContainText(/STAGGER/i, {
        timeout: 10_000,
      });

      // 3. Ally Wild Card Gift delivery
      hostWs.send({ type: 'SEND_GIFT', kind: 'wild_card' });
      await expect(guestPage.getByText(/WILD CARD/i).first()).toBeVisible({ timeout: 10_000 });

      // 4. Golden Cage + Cheer + 3-Set Revive end-to-end through the real Durable Object!
      // Guest intentionally makes invalid 3-card picks on the real board to lose hearts → Golden Cage!
      const slotCombos: [string, string, string][] = [
        ['card-slot-0-0', 'card-slot-0-1', 'card-slot-0-2'],
        ['card-slot-0-0', 'card-slot-0-1', 'card-slot-1-0'],
        ['card-slot-0-0', 'card-slot-1-1', 'card-slot-2-2'],
        ['card-slot-0-1', 'card-slot-1-0', 'card-slot-1-2'],
        ['card-slot-1-0', 'card-slot-1-1', 'card-slot-1-2'],
      ];
      for (let attempt = 0; attempt < 14; attempt++) {
        if (await guestPage.getByTestId('coop-cage-overlay').isVisible()) break;
        const [a, b, c] = slotCombos[attempt % slotCombos.length];
        await guestPage.getByTestId(a).click({ force: true });
        await guestPage.getByTestId(b).click({ force: true });
        await guestPage.getByTestId(c).click({ force: true });
        await guestPage.waitForTimeout(450);
      }

      await expect(guestPage.getByTestId('coop-cage-overlay')).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.getByTestId('coop-cage-status-text')).toContainText('0/3 Sets');

      // Guest taps Cheer button inside Golden Cage → Host receives real EMOTE_RECEIVED over DO!
      const cheerPromise = hostWs.waitFor(m => m.type === 'EMOTE_RECEIVED' && m.emote === 'cheer');
      await guestPage.getByTestId('coop-cage-cheer-btn').click();
      await cheerPromise;

      // Host lands 3 Sets → rescue progresses 1/3 → 2/3 → Golden Cage breaks open & revives Guest!
      hostWs.send({ type: 'DEAL_DAMAGE', amount: 15, combo: 1 });
      await expect(guestPage.getByTestId('coop-cage-status-text')).toContainText('1/3 Sets', {
        timeout: 10_000,
      });

      hostWs.send({ type: 'DEAL_DAMAGE', amount: 15, combo: 2 });
      await expect(guestPage.getByTestId('coop-cage-status-text')).toContainText('2/3 Sets', {
        timeout: 10_000,
      });

      hostWs.send({ type: 'DEAL_DAMAGE', amount: 15, combo: 3 });
      await expect(guestPage.getByTestId('coop-cage-overlay')).toBeHidden({ timeout: 10_000 });

      expect(pageErrors).toEqual([]);
    } finally {
      hostWs.close();
      await ctx.close();
    }
  });
});
