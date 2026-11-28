import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

function runNodeEsm<T = unknown>(code: string, payload?: unknown): T {
  const env = {
    ...process.env,
    MOTION_TEST_PAYLOAD: payload !== undefined ? JSON.stringify(payload) : '',
  };
  const stdout = execFileSync('node', ['--input-type=module', '-e', code], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  });
  return JSON.parse(stdout.trim()) as T;
}

describe('SPRITE-POP pixel-continuity & centroid-jump gate (scripts/motion/analyze.mjs)', () => {
  it('catches synthetic 1-frame UV-cell teleport spikes while passing smooth 16fps idle loops', () => {
    const result = runNodeEsm<{
      smooth: { findings: { code: string; at: number }[]; summary: { popCount: number; maxSpikeMult: number } };
      teleported: {
        findings: { code: string; at: number; reason: string; spikeMult: number; l1: number; rms: number }[];
        summary: { popCount: number };
      };
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 96;
      const H = 96;

      function makeFrame({ cx, cy, rx, ry, color, bg = [250, 246, 238, 255], earShift = 0, stripePhase = 0 }) {
        const data = new Uint8Array(W * H * 4);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            const inBody = dx * dx + dy * dy <= 1.0;
            const inEarL = Math.hypot(x - (cx - 12), y - (cy - ry + 2 + earShift)) <= 8;
            const inEarR = Math.hypot(x - (cx + 12), y - (cy - ry + 2 - earShift)) <= 8;
            if (inBody || inEarL || inEarR) {
              const stripe = ((x + y + stripePhase) % 10) < 3 ? 28 : 0;
              data[o] = Math.min(255, Math.max(0, color[0] - stripe));
              data[o + 1] = Math.min(255, Math.max(0, color[1] - stripe));
              data[o + 2] = Math.min(255, Math.max(0, color[2] - stripe));
              data[o + 3] = 255;
            } else {
              data[o] = bg[0];
              data[o + 1] = bg[1];
              data[o + 2] = bg[2];
              data[o + 3] = bg[3];
            }
          }
        }
        return { width: W, height: H, data };
      }

      // Smooth 16fps seamless 32-frame idle loop sampled at 60Hz (advances every 4 display frames, 68f total including wrap)
      const smoothFrames = [];
      for (let f = 0; f < 68; f++) {
        const cell = Math.floor(f / 4) % 32;
        const phase = (cell / 32) * Math.PI * 2;
        smoothFrames.push(
          makeFrame({
            cx: 48 + Math.sin(phase) * 2.0,
            cy: 52 + Math.cos(phase) * 2.0,
            rx: 24 + Math.sin(phase) * 1.2,
            ry: 22 + Math.cos(phase) * 1.2,
            color: [228, 124, 38],
            earShift: Math.sin(phase) * 2.5,
            stripePhase: Math.round(Math.sin(phase) * 2),
          })
        );
      }

      // Inject a 1-frame UV-cell teleport at f24 (completely different pose silhouette & color block, then holds)
      const teleportFrames = smoothFrames.map(fr => ({ width: fr.width, height: fr.height, data: new Uint8Array(fr.data) }));
      const lungePose = makeFrame({
        cx: 53,
        cy: 45,
        rx: 34,
        ry: 15,
        color: [45, 70, 170],
        earShift: 5,
        stripePhase: 4,
      });
      for (let f = 24; f < 36; f++) {
        teleportFrames[f] = lungePose;
      }

      const smooth = detectSpritePops(smoothFrames, { snapFrames: [] });
      const teleported = detectSpritePops(teleportFrames, { snapFrames: [] });
      console.log(JSON.stringify({ smooth, teleported }));
    `);

    expect(result.smooth.findings).toHaveLength(0);
    expect(result.smooth.summary.popCount).toBe(0);
    expect(result.smooth.summary.maxSpikeMult).toBeLessThan(3.8);

    // Must flag both the f24 hard entry teleport and the f36 hard recovery teleport back to idle
    const flaggedFrames = result.teleported.findings.map(f => f.at);
    expect(flaggedFrames).toContain(24);
    expect(flaggedFrames).toContain(36);
    const f24 = result.teleported.findings.find(f => f.at === 24);
    expect(f24?.code).toBe('SPRITE-POP');
    expect(f24?.spikeMult).toBeGreaterThan(3.8);
    expect(f24?.l1).toBeGreaterThanOrEqual(5.5);
  });

  it('catches synthetic -12px sideways centroid registration snaps even with identical pose art', () => {
    const result = runNodeEsm<{
      findings: {
        code: string;
        at: number;
        reason: string;
        dcx: number;
        centroidShiftPx: number;
        centroidShiftRatio: number;
      }[];
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 100;
      const H = 100;

      function makeSprite(cx, cy) {
        const data = new Uint8Array(W * H * 4);
        // Transparent background (alpha=0) with crisp foreground figure
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            if (Math.hypot(x - cx, y - cy) <= 18) {
              data[o] = 220;
              data[o + 1] = 110;
              data[o + 2] = 30;
              data[o + 3] = 255;
            }
          }
        }
        return { width: W, height: H, data };
      }

      const frames = [];
      for (let f = 0; f < 32; f++) {
        const step = Math.floor(f / 4);
        const gentleBob = Math.sin((step / 8) * Math.PI * 2) * 1.2;
        // At f16, teleport -12px sideways (mimicking v0.1.188 Tabby idle -> act:blink registration bug!)
        const xOffset = f >= 16 ? -12 : 0;
        frames.push(makeSprite(56 + xOffset, 52 + gentleBob));
      }

      const out = detectSpritePops(frames, { snapFrames: [] });
      console.log(JSON.stringify(out));
    `);

    const f16 = result.findings.find(f => f.at === 16);
    expect(f16).toBeDefined();
    expect(f16?.code).toBe('SPRITE-POP');
    expect(f16?.dcx).toBeLessThanOrEqual(-11);
    expect(f16?.centroidShiftPx).toBeGreaterThanOrEqual(11);
    expect(f16?.centroidShiftRatio).toBeGreaterThan(0.1);
    expect(['centroid-jump', 'both']).toContain(f16?.reason);
  });

  it('ignores whitelisted Sakurai snapFrames while still flagging unwhitelisted recovery teleports', () => {
    const result = runNodeEsm<{
      findings: { code: string; at: number }[];
      steps: { frame: number; snapped: boolean; popped: boolean }[];
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 96;
      const H = 96;

      function makeSprite(cx, cy, rx, ry, color) {
        const data = new Uint8Array(W * H * 4);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) {
              data[o] = color[0];
              data[o + 1] = color[1];
              data[o + 2] = color[2];
              data[o + 3] = 255;
            } else {
              data[o] = 255;
              data[o + 1] = 255;
              data[o + 2] = 255;
              data[o + 3] = 255;
            }
          }
        }
        return { width: W, height: H, data };
      }

      const frames = [];
      for (let f = 0; f < 48; f++) {
        const cell = Math.floor(f / 4) % 12;
        const phase = (cell / 12) * Math.PI * 2;
        if (f >= 4 && f <= 37) {
          // Whitelisted Sakurai strike snap at f4 (shifts +14px and stretches) held until f37
          frames.push(makeSprite(62, 46, 30, 14, [40, 80, 210]));
        } else {
          // Normal idle before f4 and hard unbridged recovery pop back to idle at f38
          frames.push(makeSprite(48 + Math.sin(phase) * 1.5, 52 + Math.cos(phase) * 1.5, 22, 22, [230, 125, 35]));
        }
      }

      const out = detectSpritePops(frames, { snapFrames: [2, 3, 4, 5, 6, 7, 8, 9] });
      console.log(JSON.stringify(out));
    `);

    const flaggedFrames = result.findings.map(f => f.at);
    expect(flaggedFrames).not.toContain(4);
    expect(flaggedFrames).toContain(38);
    expect(result.steps.find(s => s.frame === 4)?.snapped).toBe(true);
    expect(result.steps.find(s => s.frame === 38)?.popped).toBe(true);
  });

  it('passes smooth 64ms (4-frame) dual-layer crossfades with zero false positives while catching the 1-frame hard cut of the same poses', () => {
    const result = runNodeEsm<{
      hardCut: { findings: { at: number; code: string }[] };
      crossfade: { findings: { at: number; code: string }[]; summary: { popCount: number; maxCentroidShiftRatio: number } };
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 96;
      const H = 96;

      function makePose(cx, cy, rx, ry, color) {
        const data = new Uint8Array(W * H * 4);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) {
              data[o] = color[0];
              data[o + 1] = color[1];
              data[o + 2] = color[2];
              data[o + 3] = 255;
            } else {
              data[o] = 248;
              data[o + 1] = 244;
              data[o + 2] = 236;
              data[o + 3] = 255;
            }
          }
        }
        return { width: W, height: H, data };
      }

      function blendFrames(a, b, alpha) {
        const data = new Uint8Array(a.data.length);
        const inv = 1 - alpha;
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.round(a.data[i] * inv + b.data[i] * alpha);
        }
        return { width: a.width, height: a.height, data };
      }

      const idleAt = f => {
        const cell = Math.floor(f / 4) % 16;
        const p = (cell / 16) * Math.PI * 2;
        return makePose(48 + Math.sin(p) * 1.8, 52 + Math.cos(p) * 1.6, 22, 22, [225, 128, 42]);
      };
      // Acting pose with distinct silhouette + mild shift (would pop if cut in 1f!)
      const coilPose = makePose(43, 56, 26, 17, [155, 80, 145]);

      // 1-frame hard cut into coil at f20 and back to idle at f36
      const hardFrames = [];
      for (let f = 0; f < 56; f++) {
        hardFrames.push(f >= 20 && f < 36 ? coilPose : idleAt(f));
      }

      // Smooth 64ms (4-frame) dual-layer crossfade into coil (f20..f23) and back to idle (f36..f39)
      const fadeFrames = [];
      for (let f = 0; f < 56; f++) {
        if (f >= 20 && f < 24) {
          const alpha = (f - 19) / 4; // 0.25, 0.50, 0.75, 1.00
          fadeFrames.push(blendFrames(idleAt(19), coilPose, alpha));
        } else if (f >= 24 && f < 36) {
          fadeFrames.push(coilPose);
        } else if (f >= 36 && f < 40) {
          const alpha = (f - 35) / 4; // 0.25, 0.50, 0.75, 1.00
          fadeFrames.push(blendFrames(coilPose, idleAt(f), alpha));
        } else {
          fadeFrames.push(idleAt(f));
        }
      }

      const hardCut = detectSpritePops(hardFrames, { snapFrames: [] });
      const crossfade = detectSpritePops(fadeFrames, { snapFrames: [] });
      console.log(JSON.stringify({ hardCut, crossfade }));
    `);

    expect(result.hardCut.findings.map(f => f.at)).toEqual(expect.arrayContaining([20, 36]));
    expect(result.crossfade.findings).toHaveLength(0);
    expect(result.crossfade.summary.popCount).toBe(0);
    expect(result.crossfade.summary.maxCentroidShiftRatio).toBeLessThan(0.1);
  });

  it('wires SPRITE-POP into analyze(dir) for spriteGate / primary sprite clips and leaves non-sprite shots untouched', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-sprite-pop-'));
    try {
      const res = runNodeEsm<{
        nonSpriteHints: { code: string }[];
        nonSpriteHasContinuity: boolean;
        spriteGateHints: { code: string; at: number }[];
        spriteGateReport: string;
        autoClipHints: { code: string; at: number }[];
      }>(
        `
        import fs from 'node:fs';
        import path from 'node:path';
        import { createRequire } from 'node:module';
        import { analyze } from './scripts/motion/analyze.mjs';

        const require = createRequire(import.meta.url);
        const { PNG } = require('pngjs');
        const tmpBase = JSON.parse(process.env.MOTION_TEST_PAYLOAD).tmpBase;

        function writePng(file, width, height, draw) {
          const png = new PNG({ width, height });
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const o = (y * width + x) * 4;
              const [r, g, b, a] = draw(x, y);
              png.data[o] = r;
              png.data[o + 1] = g;
              png.data[o + 2] = b;
              png.data[o + 3] = a;
            }
          }
          fs.writeFileSync(file, PNG.sync.write(png));
        }

        function buildCaptureFixture(dir, shotConfig, extraCapture) {
          const framesDir = path.join(dir, 'frames');
          fs.mkdirSync(framesDir, { recursive: true });
          const W = 96;
          const H = 96;
          const frameCount = 24;
          for (let f = 0; f < frameCount; f++) {
            const snapped = f === 4;
            const popped = f >= 14;
            const cx = snapped ? 66 : popped ? 36 : 50 + (f % 4 === 0 ? 1 : 0);
            const color = snapped ? [40, 70, 220] : popped ? [30, 150, 90] : [225, 125, 40];
            writePng(path.join(framesDir, 'f' + String(f).padStart(3, '0') + '.png'), W, H, (x, y) => {
              if (Math.hypot(x - cx, y - 50) <= 18) return [color[0], color[1], color[2], 255];
              return [255, 255, 255, 255];
            });
          }
          const capture = {
            shot: shotConfig,
            label: 'test',
            url: 'http://localhost:8099/dev/fighters',
            sha: 'testsha',
            step: 16,
            dpr: 1,
            viewport: { width: 390, height: 844 },
            clip: { x: 0, y: 0, width: W, height: H },
            size: { x: 0, y: 0, width: W, height: H },
            preroll: 0,
            ambient: 0,
            frames: frameCount,
            activity: Array.from({ length: frameCount }, (_, i) => (i === 0 ? 0 : 10)),
            boxes: Array.from({ length: frameCount }, () => [0, 0, W, H]),
            regions: { 'fighter-sprite-viewport': [0, 0, W, H] },
            tracks: [],
            ...extraCapture,
          };
          fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture));
        }

        // 1. Non-sprite full-screen shot (clip: null, no spriteGate): must NOT run SPRITE-POP
        const nonSpriteDir = path.join(tmpBase, 'non-sprite');
        buildCaptureFixture(
          nonSpriteDir,
          { id: 'synthetic-fullscreen-board', about: 'Non-sprite board shot', path: '/', mute: [] },
          { clip: null, size: { x: 0, y: 0, width: 390, height: 844 }, regions: { 'fighter-sprite-viewport': [14, 63, 44, 44] } }
        );
        const nonSpriteOut = analyze(nonSpriteDir);

        // 2. Explicit spriteGate shot whitelisting f4 (and f5 return) while catching f14 pop
        const gateDir = path.join(tmpBase, 'sprite-gate');
        buildCaptureFixture(
          gateDir,
          { id: 'synthetic-sprite-gate', about: 'Sprite gate shot', path: '/dev/fighters', mute: [], spriteGate: { snapFrames: [4, 5] } },
          {}
        );
        const gateOut = analyze(gateDir);

        // 3. Auto-enabled clipped fighter-sprite-viewport shot (no explicit spriteGate property)
        const autoDir = path.join(tmpBase, 'auto-clip');
        buildCaptureFixture(
          autoDir,
          { id: 'synthetic-auto-sprite', about: 'Auto clipped fighter shot', path: '/dev/fighters', mute: [] },
          {}
        );
        const autoOut = analyze(autoDir);

        console.log(JSON.stringify({
          nonSpriteHints: nonSpriteOut.hints,
          nonSpriteHasContinuity: Boolean(nonSpriteOut.spriteContinuity),
          spriteGateHints: gateOut.hints,
          spriteGateReport: gateOut.report,
          autoClipHints: autoOut.hints,
        }));
      `,
        { tmpBase }
      );

      // Non-sprite shot must remain 100% unaffected
      expect(res.nonSpriteHasContinuity).toBe(false);
      expect(res.nonSpriteHints.filter(h => h.code === 'SPRITE-POP')).toHaveLength(0);

      // Explicit spriteGate catches f14 pop, ignores whitelisted f4/f5, and logs into report.md
      const gatePopFrames = res.spriteGateHints.filter(h => h.code === 'SPRITE-POP').map(h => h.at);
      expect(gatePopFrames).not.toContain(4);
      expect(gatePopFrames).not.toContain(5);
      expect(gatePopFrames).toContain(14);
      expect(res.spriteGateReport).toContain('**SPRITE-POP** f14');
      expect(res.spriteGateReport).toContain('Sprite continuity');

      // Auto-enabled primary fighter-sprite-viewport clip catches f4 and f14 pops automatically
      const autoPopFrames = res.autoClipHints.filter(h => h.code === 'SPRITE-POP').map(h => h.at);
      expect(autoPopFrames).toEqual(expect.arrayContaining([4, 14]));
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('registers updated fighter-sprite-idle-loop (68f) and all 5 mandatory fighter transition shots', () => {
    const listOut = execFileSync('node', [path.join(ROOT, 'scripts/motion/capture.mjs'), '--list'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    const requiredShots = [
      'fighter-sprite-idle-loop',
      'fighter-tx-mood-tempo',
      'fighter-tx-throw-full-cycle',
      'fighter-tx-combat-interrupt',
      'fighter-tx-sleepy-wake',
      'fighter-tx-mainmenu-press',
    ];
    for (const id of requiredShots) {
      expect(listOut).toContain(id);
    }

    const specs = runNodeEsm<
      Record<
        string,
        {
          frames: number;
          spriteGate?: {
            snapFrames?: number[];
            trackViewport?: boolean;
            roiInset?: number;
            stabilizeStageShake?: boolean;
          };
          path: string;
        }
      >
    >(`
      import fighters from './scripts/motion/shots/fighters.mjs';
      const out = {};
      for (const id of [
        'fighter-sprite-idle-loop',
        'fighter-badger-jab',
        'fighter-tx-mood-tempo',
        'fighter-tx-throw-full-cycle',
        'fighter-tx-combat-interrupt',
        'fighter-tx-sleepy-wake',
        'fighter-tx-mainmenu-press',
      ]) {
        const s = fighters[id];
        out[id] = { frames: s.frames, spriteGate: s.spriteGate, path: s.path };
      }
      console.log(JSON.stringify(out));
    `);

    expect(specs['fighter-sprite-idle-loop'].frames).toBe(68);
    expect(specs['fighter-sprite-idle-loop'].spriteGate?.snapFrames).toEqual([]);

    // Badger 48ms (3f) heavy windup covers its intentional strike snap on f10
    expect(specs['fighter-badger-jab'].spriteGate?.snapFrames).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(specs['fighter-badger-jab'].spriteGate?.stabilizeStageShake).toBe(true);

    expect(specs['fighter-tx-mood-tempo'].frames).toBe(72);
    expect(specs['fighter-tx-mood-tempo'].spriteGate?.snapFrames).toEqual([]);

    expect(specs['fighter-tx-throw-full-cycle'].frames).toBe(84);
    expect(specs['fighter-tx-throw-full-cycle'].spriteGate?.snapFrames).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(specs['fighter-tx-throw-full-cycle'].spriteGate?.stabilizeStageShake).toBe(true);

    expect(specs['fighter-tx-combat-interrupt'].frames).toBe(64);
    expect(specs['fighter-tx-combat-interrupt'].spriteGate?.snapFrames?.length).toBeGreaterThan(0);

    expect(specs['fighter-tx-sleepy-wake'].frames).toBe(60);
    expect(specs['fighter-tx-sleepy-wake'].spriteGate?.snapFrames).toEqual([]);

    expect(specs['fighter-tx-mainmenu-press'].frames).toBe(72);
    expect(specs['fighter-tx-mainmenu-press'].path).toBe('/');
    expect(specs['fighter-tx-mainmenu-press'].spriteGate?.trackViewport).toBe(true);
    expect(specs['fighter-tx-mainmenu-press'].spriteGate?.roiInset).toBeGreaterThanOrEqual(4);
  });

  it('tracks moving viewport containers via trackViewport + roiInset so heroCard yellow border motion never triggers false centroid pops while real sprite teleports still fail', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-sprite-track-'));
    try {
      const res = runNodeEsm<{
        smoothPressPops: { code: string; at: number }[];
        teleportPressPops: { code: string; at: number; reason: string }[];
      }>(
        `
        import fs from 'node:fs';
        import path from 'node:path';
        import { createRequire } from 'node:module';
        import { analyze } from './scripts/motion/analyze.mjs';

        const require = createRequire(import.meta.url);
        const { PNG } = require('pngjs');
        const tmpBase = JSON.parse(process.env.MOTION_TEST_PAYLOAD).tmpBase;

        function buildMovingCardCapture(dir, injectTeleportAt) {
          const framesDir = path.join(dir, 'frames');
          fs.mkdirSync(framesDir, { recursive: true });
          const W = 120;
          const H = 96;
          const frameCount = 32;
          const trackRows = [];

          for (let f = 0; f < frameCount; f++) {
            // Simulate Main Menu PLAY press moving heroCard + mascot +5.5px right, +2.6px down at f10..f20
            const pressed = f >= 10 && f < 22;
            const shiftX = pressed ? 5.5 : 0;
            const shiftY = pressed ? 2.6 : 0;
            const vpCx = 50 + shiftX;
            const vpCy = 46 + shiftY;
            trackRows.push([f, vpCx, vpCy, 74, 74, 1, 0]);

            const cell = Math.floor(f / 4) % 8;
            const phase = (cell / 8) * Math.PI * 2;
            const teleported = injectTeleportAt != null && f >= injectTeleportAt;
            const spriteCx = vpCx + (teleported ? -12 : Math.sin(phase) * 1.4);
            const spriteCy = vpCy + Math.cos(phase) * 1.2;
            const color = teleported ? [35, 85, 200] : [228, 124, 38];

            const png = new PNG({ width: W, height: H });
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                // Yellow + black outer card border that slides into the static union ROI on press
                const cardLeft = 10 + shiftX;
                const cardTop = 6 + shiftY;
                let r = 255;
                let g = 255;
                let b = 255;
                if (x < cardLeft || y < cardTop) {
                  r = 244;
                  g = 196;
                  b = 48; // heroCard yellow border
                } else if (x < cardLeft + 3 || y < cardTop + 3) {
                  r = 18;
                  g = 18;
                  b = 18; // heroCard black ink outline
                } else if (Math.hypot(x - spriteCx, y - spriteCy) <= 18) {
                  r = color[0];
                  g = color[1];
                  b = color[2];
                }
                png.data[o] = r;
                png.data[o + 1] = g;
                png.data[o + 2] = b;
                png.data[o + 3] = 255;
              }
            }
            fs.writeFileSync(path.join(framesDir, 'f' + String(f).padStart(3, '0') + '.png'), PNG.sync.write(png));
          }

          const capture = {
            shot: {
              id: 'synthetic-moving-card',
              about: 'Moving heroCard border bleed regression test',
              path: '/',
              mute: [],
              spriteGate: { snapFrames: [], trackViewport: true, roiInset: 4 },
            },
            label: 'test',
            url: 'http://localhost:8099/',
            sha: 'testsha',
            step: 16,
            dpr: 1,
            viewport: { width: 390, height: 844 },
            clip: { x: 0, y: 0, width: W, height: H },
            size: { x: 0, y: 0, width: W, height: H },
            preroll: 0,
            ambient: 0,
            frames: frameCount,
            activity: Array.from({ length: frameCount }, (_, i) => (i === 0 ? 0 : 12)),
            boxes: Array.from({ length: frameCount }, () => [0, 0, W, H]),
            regions: { 'fighter-sprite-viewport': [13, 9, 80, 77] },
            tracks: [{ id: 1, label: 'fighter-sprite-viewport›div', first: 0, s: trackRows, last: frameCount - 1 }],
          };
          fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture));
        }

        const smoothDir = path.join(tmpBase, 'smooth-card');
        buildMovingCardCapture(smoothDir, null);
        const smoothOut = analyze(smoothDir);

        const popDir = path.join(tmpBase, 'pop-card');
        buildMovingCardCapture(popDir, 18);
        const popOut = analyze(popDir);

        console.log(JSON.stringify({
          smoothPressPops: smoothOut.hints.filter(h => h.code === 'SPRITE-POP'),
          teleportPressPops: popOut.hints.filter(h => h.code === 'SPRITE-POP'),
        }));
      `,
        { tmpBase }
      );

      expect(res.smoothPressPops).toHaveLength(0);
      expect(res.teleportPressPops.map(p => p.at)).toContain(18);
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('distinguishes smooth multi-frame eased crossfades / continuous lunges from isolated 1-frame teleports and 2-frame flickers', () => {
    const res = runNodeEsm<{
      easedCrossfadePops: { at: number }[];
      flickerPops: { at: number }[];
      isolatedTeleportPops: { at: number }[];
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 96;
      const H = 96;

      function makeBox(cx, cy, rx, ry, color) {
        const data = new Uint8Array(W * H * 4);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) {
              data[o] = color[0];
              data[o + 1] = color[1];
              data[o + 2] = color[2];
              data[o + 3] = 255;
            } else {
              data[o] = 250;
              data[o + 1] = 246;
              data[o + 2] = 238;
              data[o + 3] = 255;
            }
          }
        }
        return { width: W, height: H, data };
      }

      function blend(a, b, alpha) {
        const data = new Uint8Array(a.data.length);
        const inv = 1 - alpha;
        for (let i = 0; i < data.length; i++) data[i] = Math.round(a.data[i] * inv + b.data[i] * alpha);
        return { width: a.width, height: a.height, data };
      }

      const poseA = makeBox(48, 50, 22, 22, [225, 125, 40]);
      const poseB = makeBox(46, 54, 27, 17, [145, 75, 155]);

      // 1. Eased 4-frame EASE.state crossfade (bell-curve derivative: 0.16, 0.50, 0.84, 1.00) surrounded by quiet hold
      const easedFrames = [];
      const alphas = [0.18, 0.54, 0.86, 1.0];
      for (let f = 0; f < 36; f++) {
        if (f < 16) easedFrames.push(poseA);
        else if (f < 20) easedFrames.push(blend(poseA, poseB, alphas[f - 16]));
        else easedFrames.push(poseB);
      }

      // 2. 2-frame back-and-forth glitch (A -> B at f16, B -> A at f17): MUST still be caught!
      const flickerFrames = Array.from({ length: 36 }, (_, f) => (f === 16 ? poseB : poseA));

      // 3. Isolated 1-frame hard teleport at f16: MUST still be caught!
      const teleportFrames = Array.from({ length: 36 }, (_, f) => (f >= 16 ? poseB : poseA));

      console.log(JSON.stringify({
        easedCrossfadePops: detectSpritePops(easedFrames, { snapFrames: [] }).findings,
        flickerPops: detectSpritePops(flickerFrames, { snapFrames: [] }).findings,
        isolatedTeleportPops: detectSpritePops(teleportFrames, { snapFrames: [] }).findings,
      }));
    `);

    expect(res.easedCrossfadePops).toHaveLength(0);
    expect(res.flickerPops.map(p => p.at)).toEqual(expect.arrayContaining([16, 17]));
    expect(res.isolatedTeleportPops.map(p => p.at)).toContain(16);
  });

  it('compensates rigid battle-stage camera shake (e.g. multSlam vertical shake & header dip) without missing real sprite teleports', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-stage-shake-'));
    try {
      const res = runNodeEsm<{
        smoothShakePops: { code: string; at: number }[];
        teleportUnderShakePops: { code: string; at: number }[];
      }>(
        `
        import fs from 'node:fs';
        import path from 'node:path';
        import { createRequire } from 'node:module';
        import { analyze } from './scripts/motion/analyze.mjs';

        const require = createRequire(import.meta.url);
        const { PNG } = require('pngjs');
        const tmpBase = JSON.parse(process.env.MOTION_TEST_PAYLOAD).tmpBase;

        function buildStageShakeCapture(dir, injectTeleportAt) {
          const framesDir = path.join(dir, 'frames');
          fs.mkdirSync(framesDir, { recursive: true });
          const W = 128;
          const H = 112;
          const frameCount = 36;
          // Exact v0.1.189 multSlam-style vertical camera shake on f12..f20
          const shakeMap = { 12: 1.9, 13: 3.1, 14: 3.1, 15: -2.1, 16: -2.2, 17: 1.5, 18: 1.6, 19: -1.0, 20: -1.1 };
          const hpRows = [];

          for (let f = 0; f < frameCount; f++) {
            const camDy = shakeMap[f] ?? 0;
            // HP bar also shrinks in width from the right on f12..f18 while left edge stays pinned!
            const hpW = Math.max(40, 100 - Math.max(0, f - 11) * 6);
            const hpLeft = 20;
            hpRows.push([f, hpLeft + hpW / 2, 10 + camDy, hpW, 12, 1, 0]);

            const cell = Math.floor(f / 4) % 8;
            const phase = (cell / 8) * Math.PI * 2;
            const popped = injectTeleportAt != null && f >= injectTeleportAt;
            const figCx = 56 + (popped ? -13 : Math.sin(phase) * 1.4);
            const figCy = 62 + camDy + Math.cos(phase) * 1.2;
            const figColor = popped ? [40, 80, 210] : [228, 124, 38];

            const png = new PNG({ width: W, height: H });
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                const sy = y - camDy; // world y
                let r = 232;
                let g = 240;
                let b = 216;
                if (sy < 12) {
                  // High-contrast foe-name header bar that dips into the top of the clip during +3.1px shake
                  r = (x % 8 < 4) ? 28 : 250;
                  g = (x % 8 < 4) ? 28 : 244;
                  b = (x % 8 < 4) ? 28 : 230;
                } else if (sy > 76) {
                  // Textured grass band moving rigidly with the stage
                  r = 128 + ((x * 7) % 24);
                  g = 178 + ((Math.floor(sy) * 5) % 20);
                  b = 98;
                }
                if (Math.hypot(x - figCx, y - figCy) <= 20) {
                  r = figColor[0];
                  g = figColor[1];
                  b = figColor[2];
                }
                png.data[o] = r;
                png.data[o + 1] = g;
                png.data[o + 2] = b;
                png.data[o + 3] = 255;
              }
            }
            fs.writeFileSync(path.join(framesDir, 'f' + String(f).padStart(3, '0') + '.png'), PNG.sync.write(png));
          }

          const capture = {
            shot: {
              id: 'synthetic-stage-shake',
              about: 'Fight shot with v0.1.189 multSlam stage shake',
              path: '/dev/adventure',
              mute: [],
              spriteGate: { snapFrames: [] },
            },
            label: 'test',
            url: 'http://localhost:8099/dev/adventure',
            sha: 'testsha',
            step: 16,
            dpr: 1,
            viewport: { width: 390, height: 844 },
            clip: { x: 0, y: 17, width: W, height: H },
            size: { x: 0, y: 17, width: W, height: H },
            preroll: 0,
            ambient: 0,
            frames: frameCount,
            activity: Array.from({ length: frameCount }, (_, i) => (i === 0 ? 0 : 14)),
            boxes: Array.from({ length: frameCount }, () => [0, 0, W, H]),
            regions: {
              'run-foe-hp': [20, 4, 100, 14],
              'fighter-sprite-viewport': [0, 6, 112, 100],
            },
            tracks: [{ id: 1, label: '#run-foe-hp-trail', first: 0, s: hpRows, last: frameCount - 1 }],
          };
          fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture));
        }

        const smoothDir = path.join(tmpBase, 'smooth-shake');
        buildStageShakeCapture(smoothDir, null);
        const smoothOut = analyze(smoothDir);

        const popDir = path.join(tmpBase, 'pop-shake');
        buildStageShakeCapture(popDir, 26);
        const popOut = analyze(popDir);

        console.log(JSON.stringify({
          smoothShakePops: smoothOut.hints.filter(h => h.code === 'SPRITE-POP'),
          teleportUnderShakePops: popOut.hints.filter(h => h.code === 'SPRITE-POP'),
        }));
      `,
        { tmpBase }
      );

      expect(res.smoothShakePops).toHaveLength(0);
      expect(res.teleportUnderShakePops.map(p => p.at)).toContain(26);
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('recognizes regular periodic 16fps cadence trains under 60Hz overlay FX while still catching violent outlier whips and isolated teleports', () => {
    const res = runNodeEsm<{
      smoothCadencePops: { at: number }[];
      violentWhipPops: { at: number; l1: number }[];
      isolatedPopPops: { at: number }[];
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 64;
      const H = 64;

      function makeCheerFrame({ poseStep, heartY, whip = false, isolatedPop = false }) {
        const data = new Uint8Array(W * H * 4);
        // Smooth 16fps cheer poses: gentle consistent cyclic squash/hop with bounded centroid shift (~10-12 L1)
        const hopAngle = (poseStep / 6) * Math.PI * 2;
        const bodyRx = whip ? 28 : isolatedPop ? 26 : 18 + Math.sin(hopAngle) * 3.0;
        const bodyRy = whip ? 29 : isolatedPop ? 10 : 18 - Math.sin(hopAngle) * 3.0;
        const bodyCy = whip ? 30 : 34 - Math.abs(Math.sin(hopAngle)) * 2.5;
        const stripeShift = poseStep * 5;
        const color = whip ? [15, 30, 175] : isolatedPop ? [20, 170, 90] : [225, 115, 35];

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            let r = 255;
            let g = 255;
            let b = 255;
            const dx = (x - 32) / bodyRx;
            const dy = (y - bodyCy) / bodyRy;
            if (dx * dx + dy * dy <= 1) {
              const band = ((x + y + stripeShift) % 12) < 5 ? 65 : 0;
              r = Math.max(0, color[0] - band);
              g = Math.max(0, color[1] - band);
              b = Math.max(0, color[2] - band);
            }
            // Continuous 60Hz floating pet-heart overlay creating ~2.5 L1 on every held frame
            if (Math.hypot(x - 52, y - heartY) <= 5) {
              r = 235;
              g = 60;
              b = 110;
            }
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = b;
            data[o + 3] = 255;
          }
        }
        return { width: W, height: H, data };
      }

      // 1. Consistent 16fps cheer cadence (6 ticks spaced 4f apart) + 60Hz pet heart moving every frame,
      //    plus a rising shoulder overlap at f7 right before the f8 cadence tick (mimicking optb3 f49 -> f50)
      const smoothFrames = [];
      for (let f = 0; f < 32; f++) {
        const poseStep = f === 7 ? 1.45 : Math.floor(f / 4);
        smoothFrames.push(makeCheerFrame({ poseStep, heartY: 56 - f * 1.4 }));
      }

      // 2. Same 16fps cadence, but f16 whips violently into an extreme narrow vertical blue silhouette
      const whipFrames = [];
      for (let f = 0; f < 32; f++) {
        whipFrames.push(makeCheerFrame({ poseStep: Math.floor(f / 4), heartY: 56 - f * 1.4, whip: f >= 16 && f < 20 }));
      }

      // 3. Static hold with 60Hz pet heart + ONE isolated 1-frame teleport at f16 (not a periodic train!)
      const isolatedFrames = [];
      for (let f = 0; f < 32; f++) {
        isolatedFrames.push(makeCheerFrame({ poseStep: 0, heartY: 56 - f * 1.4, isolatedPop: f >= 16 }));
      }

      console.log(JSON.stringify({
        smoothCadencePops: detectSpritePops(smoothFrames, { snapFrames: [] }).findings,
        violentWhipPops: detectSpritePops(whipFrames, { snapFrames: [] }).findings,
        isolatedPopPops: detectSpritePops(isolatedFrames, { snapFrames: [] }).findings,
      }));
    `);

    expect(res.smoothCadencePops).toHaveLength(0);
    expect(res.violentWhipPops.map(p => p.at)).toContain(16);
    expect(res.isolatedPopPops.map(p => p.at)).toContain(16);
  });

  it('auto-activates on enemy-sprite-viewport, honors explicit spriteGate.viewportKey when both viewports exist, and leaves non-sprite shots untouched', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-enemy-sprite-pop-'));
    try {
      const res = runNodeEsm<{
        autoConfig: { auto: boolean; viewportKey: string } | null;
        nonSpriteConfig: unknown;
        autoEnemyPops: { code: string; at: number; who: string }[];
        autoEnemyReport: string;
        explicitEnemyPops: { code: string; at: number; who: string }[];
        explicitEnemyWho: string;
        nonSpriteHasContinuity: boolean;
        nonSpritePopCount: number;
      }>(
        `
        import fs from 'node:fs';
        import path from 'node:path';
        import { createRequire } from 'node:module';
        import { analyze, resolveSpriteGateConfig } from './scripts/motion/analyze.mjs';

        const require = createRequire(import.meta.url);
        const { PNG } = require('pngjs');
        const tmpBase = JSON.parse(process.env.MOTION_TEST_PAYLOAD).tmpBase;

        function writePng(file, width, height, draw) {
          const png = new PNG({ width, height });
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const o = (y * width + x) * 4;
              const [r, g, b, a] = draw(x, y);
              png.data[o] = r;
              png.data[o + 1] = g;
              png.data[o + 2] = b;
              png.data[o + 3] = a;
            }
          }
          fs.writeFileSync(file, PNG.sync.write(png));
        }

        function buildEnemyFixture(dir, { shotConfig, width = 96, height = 96, regions, clip, duelLayout = false }) {
          const framesDir = path.join(dir, 'frames');
          fs.mkdirSync(framesDir, { recursive: true });
          const frameCount = 24;
          for (let f = 0; f < frameCount; f++) {
            const enemySnapped = f === 4;
            const enemyPopped = f >= 14;
            const fighterDecoyPop = duelLayout && f >= 10;
            writePng(path.join(framesDir, 'f' + String(f).padStart(3, '0') + '.png'), width, height, (x, y) => {
              if (duelLayout) {
                // Left half [0..96): fighter-sprite-viewport with decoy pop at f10
                if (x < 96) {
                  const fcx = fighterDecoyPop ? 32 : 50 + (f % 4 === 0 ? 1 : 0);
                  const fcol = fighterDecoyPop ? [210, 45, 45] : [225, 130, 40];
                  if (Math.hypot(x - fcx, y - 48) <= 18) return [fcol[0], fcol[1], fcol[2], 255];
                  return [255, 255, 255, 255];
                }
                // Right half [96..192): enemy-sprite-viewport with whitelisted snap at f4 and real pop at f14
                const ecx = 96 + (enemySnapped ? 66 : enemyPopped ? 32 : 50 + (f % 4 === 0 ? 1 : 0));
                const ecol = enemySnapped ? [40, 70, 220] : enemyPopped ? [30, 150, 90] : [135, 70, 190];
                if (Math.hypot(x - ecx, y - 48) <= 18) return [ecol[0], ecol[1], ecol[2], 255];
                return [255, 255, 255, 255];
              }
              const cx = enemySnapped ? 66 : enemyPopped ? 34 : 50 + (f % 4 === 0 ? 1 : 0);
              const col = enemySnapped ? [40, 70, 220] : enemyPopped ? [30, 150, 90] : [135, 70, 190];
              if (Math.hypot(x - cx, y - 48) <= 18) return [col[0], col[1], col[2], 255];
              return [255, 255, 255, 255];
            });
          }
          const capture = {
            shot: shotConfig,
            label: 'test',
            url: 'http://localhost:8099/dev/fighters',
            sha: 'testsha',
            step: 16,
            dpr: 1,
            viewport: { width: 390, height: 844 },
            clip: clip === undefined ? { x: 0, y: 0, width, height } : clip,
            size: { x: 0, y: 0, width, height },
            preroll: 0,
            ambient: 0,
            frames: frameCount,
            activity: Array.from({ length: frameCount }, (_, i) => (i === 0 ? 0 : 10)),
            boxes: Array.from({ length: frameCount }, () => [0, 0, width, height]),
            regions,
            tracks: [],
          };
          fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture));
          return capture;
        }

        // 1. Auto-enabled clipped enemy-sprite-viewport shot (no explicit spriteGate)
        const autoDir = path.join(tmpBase, 'auto-enemy');
        const autoCapture = buildEnemyFixture(autoDir, {
          shotConfig: { id: 'synthetic-auto-enemy', about: 'Auto clipped enemy shot', path: '/dev/fighters', mute: [] },
          regions: { 'enemy-sprite-viewport': [0, 0, 96, 96] },
        });
        const autoConfig = resolveSpriteGateConfig(autoCapture);
        const autoOut = analyze(autoDir);

        // 2. Explicit viewportKey: 'enemy-sprite-viewport' when BOTH viewports appear in capture.regions
        const explicitDir = path.join(tmpBase, 'explicit-enemy');
        buildEnemyFixture(explicitDir, {
          shotConfig: {
            id: 'synthetic-explicit-enemy',
            about: 'Explicit enemy viewportKey prefers enemy over fighter',
            path: '/dev/adventure',
            mute: [],
            spriteGate: { viewportKey: 'enemy-sprite-viewport', snapFrames: [4, 5] },
          },
          width: 192,
          height: 96,
          duelLayout: true,
          regions: {
            'fighter-sprite-viewport': [0, 0, 96, 96],
            'enemy-sprite-viewport': [96, 0, 96, 96],
          },
        });
        const explicitOut = analyze(explicitDir);

        // 3. Full-screen non-sprite shot (clip: null) containing enemy-sprite-viewport: untouched
        const nonSpriteDir = path.join(tmpBase, 'non-sprite-enemy');
        const nonSpriteCapture = buildEnemyFixture(nonSpriteDir, {
          shotConfig: { id: 'synthetic-fullscreen-enemy', about: 'Full screen shot with enemy', path: '/', mute: [] },
          clip: null,
          regions: { 'enemy-sprite-viewport': [280, 64, 48, 48] },
        });
        const nonSpriteConfig = resolveSpriteGateConfig(nonSpriteCapture);
        const nonSpriteOut = analyze(nonSpriteDir);

        console.log(JSON.stringify({
          autoConfig,
          nonSpriteConfig,
          autoEnemyPops: autoOut.hints.filter(h => h.code === 'SPRITE-POP'),
          autoEnemyReport: autoOut.report,
          explicitEnemyPops: explicitOut.hints.filter(h => h.code === 'SPRITE-POP'),
          explicitEnemyWho: explicitOut.spriteContinuity?.summary?.who ?? '',
          nonSpriteHasContinuity: Boolean(nonSpriteOut.spriteContinuity),
          nonSpritePopCount: nonSpriteOut.hints.filter(h => h.code === 'SPRITE-POP').length,
        }));
      `,
        { tmpBase }
      );

      expect(res.autoConfig).toEqual({ auto: true, viewportKey: 'enemy-sprite-viewport' });
      expect(res.autoEnemyPops.map(p => p.at)).toEqual(expect.arrayContaining([4, 14]));
      expect(res.autoEnemyPops.every(p => p.who === 'enemy-sprite-viewport')).toBe(true);
      expect(res.autoEnemyReport).toContain('Sprite continuity (enemy-sprite-viewport');

      // Explicit viewportKey inspects ONLY enemy-sprite-viewport (ignores fighter f10 decoy and whitelisted f4/f5, catches enemy f14)
      expect(res.explicitEnemyWho).toBe('enemy-sprite-viewport');
      const explicitFrames = res.explicitEnemyPops.map(p => p.at);
      expect(explicitFrames).toContain(14);
      expect(explicitFrames).not.toContain(4);
      expect(explicitFrames).not.toContain(5);
      expect(explicitFrames).not.toContain(10);

      expect(res.nonSpriteConfig).toBeNull();
      expect(res.nonSpriteHasContinuity).toBe(false);
      expect(res.nonSpritePopCount).toBe(0);
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('tracks moving enemy-sprite-viewport containers via trackViewport + roiInset (including track-only lookup without regions) while catching internal teleports', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-enemy-track-'));
    try {
      const res = runNodeEsm<{
        smoothPops: { code: string; at: number }[];
        smoothWho: string;
        teleportPops: { code: string; at: number; who: string }[];
        trackOnlySmoothPops: { code: string; at: number }[];
        trackOnlyWho: string;
      }>(
        `
        import fs from 'node:fs';
        import path from 'node:path';
        import { createRequire } from 'node:module';
        import { analyze } from './scripts/motion/analyze.mjs';

        const require = createRequire(import.meta.url);
        const { PNG } = require('pngjs');
        const tmpBase = JSON.parse(process.env.MOTION_TEST_PAYLOAD).tmpBase;

        function buildMovingEnemyCapture(dir, { injectTeleportAt = null, includeRegion = true, trackLabel = 'enemy-sprite-viewport›div' }) {
          const framesDir = path.join(dir, 'frames');
          fs.mkdirSync(framesDir, { recursive: true });
          const W = 120;
          const H = 96;
          const frameCount = 32;
          const trackRows = [];

          for (let f = 0; f < frameCount; f++) {
            const shifted = f >= 10 && f < 22;
            const shiftX = shifted ? -6.0 : 0;
            const shiftY = shifted ? 2.5 : 0;
            const vpCx = 62 + shiftX;
            const vpCy = 46 + shiftY;
            trackRows.push([f, vpCx, vpCy, 74, 74, 1, 0]);

            const cell = Math.floor(f / 4) % 8;
            const phase = (cell / 8) * Math.PI * 2;
            const teleported = injectTeleportAt != null && f >= injectTeleportAt;
            const spriteCx = vpCx + (teleported ? 12 : Math.sin(phase) * 1.4);
            const spriteCy = vpCy + Math.cos(phase) * 1.2;
            const color = teleported ? [35, 165, 95] : [132, 68, 185];

            const png = new PNG({ width: W, height: H });
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                const cardRight = 102 + shiftX;
                const cardTop = 6 + shiftY;
                let r = 255;
                let g = 255;
                let b = 255;
                if (x > cardRight || y < cardTop) {
                  r = 124;
                  g = 58;
                  b = 237; // boss card outer accent border
                } else if (x > cardRight - 3 || y < cardTop + 3) {
                  r = 22;
                  g = 22;
                  b = 22; // ink outline
                } else if (Math.hypot(x - spriteCx, y - spriteCy) <= 18) {
                  r = color[0];
                  g = color[1];
                  b = color[2];
                }
                png.data[o] = r;
                png.data[o + 1] = g;
                png.data[o + 2] = b;
                png.data[o + 3] = 255;
              }
            }
            fs.writeFileSync(path.join(framesDir, 'f' + String(f).padStart(3, '0') + '.png'), PNG.sync.write(png));
          }

          const capture = {
            shot: {
              id: 'synthetic-moving-enemy-card',
              about: 'Moving enemy viewport stabilization regression test',
              path: '/dev/fighters',
              mute: [],
              spriteGate: { viewportKey: 'enemy-sprite-viewport', snapFrames: [], trackViewport: true, roiInset: 4 },
            },
            label: 'test',
            url: 'http://localhost:8099/dev/fighters',
            sha: 'testsha',
            step: 16,
            dpr: 1,
            viewport: { width: 390, height: 844 },
            clip: { x: 0, y: 0, width: W, height: H },
            size: { x: 0, y: 0, width: W, height: H },
            preroll: 0,
            ambient: 0,
            frames: frameCount,
            activity: Array.from({ length: frameCount }, (_, i) => (i === 0 ? 0 : 12)),
            boxes: Array.from({ length: frameCount }, () => [0, 0, W, H]),
            regions: includeRegion ? { 'enemy-sprite-viewport': [19, 9, 80, 77] } : {},
            tracks: [{ id: 1, label: trackLabel, first: 0, s: trackRows, last: frameCount - 1 }],
          };
          fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture));
        }

        const smoothDir = path.join(tmpBase, 'smooth-enemy-card');
        buildMovingEnemyCapture(smoothDir, {});
        const smoothOut = analyze(smoothDir);

        const popDir = path.join(tmpBase, 'pop-enemy-card');
        buildMovingEnemyCapture(popDir, { injectTeleportAt: 18 });
        const popOut = analyze(popDir);

        const trackOnlyDir = path.join(tmpBase, 'track-only-enemy-card');
        buildMovingEnemyCapture(trackOnlyDir, { includeRegion: false, trackLabel: '#adventure-run-enemy' });
        const trackOnlyOut = analyze(trackOnlyDir);

        console.log(JSON.stringify({
          smoothPops: smoothOut.hints.filter(h => h.code === 'SPRITE-POP'),
          smoothWho: smoothOut.spriteContinuity?.summary?.who ?? '',
          teleportPops: popOut.hints.filter(h => h.code === 'SPRITE-POP'),
          trackOnlySmoothPops: trackOnlyOut.hints.filter(h => h.code === 'SPRITE-POP'),
          trackOnlyWho: trackOnlyOut.spriteContinuity?.summary?.who ?? '',
        }));
      `,
        { tmpBase }
      );

      expect(res.smoothPops).toHaveLength(0);
      expect(res.smoothWho).toBe('enemy-sprite-viewport');
      expect(res.teleportPops.map(p => p.at)).toContain(18);
      expect(res.teleportPops[0]?.who).toBe('enemy-sprite-viewport');
      expect(res.trackOnlySmoothPops).toHaveLength(0);
      expect(res.trackOnlyWho).toBe('enemy-sprite-viewport');
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('registers all 5 Wave 1 enemy sprite transition shots with enemy-sprite-viewport spriteGate configs', () => {
    const listOut = execFileSync('node', [path.join(ROOT, 'scripts/motion/capture.mjs'), '--list'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    const requiredEnemyShots = [
      'enemy-sprite-idle-loop',
      'enemy-tx-boss-attack',
      'enemy-tx-hit-recoil',
      'enemy-tx-sleepy-wake',
      'enemy-tx-taunt-mood',
    ];
    for (const id of requiredEnemyShots) {
      expect(listOut).toContain(id);
    }

    const specs = runNodeEsm<
      Record<
        string,
        {
          id: string;
          frames: number;
          path: string;
          actionFrames: number[];
          spriteGate?: {
            viewportKey?: string;
            snapFrames?: number[];
            stabilizeStageShake?: boolean;
          };
        }
      >
    >(`
      import enemies from './scripts/motion/shots/enemies.mjs';
      const out = {};
      for (const id of [
        'enemy-sprite-idle-loop',
        'enemy-tx-boss-attack',
        'enemy-tx-hit-recoil',
        'enemy-tx-sleepy-wake',
        'enemy-tx-taunt-mood',
      ]) {
        const s = enemies[id];
        out[id] = {
          id: s.id,
          frames: s.frames,
          path: s.path,
          actionFrames: Array.isArray(s.actions) ? s.actions.map(a => a.at) : [],
          spriteGate: s.spriteGate,
        };
      }
      console.log(JSON.stringify(out));
    `);

    expect(specs['enemy-sprite-idle-loop'].frames).toBe(68);
    expect(specs['enemy-sprite-idle-loop'].path).toBe('/dev/fighters');
    expect(specs['enemy-sprite-idle-loop'].spriteGate).toEqual({
      viewportKey: 'enemy-sprite-viewport',
      snapFrames: [],
    });

    expect(specs['enemy-tx-boss-attack'].frames).toBe(84);
    expect(specs['enemy-tx-boss-attack'].path).toBe('/dev/fighters');
    expect(specs['enemy-tx-boss-attack'].spriteGate?.viewportKey).toBe('enemy-sprite-viewport');
    // Boss strikeStartMs = 192ms (+1f commit -> f13) + 2nd slash arc (f17) covered while windup & recovery stay gated
    expect(specs['enemy-tx-boss-attack'].spriteGate?.snapFrames).toEqual(expect.arrayContaining([12, 17]));
    expect(Math.max(...(specs['enemy-tx-boss-attack'].spriteGate?.snapFrames ?? []))).toBeLessThan(20);

    expect(specs['enemy-tx-hit-recoil'].frames).toBe(84);
    expect(specs['enemy-tx-hit-recoil'].path).toContain('/dev/adventure');
    expect(specs['enemy-tx-hit-recoil'].path).toContain('level=1-3');
    expect(specs['enemy-tx-hit-recoil'].spriteGate?.viewportKey).toBe('enemy-sprite-viewport');
    expect(specs['enemy-tx-hit-recoil'].spriteGate?.stabilizeStageShake).toBe(true);
    expect(specs['enemy-tx-hit-recoil'].spriteGate?.snapFrames).toEqual(
      expect.arrayContaining([5, 20, 21])
    );
    expect(specs['enemy-tx-hit-recoil'].spriteGate?.snapFrames).not.toContain(10);
    expect(Math.max(...(specs['enemy-tx-hit-recoil'].spriteGate?.snapFrames ?? []))).toBeLessThan(27);

    expect(specs['enemy-tx-sleepy-wake'].frames).toBe(64);
    expect(specs['enemy-tx-sleepy-wake'].path).toBe('/dev/fighters');
    expect(specs['enemy-tx-sleepy-wake'].spriteGate).toEqual({
      viewportKey: 'enemy-sprite-viewport',
      snapFrames: [],
    });
    expect(specs['enemy-tx-sleepy-wake'].actionFrames).toHaveLength(2);

    expect(specs['enemy-tx-taunt-mood'].frames).toBe(72);
    expect(specs['enemy-tx-taunt-mood'].path).toBe('/dev/fighters');
    expect(specs['enemy-tx-taunt-mood'].spriteGate).toEqual({
      viewportKey: 'enemy-sprite-viewport',
      snapFrames: [],
    });
    expect(specs['enemy-tx-taunt-mood'].actionFrames).toHaveLength(4);
  });

  it('locks foreground centroid background mode across the sequence so borderline border uniformity never fabricates a mid-shot centroid jump', () => {
    const res = runNodeEsm<{
      stablePops: { at: number; reason: string; centroidShiftPx: number }[];
      stableMaxShiftPx: number;
      teleportPops: { at: number; reason: string; centroidShiftPx: number }[];
    }>(`
      import { detectSpritePops } from './scripts/motion/analyze.mjs';

      const W = 100;
      const H = 100;

      // Reproduces the exact enemy-tx-hit-recoil/w1r2 f47->f48 edge case:
      // right+bottom borders hold white outer page margin (~53% of border on f0..f15),
      // then a tiny 1px right-border shift on f16..f31 drops white border share to ~28%
      // while the sprite itself stays completely stationary over banded meadow backdrop.
      function makeBorderlineStageFrame({ rightEdgeIsWhite, spriteShiftX = 0, idleBob = 0 }) {
        const data = new Uint8Array(W * H * 4);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4;
            let r;
            let g;
            let b;
            if (y >= H - 2) {
              // Bottom page margin: always white
              r = 255; g = 255; b = 255;
            } else if (x >= W - 2 && rightEdgeIsWhite) {
              // Right page margin sliver: white on f0..f15, nudged off white on f16..f31
              r = 255; g = 255; b = 255;
            } else if (x < 6 && y < 12 && rightEdgeIsWhite) {
              r = 255; g = 255; b = 255;
            } else if (y < 60) {
              // Pale meadow sky band
              r = 228; g = 236; b = 214;
            } else {
              // Darker meadow grass band
              r = 122; g = 166; b = 96;
            }
            // Centered green sprite (stationary except tiny idle bob or injected teleport)
            const sx = 64 + spriteShiftX;
            const sy = 56 + idleBob;
            if (Math.hypot(x - sx, y - sy) <= 18) {
              r = 38; g = 132; b = 52;
            }
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = b;
            data[o + 3] = 255;
          }
        }
        return { width: W, height: H, data };
      }

      const stableFrames = [];
      const teleportFrames = [];
      for (let f = 0; f < 32; f++) {
        const rightEdgeIsWhite = f < 16;
        const idleBob = (Math.floor(f / 4) % 2) * 0.8;
        stableFrames.push(makeBorderlineStageFrame({ rightEdgeIsWhite, idleBob }));
        teleportFrames.push(makeBorderlineStageFrame({
          rightEdgeIsWhite,
          idleBob,
          spriteShiftX: f >= 22 ? -18 : 0,
        }));
      }

      const stable = detectSpritePops(stableFrames, { snapFrames: [] });
      const teleport = detectSpritePops(teleportFrames, { snapFrames: [] });
      console.log(JSON.stringify({
        stablePops: stable.findings,
        stableMaxShiftPx: stable.summary.maxCentroidShiftPx,
        teleportPops: teleport.findings,
      }));
    `);

    expect(res.stablePops).toHaveLength(0);
    expect(res.stableMaxShiftPx).toBeLessThan(3);
    expect(res.teleportPops.map(p => p.at)).toContain(22);
  });
});
