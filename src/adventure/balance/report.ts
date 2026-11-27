/**
 * The balance report: runs the lab over the whole Armory and every per-weapon
 * timed evolution (192 total), judges each number against targets.ts, and
 * renders the result as markdown (docs/balance-report.md) and a snapshot
 * (docs/balance-snapshot.json) that the next report diffs against.
 *
 *   npm run balance:report
 */
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon, weaponRuleSource } from '../data/armory';
import { weaponRole, type WeaponRole } from '../data/weaponRoles';
import {
  benches,
  effectiveRuleFirings,
  evolutionLifts,
  inBuild,
  isDummyUnreachableRule,
  mean,
  median,
  play,
  soloSample,
  type BenchId,
  type EvolutionLift,
  type Lift,
  type Sample,
} from './lab';
import { BALANCE_TARGETS as T, PARTNER_WEAPONS, TIERS, type Tier } from './targets';

export type VerdictKind =
  | 'overpowered'
  | 'underpowered'
  | 'passenger'
  | 'no-slot-value'
  | 'weak-evolution'
  | 'empty-evolution'
  | 'runaway-evolution'
  | 'rare-evolution'
  | 'dead-rule';

export interface Verdict {
  kind: VerdictKind;
  /** The thing judged (weapon or evolution id) */
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
  /** Mean share of Set damage from pre-multiplier base damage (late solo) */
  baseDamageShare: number;
  /** Mean Synergy Graph hook damage per late solo fight */
  synergyDamage: number;
  /** Authored weapon rules (`w0:<id>#i`) that fired 0 effective times across all solo stages */
  deadRules: string[];
}

export interface BalanceReport {
  runs: number;
  weapons: WeaponReport[];
  evolutions: EvolutionLift[];
  verdicts: Verdict[];
  summary: {
    /** Share of weapons that earn their slot in a real build */
    viablePool: number;
    /** Weapons within reach of the strongest solo weapon */
    topPicks: string[];
    soloEarlyMean: number;
    evoLiftMedian: number;
    evoRuleLiftMedian: number;
    meanBaseDamageShare: number;
  };
}

export interface ReportOptions {
  /** Seeds per measurement */
  runs: number;
  /** Random builds per weapon for the in-build value, and their size */
  builds: number;
  buildSize: number;
  /** Measure all 192 per-weapon evolutions too (the slowest part) */
  evolutions?: boolean;
  /** Legacy alias for `evolutions` */
  recipes?: boolean;
  /** Only these weapons (default: the whole Armory) */
  only?: readonly string[];
}

const SLOT_LABELS = ['A', 'B', 'C'] as const;

/** What a weapon adds for an expert ÷ what it adds for a novice (what it adds, so a weak weapon isn't called even) */
const skewOf = (w: WeaponReport) => (w.tier.expert - 1) / Math.max(0.05, w.tier.novice - 1);
const audience = (w: WeaponReport) => (w.tier.average <= 1.1 ? '' : skewOf(w) < T.audienceEven[0] ? 'novice' : skewOf(w) > T.audienceEven[1] ? 'expert' : 'everyone');
const x2 = (n: number) => `×${n.toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const mergeRuleTelemetry = (samples: readonly Sample[]) => {
  const firings: Record<string, number> = {};
  const zeroOps: Record<string, number> = {};
  for (const s of samples) {
    for (const [k, v] of Object.entries(s.ruleFirings)) firings[k] = (firings[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.ruleZeroOps)) zeroOps[k] = (zeroOps[k] ?? 0) + v;
  }
  return { firings, zeroOps };
};

/** Measure everything. */
export const measure = (opts: ReportOptions): Pick<BalanceReport, 'runs' | 'weapons' | 'evolutions'> => {
  const b = benches();
  const armory = [...ALL_ARMORY_WEAPON_IDS];
  const nonPartner = armory.filter(id => !PARTNER_WEAPONS.includes(id));
  const ids = opts.only ?? armory;
  const none = {
    early: play(b.early, [], 'average', opts.runs),
    mid: play(b.mid, [], 'average', opts.runs),
    campaign: play(b.campaign, [], 'average', opts.runs),
    late: Object.fromEntries(TIERS.map(t => [t, play(b.late, [], t, opts.runs)])) as Record<Tier, Sample>,
  };
  const weapons = ids.map((id): WeaponReport => {
    const early = soloSample(b.early, id, 'average', opts.runs, none.early);
    const mid = soloSample(b.mid, id, 'average', opts.runs, none.mid);
    const campaign = soloSample(b.campaign, id, 'average', opts.runs, none.campaign);
    const lateSamples = Object.fromEntries(
      TIERS.map(t => [t, soloSample(b.late, id, t, opts.runs, none.late[t])])
    ) as Record<Tier, { lift: Lift; sample: Sample }>;

    const { firings, zeroOps } = mergeRuleTelemetry([
      early.sample,
      mid.sample,
      campaign.sample,
      lateSamples.novice.sample,
      lateSamples.average.sample,
      lateSamples.expert.sample,
    ]);
    const rules = weaponRuleSource(getArmoryWeapon(id)!).rules ?? [];
    const deadRules: string[] = [];
    if (!PARTNER_WEAPONS.includes(id)) {
      rules.forEach((rule, idx) => {
        const key = `w0:${id}#${idx}`;
        const eff = effectiveRuleFirings(firings, zeroOps, key);
        if (eff <= 0 && !isDummyUnreachableRule(rule)) deadRules.push(key);
      });
    }

    return {
      id,
      name: getArmoryWeapon(id)?.name ?? id,
      role: weaponRole(id),
      stage: { early: early.lift, mid: mid.lift, late: lateSamples.average.lift, campaign: campaign.lift },
      tier: {
        novice: lateSamples.novice.lift.ratio,
        average: lateSamples.average.lift.ratio,
        expert: lateSamples.expert.lift.ratio,
      },
      inBuild: inBuild(b.late, id, 'average', opts.runs, nonPartner, opts.buildSize, opts.builds),
      baseDamageShare: lateSamples.average.sample.baseDamageShare,
      synergyDamage: lateSamples.average.sample.synergyDamage,
      deadRules,
    };
  });
  const runEvos = opts.evolutions ?? opts.recipes ?? false;
  const evolutions = runEvos ? evolutionLifts(b.late, 'average', opts.runs) : [];
  return { runs: opts.runs, weapons, evolutions };
};

/** Judge the measurements against the targets. */
export const judge = (m: Pick<BalanceReport, 'runs' | 'weapons' | 'evolutions'>): BalanceReport => {
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
    if (w.deadRules.length > 0) {
      verdicts.push({ kind: 'dead-rule', id: w.id, detail: `0 effective firings on ${w.deadRules.join(', ')}` });
    }
  }
  for (const e of m.evolutions) {
    if (e.ratio < T.evoLift[0]) verdicts.push({ kind: 'weak-evolution', id: e.id, detail: `${x2(e.ratio)} on ${e.weaponId} Slot ${SLOT_LABELS[e.variantIndex]} (floor ${x2(T.evoLift[0])})` });
    if (e.ruleLift < T.evoRuleLift[0]) {
      verdicts.push({ kind: 'empty-evolution', id: e.id, detail: `rule lift ${x2(e.ruleLift)} over blank chassis (floor ${x2(T.evoRuleLift[0])})` });
    }
    if (e.ratio > T.evoLift[1]) {
      verdicts.push({ kind: 'runaway-evolution', id: e.id, detail: `${x2(e.ratio)} on ${e.weaponId} Slot ${SLOT_LABELS[e.variantIndex]} (ceiling ${x2(T.evoLift[1])})` });
    } else if (e.ruleLift > T.evoRuleLift[1]) {
      verdicts.push({ kind: 'runaway-evolution', id: e.id, detail: `rule lift ${x2(e.ruleLift)} over blank chassis (ceiling ${x2(T.evoRuleLift[1])})` });
    }
    if (e.triggersPerFight < T.evoTriggersPerFight) {
      verdicts.push({ kind: 'rare-evolution', id: e.id, detail: `triggers ${e.triggersPerFight.toFixed(2)} times a fight (${e.conditionType})` });
    }
    if (e.deadRules.length > 0) verdicts.push({ kind: 'dead-rule', id: e.id, detail: `0 effective firings on ${e.deadRules.join(', ')}` });
  }
  const best = Math.max(...m.weapons.map(w => w.tier.average), 1);
  const nonPartners = m.weapons.filter(w => !PARTNER_WEAPONS.includes(w.id));
  return {
    ...m,
    verdicts,
    summary: {
      viablePool: m.weapons.filter(w => PARTNER_WEAPONS.includes(w.id) || w.inBuild.ratio >= T.inBuild[0]).length / Math.max(1, m.weapons.length),
      topPicks: m.weapons.filter(w => w.tier.average - 1 >= (best - 1) * (1 - T.topPickWithin)).map(w => w.id),
      soloEarlyMean: nonPartners.reduce((a, w) => a + w.stage.early.ratio, 0) / Math.max(1, nonPartners.length),
      evoLiftMedian: median(m.evolutions.map(e => e.ratio)),
      evoRuleLiftMedian: median(m.evolutions.map(e => e.ruleLift)),
      meanBaseDamageShare: mean(nonPartners.map(w => w.baseDamageShare)),
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
    s[`weapon:${w.id}:campaign`] = +w.stage.campaign.ratio.toFixed(3);
    s[`weapon:${w.id}:late`] = +w.tier.average.toFixed(3);
    s[`weapon:${w.id}:inBuild`] = +w.inBuild.ratio.toFixed(3);
  }
  for (const e of r.evolutions) {
    s[`evo:${e.id}`] = +e.ratio.toFixed(3);
    s[`evo:${e.id}:ruleLift`] = +e.ruleLift.toFixed(3);
  }
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
  'weak-evolution': 'Weak evolution',
  'empty-evolution': 'Empty evolution (barely beats blank chassis)',
  'runaway-evolution': 'Runaway evolution',
  'rare-evolution': 'Evolution rarely triggers',
  'dead-rule': 'Dead rule (0 effective firings)',
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
  row(['Mean Set pre-multiplier base damage share', pct(r.summary.meanBaseDamageShare), `≥ ${pct(T.baseDamageShare[0])}`]);
  if (r.evolutions.length) {
    row(['Median evolution total lift (on ÷ off)', x2(r.summary.evoLiftMedian), `≥ ${x2(T.evoLiftMedian)}`]);
    row(['Median evolution bespoke rule lift (on ÷ blank chassis)', x2(r.summary.evoRuleLiftMedian), `≥ ${x2(T.evoRuleLift[0])}`]);
  }
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
  out.push('Alone = the weapon as the only charm. Campaign = 3 traits + Shading Surge (15 cards, realistic Lv 1–2 gear). In a build = five random non-partner charms with it vs the same four without it. Base% = share of Set damage from pre-multiplier base. Leans = who it adds more for.', '');
  row(['Weapon', 'Shelf', 'Early Lv1 (3t)', 'Campaign Lv1–2 (Surge)', 'Mid Lv3 (4t)', 'Late Lv5 (5t): nov / avg / exp', 'Leans', 'In a build', 'Base%', 'Passenger', 'Swing']);
  row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---']);
  for (const w of [...r.weapons].sort((a, b) => a.role.localeCompare(b.role) || b.tier.average - a.tier.average)) {
    row([
      w.name,
      w.role,
      x2(w.stage.early.ratio),
      x2(w.stage.campaign.ratio),
      x2(w.stage.mid.ratio),
      TIERS.map(t => x2(w.tier[t])).join(' / '),
      audience(w),
      x2(w.inBuild.ratio),
      pct(w.baseDamageShare),
      pct(w.stage.late.dead),
      w.stage.late.swing.toFixed(2),
    ]);
  }
  if (r.evolutions.length) {
    out.push('', '## Per-Weapon Timed Evolutions (192)', '');
    out.push('Total Lift = weapon with evolution on ÷ evolutions off. Rule Lift = real evolution rules ÷ blank evolution chassis (+18 burst / +8 base / +0.20× additive only). Triggers = mean ignitions per fight.', '');
    row(['Evolution', 'Weapon (Slot)', 'Condition', 'Total Lift', 'Rule Lift', 'Triggers/fight', 'Firings/fight']);
    row(['---', '---', '---', '---', '---', '---', '---']);
    for (const e of [...r.evolutions].sort((a, b) => b.ruleLift - a.ruleLift)) {
      row([
        `\`${e.id}\``,
        `\`${e.weaponId}\` (${SLOT_LABELS[e.variantIndex]})`,
        e.conditionType,
        x2(e.ratio),
        x2(e.ruleLift),
        e.triggersPerFight.toFixed(1),
        e.ruleFirings.toFixed(1),
      ]);
    }
  }
  return out.join('\n') + '\n';
};
