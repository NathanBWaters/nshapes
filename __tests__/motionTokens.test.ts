/**
 * The motion tokens (src/utils/motion.ts) say what they promise: each spring
 * bounces as much as its name claims, exits are shorter than entrances, a
 * stagger never runs long, and the skill that explains them is where the
 * agents look for it.
 */
import fs from 'fs';
import path from 'path';
import {
  BLINK,
  CHEER,
  CREATURE_ACTING,
  ENEMY_ATTACK,
  ENEMY_REGEN,
  FOE_ATTACK,
  FOE_REGEN,
  HIT,
  MS,
  SCALE,
  SHAKE,
  SPRING,
  SQUASH,
  STAGGER,
  THROW,
  cascadeDelay,
  dampingRatio,
  exitMs,
  geometricShake,
  geometricShakeKeyframes,
  hitstopHoldMs,
  staggerDelay,
  textHoldMs,
  travelMs,
  viewportShakeScale,
} from '@/utils/motion';

const ROOT = path.resolve(__dirname, '..');

describe('motion tokens', () => {
  it('springs bounce as much as their names say (read by damping ratio)', () => {
    const ratio = (name: keyof typeof SPRING) => dampingRatio(SPRING[name]);
    // 1.0 never bounces · 0.7–0.85 crisp · 0.4–0.6 playful · under 0.3 a cartoon
    expect(ratio('snappy')).toBeGreaterThan(0.75);
    expect(ratio('snappy')).toBeLessThan(0.9);
    expect(ratio('settle')).toBeGreaterThanOrEqual(0.98);
    expect(ratio('heavy')).toBeGreaterThanOrEqual(1);
    expect(ratio('lively')).toBeGreaterThan(0.55);
    expect(ratio('lively')).toBeLessThan(0.7);
    expect(ratio('playful')).toBeGreaterThan(0.4);
    expect(ratio('playful')).toBeLessThan(0.55);
    expect(ratio('loose')).toBeGreaterThan(0.25);
    expect(ratio('loose')).toBeLessThan(0.4);
  });

  it('no spring bounces so much that it reads as broken', () => {
    // Overshoot of an under-damped spring: exp(-ζπ / √(1-ζ²)). Over 40% is a cartoon nobody asked for.
    for (const spec of Object.values(SPRING)) {
      const z = dampingRatio(spec);
      const overshoot = z >= 1 ? 0 : Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z));
      expect(overshoot).toBeLessThan(0.4);
    }
  });

  it('durations grow with what is moving, and the answer to a touch is within 150 ms', () => {
    expect(MS.feedback).toBeLessThanOrEqual(150);
    expect(MS.feedback).toBeLessThan(MS.quick);
    expect(MS.quick).toBeLessThan(MS.move);
    expect(MS.move).toBeLessThan(MS.panel);
    expect(MS.panel).toBeLessThan(MS.hero);
    expect(MS.hero).toBeLessThanOrEqual(900);
  });

  it('an exit is shorter than its entrance', () => {
    for (const ms of Object.values(MS)) {
      expect(exitMs(ms)).toBeLessThan(ms);
      expect(exitMs(ms)).toBeGreaterThanOrEqual(ms * 0.5);
    }
  });

  it('a longer trip takes longer, but never more than twice as long', () => {
    expect(travelMs(280, 100)).toBe(280);
    expect(travelMs(280, 200)).toBeGreaterThan(travelMs(280, 100));
    expect(travelMs(280, 400)).toBeGreaterThan(travelMs(280, 200));
    expect(travelMs(280, 5000)).toBeLessThanOrEqual(560);
    expect(travelMs(280, 10)).toBeLessThan(280);
  });

  it('a stagger never takes longer than its cap, however long the list', () => {
    expect(staggerDelay(0, 5)).toBe(0);
    expect(staggerDelay(4, 5)).toBe(4 * STAGGER.item);
    expect(staggerDelay(39, 40)).toBeLessThanOrEqual(STAGGER.cap);
    expect(staggerDelay(39, 40)).toBeGreaterThan(staggerDelay(20, 40));
  });

  it('a cascade gathers pace and stays inside the cap', () => {
    const gaps = [1, 2, 3, 4, 5].map(i => cascadeDelay(i) - cascadeDelay(i - 1));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1]);
    expect(cascadeDelay(60)).toBeLessThanOrEqual(STAGGER.cap);
  });

  it('squash and stretch keep the volume', () => {
    expect(SQUASH.squash.x * SQUASH.squash.y).toBeCloseTo(1, 0);
    expect(SQUASH.stretch.x * SQUASH.stretch.y).toBeCloseTo(1, 0);
    expect(SCALE.press).toBeLessThan(1);
    expect(SCALE.pop).toBeGreaterThan(1);
    expect(SCALE.pop).toBeLessThanOrEqual(1.1);
  });

  it('a line of text is held long enough to read', () => {
    expect(textHoldMs(1)).toBe(800);
    expect(textHoldMs(2)).toBe(1100);
    expect(textHoldMs(6)).toBe(2300);
  });

  it('scales hitstop cleanly across damage tiers, move multipliers, and 2f chain caps ([FX-02], [FX-06])', () => {
    expect(HIT.tierHoldMs).toEqual([48, 64, 96, 136]);
    expect(HIT.chainHoldMs).toBe(32);
    expect(HIT.vibStepMs).toBe(16);
    expect(HIT.vibDecay).toBe(0.7);
    expect(HIT.attackerRecoilRatio).toBeGreaterThan(0);

    // Tier baseline holds (3f / 4f / 6f / 8.5f)
    expect(hitstopHoldMs(0)).toBe(48);
    expect(hitstopHoldMs(1)).toBe(64);
    expect(hitstopHoldMs(2)).toBe(96);
    expect(hitstopHoldMs(3)).toBe(136);

    // Move multipliers scale smoothly and respect the ~9f maxHoldMs ceiling
    expect(hitstopHoldMs(0, 'blast')).toBe(60);
    expect(hitstopHoldMs(1, 'perfect_parry')).toBe(86);
    expect(hitstopHoldMs(3, 'perfect_parry')).toBe(HIT.maxHoldMs);
    expect(hitstopHoldMs(2, 'laser')).toBeLessThan(hitstopHoldMs(2, 'blast'));

    // Rapid chained hits cap at 2 frames regardless of tier or move multiplier
    expect(hitstopHoldMs(3, 'perfect_parry', 1)).toBe(32);
    expect(hitstopHoldMs(2, 'blast', 2)).toBe(32);

    // Defender micro-vibration scales monotonically with tier
    for (let i = 1; i < HIT.defenderVibTierScale.length; i++) {
      expect(HIT.defenderVibTierScale[i]).toBeGreaterThan(HIT.defenderVibTierScale[i - 1]);
    }
  });

  it('produces deterministic monotonic ×0.7 geometric-decay shake keyframes and viewport scaling ([FX-05])', () => {
    const first = geometricShakeKeyframes(10, 5, SHAKE.decay, -1);
    const second = geometricShake(10, 5, SHAKE.decay, -1);
    expect(first).toEqual(second);
    expect(first).toEqual([-10, 7, -4.9, 3.43, -2.401, 0]);
    expect(first[first.length - 1]).toBe(0);

    // Alternating signs and strictly monotonic decaying magnitudes
    for (let i = 1; i < first.length - 1; i++) {
      expect(Math.sign(first[i])).toBe(-Math.sign(first[i - 1]));
      expect(Math.abs(first[i])).toBeLessThan(Math.abs(first[i - 1]));
      expect(Math.abs(first[i]) / Math.abs(first[i - 1])).toBeCloseTo(SHAKE.decay, 3);
    }

    // Edge cases
    expect(geometricShakeKeyframes(0, 4)).toEqual([0]);
    expect(geometricShakeKeyframes(8, 0)).toEqual([0]);
    expect(geometricShakeKeyframes(8, 2, 0.7, 1)).toEqual([8, -5.6, 0]);

    // Viewport-distance scaling clamps cleanly to [0.75, 1.5]
    expect(viewportShakeScale(375)).toBe(1);
    expect(viewportShakeScale(200)).toBe(0.75);
    expect(viewportShakeScale(1200)).toBe(1.5);
  });

  it('defines crisp THROW, ENEMY_ATTACK, ENEMY_REGEN, BLINK, and CREATURE_ACTING tokens ([FX-09], [FX-10], [FX-12])', () => {
    // [FX-09] Fighter Set-launch throw: fast 2f wind + 2f lunge + lingering follow-through
    expect(THROW.windMs).toBe(32);
    expect(THROW.lungeMs).toBe(32);
    expect(THROW.holdMs).toBe(96);
    expect(THROW.windTxRatio).toBeLessThan(0);
    expect(THROW.lungeTxRatio).toBeGreaterThan(0);
    expect(THROW.windMs + THROW.lungeMs).toBeLessThanOrEqual(THROW.expressionHoldMs / 3);

    // [FX-10] Enemy attack snap anticipation -> coil hold -> 2f strike -> apex hold
    expect(FOE_ATTACK).toBe(ENEMY_ATTACK);
    expect(FOE_REGEN).toBe(ENEMY_REGEN);
    expect(ENEMY_ATTACK.windMs).toBe(32);
    expect(ENEMY_ATTACK.coilHoldMs).toBe(64);
    expect(ENEMY_ATTACK.strikeMs).toBe(32);
    expect(ENEMY_ATTACK.apexHoldMs).toBe(48);
    expect(ENEMY_ATTACK.windTxMult).toBeGreaterThan(0);
    expect(ENEMY_ATTACK.strikeTxMult).toBeLessThan(0);
    expect(ENEMY_REGEN.dipMs).toBe(48);
    expect(ENEMY_REGEN.dipScaleY).toBeLessThan(1);
    expect(ENEMY_REGEN.swellScaleY).toBeGreaterThan(1);

    // [FX-12] Smooth 3-step blink & compact acting tokens
    expect(BLINK.closeMs).toBe(32);
    expect(BLINK.holdMs).toBe(48);
    expect(BLINK.openMs).toBe(48);
    expect(CREATURE_ACTING.compactSizePx).toBe(52);
    expect(CREATURE_ACTING.compactRotateBoost).toBeGreaterThan(1);
    expect(CREATURE_ACTING.fighterCombatGazeX).toBeGreaterThan(0);
    expect(CREATURE_ACTING.enemyCombatGazeX).toBeLessThan(0);
    expect(HIT.painHoldMs).toBe(540);
    expect(CHEER.releaseMs).toBe(240);
  });
});

describe('motion skills', () => {
  const skills = ['motion-loop', 'motion-sweep'];

  it.each(skills)('%s has a SKILL.md with a name and a "Use when" description', name => {
    const file = path.join(ROOT, '.agents', 'skills', name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    const front = text.match(/^---\n([\s\S]*?)\n---/);
    expect(front).not.toBeNull();
    expect(front![1]).toContain(`name: ${name}`);
    expect(front![1]).toMatch(/description: Use when /);
    expect(front![1].length).toBeLessThan(1024);
  });

  it.each(skills)('%s is reachable by Claude Code through .claude/skills', name => {
    // Claude Code looks in .claude/skills; every other agent looks in .agents/skills. One copy, linked.
    const linked = path.join(ROOT, '.claude', 'skills', name, 'SKILL.md');
    expect(fs.existsSync(linked)).toBe(true);
    expect(fs.realpathSync(linked)).toBe(fs.realpathSync(path.join(ROOT, '.agents', 'skills', name, 'SKILL.md')));
  });

  it('every file a skill links to exists', () => {
    for (const name of skills) {
      const dir = path.join(ROOT, '.agents', 'skills', name);
      const files = [path.join(dir, 'SKILL.md'), ...(fs.existsSync(path.join(dir, 'references')) ? fs.readdirSync(path.join(dir, 'references')).map(f => path.join(dir, 'references', f)) : [])];
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/\]\(((?!https?:)[^)#]+\.md)\)/g)) {
          expect({ from: path.relative(ROOT, file), link: m[1], exists: fs.existsSync(path.resolve(path.dirname(file), m[1])) }).toEqual({ from: path.relative(ROOT, file), link: m[1], exists: true });
        }
      }
    }
  });

  it('the commands the skill tells agents to run exist', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    for (const script of ['motion:shots', 'motion:capture', 'motion:sheet', 'motion:analyze', 'motion:flipbook']) expect(pkg.scripts[script]).toBeTruthy();
    for (const tool of ['capture.mjs', 'sheet.mjs', 'analyze.mjs', 'flipbook.mjs', 'shots.mjs', 'shot-kit.mjs', 'lib.mjs']) expect(fs.existsSync(path.join(ROOT, 'scripts', 'motion', tool))).toBe(true);
  });
});
