/**
 * The balance report: runs the lab over the whole Armory and every recipe,
 * judges each number against targets.ts, and renders the result as markdown
 * (docs/balance-report.md) and a snapshot (docs/balance-snapshot.json) that
 * the next report diffs against.
 *
 *   npm run balance:report
 */
import { getArmoryWeapon } from '../data/armory';
import { weaponRole, type WeaponRole } from '../data/weaponRoles';
import { benches, inBuild, median, play, recipeLifts, solo, type BenchId, type Lift, type RecipeLift } from './lab';
import { BALANCE_TARGETS as T, PARTNER_WEAPONS, TIERS, type Tier } from './targets';

export type VerdictKind = 'overpowered' | 'underpowered' | 'passenger' | 'no-slot-value' | 'weak-recipe' | 'runaway-recipe' | 'rare-recipe';

export interface Verdict {
  kind: VerdictKind;
  /** The thing judged (weapon or recipe id) */
  id: string;
  detail: string;
}

export interface WeaponReport {
  id: string;
  name: string;
  role: WeaponRole;
  /** Solo value by stage, average tier */
  stage: Record<BenchId, Lift>;
  /** Solo value late game, by skill tier */
  tier: Record<Tier, number>;
  /** Value inside real builds, late game, average tier */
  inBuild: Lift;
}

export interface BalanceReport {
  runs: number;
  weapons: WeaponReport[];
  recipes: RecipeLift[];
  verdicts: Verdict[];
  summary: {
    /** Share of weapons that earn their slot in a real build */
    viablePool: number;
    /** Weapons within reach of the strongest solo weapon */
    topPicks: string[];
    soloEarlyMean: number;
    recipeLiftMedian: number;
  };
}

export interface ReportOptions {
  /** Seeds per measurement */
  runs: number;
  /** Random builds per weapon for the in-build value, and their size */
  builds: number;
  buildSize: number;
  /** Measure recipes too (the slowest part) */
  recipes: boolean;
  /** Only these weapons (default: the whole Armory) */
  only?: readonly string[];
}

/** What a weapon adds for an expert ÷ what it adds for a novice (what it adds, so a weak weapon isn't called even) */
const skewOf = (w: WeaponReport) => (w.tier.expert - 1) / Math.max(0.05, w.tier.novice - 1);
const audience = (w: WeaponReport) => (w.tier.average <= 1.1 ? '' : skewOf(w) < T.audienceEven[0] ? 'novice' : skewOf(w) > T.audienceEven[1] ? 'expert' : 'everyone');
const x2 = (n: number) => `×${n.toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Measure everything. */
export const measure = (opts: ReportOptions): Pick<BalanceReport, 'runs' | 'weapons' | 'recipes'> => {
  const b = benches();
  const armory = b.late.save.armory;
  const ids = opts.only ?? armory;
  const none = {
    early: play(b.early, [], 'average', opts.runs),
    mid: play(b.mid, [], 'average', opts.runs),
    late: Object.fromEntries(TIERS.map(t => [t, play(b.late, [], t, opts.runs)])) as Record<Tier, ReturnType<typeof play>>,
  };
  const weapons = ids.map((id): WeaponReport => {
    const late = Object.fromEntries(TIERS.map(t => [t, solo(b.late, id, t, opts.runs, none.late[t])])) as Record<Tier, Lift>;
    return {
      id,
      name: getArmoryWeapon(id)?.name ?? id,
      role: weaponRole(id),
      stage: { early: solo(b.early, id, 'average', opts.runs, none.early), mid: solo(b.mid, id, 'average', opts.runs, none.mid), late: late.average },
      tier: { novice: late.novice.ratio, average: late.average.ratio, expert: late.expert.ratio },
      inBuild: inBuild(b.late, id, 'average', opts.runs, armory, opts.buildSize, opts.builds),
    };
  });
  const recipes = opts.recipes ? recipeLifts(b.late, 'average', opts.runs) : [];
  return { runs: opts.runs, weapons, recipes };
};

/** Judge the measurements against the targets. */
export const judge = (m: Pick<BalanceReport, 'runs' | 'weapons' | 'recipes'>): BalanceReport => {
  const verdicts: Verdict[] = [];
  for (const w of m.weapons) {
    const partner = PARTNER_WEAPONS.includes(w.id);
    const band = T.soloLate[w.role];
    const tiers = TIERS.map(t => w.tier[t]);
    // Riot's rule: too strong for anyone is too strong; too weak only if it is weak for everyone
    const over = TIERS.filter(t => w.tier[t] > band[1]);
    if (over.length) verdicts.push({ kind: 'overpowered', id: w.id, detail: `alone, late game: ${over.map(t => `${t} ${x2(w.tier[t])}`).join(', ')} (ceiling ${x2(band[1])})` });
    if (w.stage.early.ratio > T.soloEarly[1]) verdicts.push({ kind: 'overpowered', id: w.id, detail: `alone at level 1: ${x2(w.stage.early.ratio)} (ceiling ${x2(T.soloEarly[1])})` });
    if (w.inBuild.ratio > T.inBuild[1]) verdicts.push({ kind: 'overpowered', id: w.id, detail: `in a real build: ${x2(w.inBuild.ratio)} (ceiling ${x2(T.inBuild[1])})` });
    if (!partner && tiers.every(x => x < band[0])) {
      verdicts.push({ kind: 'underpowered', id: w.id, detail: `alone, late game: ${TIERS.map(t => `${t} ${x2(w.tier[t])}`).join(', ')} (floor ${x2(band[0])})` });
    }
    if (!partner && w.inBuild.ratio < T.inBuild[0]) verdicts.push({ kind: 'no-slot-value', id: w.id, detail: `in a real build: ${x2(w.inBuild.ratio)} (floor ${x2(T.inBuild[0])})` });
    if (!partner && [w.stage.early, w.stage.mid, w.stage.late].every(s => s.dead > T.deadFightShare)) {
      verdicts.push({ kind: 'passenger', id: w.id, detail: `changes nothing in ${pct(w.stage.early.dead)} / ${pct(w.stage.mid.dead)} / ${pct(w.stage.late.dead)} of fights (early / mid / late)` });
    }
  }
  for (const r of m.recipes) {
    if (r.ratio < T.recipeLift[0]) verdicts.push({ kind: 'weak-recipe', id: r.id, detail: `${x2(r.ratio)} over ${r.pair.join(' + ')} (floor ${x2(T.recipeLift[0])})` });
    if (r.ratio > T.recipeLift[1]) verdicts.push({ kind: 'runaway-recipe', id: r.id, detail: `${x2(r.ratio)} over ${r.pair.join(' + ')} (ceiling ${x2(T.recipeLift[1])})` });
    if (r.starts < T.recipeStartsPerFight) verdicts.push({ kind: 'rare-recipe', id: r.id, detail: `starts ${r.starts.toFixed(2)} times a fight` });
  }
  const best = Math.max(...m.weapons.map(w => w.tier.average), 1);
  return {
    ...m,
    verdicts,
    summary: {
      viablePool: m.weapons.filter(w => PARTNER_WEAPONS.includes(w.id) || w.inBuild.ratio >= T.inBuild[0]).length / Math.max(1, m.weapons.length),
      topPicks: m.weapons.filter(w => w.tier.average - 1 >= (best - 1) * (1 - T.topPickWithin)).map(w => w.id),
      soloEarlyMean: m.weapons.filter(w => !PARTNER_WEAPONS.includes(w.id)).reduce((a, w) => a + w.stage.early.ratio, 0) / Math.max(1, m.weapons.filter(w => !PARTNER_WEAPONS.includes(w.id)).length),
      recipeLiftMedian: median(m.recipes.map(r => r.ratio)),
    },
  };
};

// ─── Snapshot & movers ──────────────────────────────────────────────────────

/** The few numbers per thing worth tracking over time. */
export type Snapshot = Record<string, number>;

export const snapshotOf = (r: BalanceReport): Snapshot => {
  const s: Snapshot = {};
  for (const w of r.weapons) {
    s[`weapon:${w.id}:early`] = +w.stage.early.ratio.toFixed(3);
    s[`weapon:${w.id}:late`] = +w.tier.average.toFixed(3);
    s[`weapon:${w.id}:inBuild`] = +w.inBuild.ratio.toFixed(3);
  }
  for (const x of r.recipes) s[`recipe:${x.id}`] = +x.ratio.toFixed(3);
  return s;
};

/** Numbers that moved more than `moverShare` since the previous snapshot, biggest first. */
export const movers = (now: Snapshot, before: Snapshot): { key: string; before: number; now: number }[] =>
  Object.keys(now)
    .filter(k => before[k] !== undefined && Math.abs(now[k] - before[k]) / Math.max(0.01, before[k]) > T.moverShare)
    .map(k => ({ key: k, before: before[k], now: now[k] }))
    .sort((a, b) => Math.abs(b.now / b.before - 1) - Math.abs(a.now / a.before - 1));

// ─── Markdown ───────────────────────────────────────────────────────────────

const VERDICT_TEXT: Record<VerdictKind, string> = {
  overpowered: 'Overpowered',
  underpowered: 'Underpowered',
  passenger: 'Passenger (rarely does anything)',
  'no-slot-value': 'Not worth a slot in a real build',
  'weak-recipe': 'Weak recipe',
  'runaway-recipe': 'Runaway recipe',
  'rare-recipe': 'Recipe rarely starts',
};

export const renderMarkdown = (r: BalanceReport, moved: ReturnType<typeof movers> = []): string => {
  const out: string[] = [];
  const row = (cells: (string | number)[]) => out.push(`| ${cells.join(' | ')} |`);
  out.push('# Balance report', '');
  out.push('Generated by `npm run balance:report` (see [balance-system.md](./balance-system.md) for how to read it). Every number is damage with the thing ÷ damage without it, on the same seeded fights.', '');
  out.push('## Summary', '');
  row(['Measure', 'Now', 'Target']);
  row(['---', '---', '---']);
  row(['Weapons that earn their slot in a real build (viable pool)', pct(r.summary.viablePool), `≥ ${pct(T.viablePool)}`]);
  row(['Top picks (add at least 65% of what the strongest weapon adds)', `${r.summary.topPicks.length}: ${r.summary.topPicks.join(', ')}`, `≥ ${T.topPicksAtLeast}`]);
  row(['Mean level-1 weapon, early game', x2(r.summary.soloEarlyMean), `≥ ${x2(T.soloEarlyMean)}`]);
  if (r.recipes.length) row(['Median evolution lift', x2(r.summary.recipeLiftMedian), `≥ ${x2(T.recipeLiftMedian)}`]);
  row(['Flags', r.verdicts.length, '0']);
  out.push('', '## Flags', '');
  if (!r.verdicts.length) out.push('None.');
  else {
    row(['Verdict', 'What', 'Why']);
    row(['---', '---', '---']);
    for (const v of r.verdicts) row([VERDICT_TEXT[v.kind], `\`${v.id}\``, v.detail]);
  }
  if (moved.length) {
    out.push('', '## Movers since the last snapshot', '');
    row(['What', 'Before', 'Now']);
    row(['---', '---', '---']);
    for (const m of moved.slice(0, 40)) row([`\`${m.key}\``, x2(m.before), x2(m.now)]);
  }
  out.push('', '## Weapons', '');
  out.push('Alone = the weapon as the only charm. In a build = five random charms with it vs the same four without it. Leans = who it adds more for (a comfort pick leans novice, a skill pick leans expert; both are fine). Passenger = share of late-game fights it changes nothing in. Swing = spread of its effect from fight to fight.', '');
  row(['Weapon', 'Shelf', 'Alone, level 1 (3 traits)', 'Alone, level 3 (4 traits)', 'Alone, maxed (5 traits): novice / average / expert', 'Leans', 'In a build', 'Passenger', 'Swing']);
  row(['---', '---', '---', '---', '---', '---', '---', '---', '---']);
  for (const w of [...r.weapons].sort((a, b) => a.role.localeCompare(b.role) || b.tier.average - a.tier.average)) {
    row([w.name, w.role, x2(w.stage.early.ratio), x2(w.stage.mid.ratio), TIERS.map(t => x2(w.tier[t])).join(' / '), audience(w), x2(w.inBuild.ratio), pct(w.stage.late.dead), w.stage.late.swing.toFixed(2)]);
  }
  if (r.recipes.length) {
    out.push('', '## Evolutions', '');
    out.push('Lift = the pair with evolutions on ÷ the same pair with evolutions off, maxed gear, average bot.', '');
    row(['Recipe', 'Pair', 'Lift', 'Starts per fight']);
    row(['---', '---', '---', '---']);
    for (const x of [...r.recipes].sort((a, b) => b.ratio - a.ratio)) row([`\`${x.id}\``, x.pair.join(' + '), x2(x.ratio), x.starts.toFixed(1)]);
  }
  return out.join('\n') + '\n';
};
