/**
 * The motion tokens (src/utils/motion.ts) say what they promise: each spring
 * bounces as much as its name claims, exits are shorter than entrances, a
 * stagger never runs long, and the skill that explains them is where the
 * agents look for it.
 */
import fs from 'fs';
import path from 'path';
import { MS, SCALE, SPRING, SQUASH, STAGGER, cascadeDelay, dampingRatio, exitMs, staggerDelay, textHoldMs, travelMs } from '@/utils/motion';

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
