/**
 * Brotato-style cumulative damage attribution & over-time Battle Story engine.
 *
 * Pure, deterministic data transforms that attribute every point of damage in
 * `RunState.log` across individual Weapons, Fighter Passives, Skill Tree Nodes,
 * Evolutions, Modifiers (Rainbow / Parry / Surge / Power), and Matched Sets,
 * then produce:
 *   1. Ranked cumulative damage leaderboard (`sources`, MVP at index 0)
 *   2. Cumulative over-time curves (`points` + `source.cumulative[]`) for SVG graphing
 *   3. 4–7 musical & particle crescendo peaks (`crescendoBeats`) across the 3-second story
 *   4. Multi-floor cumulative Spire climb summaries (`buildSpireRunDamageStory`)
 */
import type { IconName } from '@/components/Icon';
import { getArmoryWeapon } from '../data/armory';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { PASSIVES } from '../data/passives';
import { getUpgrade } from '../data/upgrades';
import { ownerOfEvent } from '../data/weaponGuide';
import { roleLabel, type WeaponRole } from '../data/weaponRoles';
import { getRecipe, getSkillNode } from './sources';
import type { EvolutionRecipe, FightLogEntry, FightLogLine, PassiveId, RunEventType, RunState } from '../types';

export type DamageSourceKind = 'weapon' | 'passive' | 'skill' | 'evolution' | 'set' | 'power' | 'bonus';

export interface DamageSourceMeta {
  id: string;
  name: string;
  kind: DamageSourceKind;
  weaponId?: string;
  icon: IconName;
}

export interface DamageSourceSummary extends DamageSourceMeta {
  color: string;
  totalDamage: number;
  share: number;
  hits: number;
  biggestHit: number;
  /** Cumulative damage at each timeline point (length === story.points.length) */
  cumulative: number[];
}

export interface DamageTimelinePoint {
  /** Fight clock ms (or 1-based floor index when xAxisMode === 'floors') */
  tMs: number;
  label: string;
  totalCumulative: number;
  stepDamage: number;
  peakSourceId: string | null;
  callout?: string;
}

export interface CrescendoBeat {
  /** Normalized position 0.08..0.95 along the 3-second crescendo sweep */
  progress: number;
  pointIndex: number;
  sourceId: string;
  weaponId?: string;
  color: string;
  damage: number;
  label: string;
}

export interface DamageStory {
  totalDamage: number;
  durationMs: number;
  xAxisMode: 'time' | 'floors';
  sources: DamageSourceSummary[];
  /** Top up-to-5 curves plotted on the over-time graph */
  chartSources: DamageSourceSummary[];
  points: DamageTimelinePoint[];
  headline: string;
  crescendoBeats: CrescendoBeat[];
}

/** Persistent per-source ledger stored on `SpireRunStats` across all floors of a Spire climb. */
export interface SpireSourceDamageEntry {
  id: string;
  name: string;
  kind: DamageSourceKind;
  weaponId?: string;
  icon: IconName;
  damage: number;
  hits: number;
  biggestHit: number;
}

export interface SpireFloorDamageSnapshot {
  floor: number;
  foeName: string;
  totalDamage: number;
  bySource: Record<string, number>;
}

/** High-contrast Core Stack chart palette: distinct on dark-onyx telemetry backdrop & paper badges */
export const STORY_PALETTE = [
  '#F5B800', // Action Gold (MVP / lead curve)
  '#16AA98', // Logic Teal
  '#F0483E', // Impact Crimson
  '#38BDF8', // Sky Cobalt
  '#FB923C', // Ember Orange
  '#C084FC', // Arcana Violet
  '#4ADE80', // Emerald
] as const;

const DAMAGE_LINE_TYPES = new Set<RunEventType>([
  'hit', 'rainbow', 'surge_hit', 'blast', 'laser', 'ricochet',
  'hot_streak_hit', 'grudge_release', 'patience', 'pinata_break', 'trap_defused',
]);

const COLLATERAL_EVENT: Record<string, RunEventType> = {
  explosion: 'blast',
  laser: 'laser',
  ricochet: 'ricochet',
  fire: 'fire',
  connected: 'link_burst',
};

const COLLATERAL_FALLBACK_NAME: Record<string, { id: string; name: string; icon: IconName }> = {
  explosion: { id: 'fx:blast', name: 'Explosions', icon: 'lorc/bright-explosion' },
  laser: { id: 'fx:laser', name: 'Laser Beams', icon: 'lorc/lightning-arc' },
  ricochet: { id: 'fx:ricochet', name: 'Ricochets', icon: 'lorc/bouncing-sword' },
  fire: { id: 'fx:burn', name: 'Burn Damage', icon: 'lorc/candle-flame' },
  connected: { id: 'fx:link', name: 'Linked Cards', icon: 'lorc/lightning-branches' },
};

const PASSIVE_BY_NAME: Record<string, PassiveId> = {};
for (const [id, def] of Object.entries(PASSIVES) as [PassiveId, (typeof PASSIVES)[PassiveId]][]) {
  PASSIVE_BY_NAME[def.name.toLowerCase()] = id;
}

const EVOLUTION_BY_NAME: Record<string, EvolutionRecipe> = {};
for (const rec of EVOLUTION_RECIPES) {
  EVOLUTION_BY_NAME[rec.name.toLowerCase()] = rec;
}

const fmtClockShort = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

const isMultRuleLine = (l: FightLogLine): boolean =>
  l.type === 'rule' && Boolean(l.text?.includes('×'));

/** Resolve any ref/label/event line into canonical metadata (name, kind, weaponId, icon). */
export const resolveDamageSourceMeta = (
  opts: { sourceRef?: string; label?: string; line?: FightLogLine; held?: readonly string[] }
): DamageSourceMeta => {
  const held = opts.held ?? [];
  const rawRef = opts.sourceRef ?? opts.line?.sourceRef;

  // 1. Explicit weapon ref
  if (rawRef?.startsWith('weapon:')) {
    const wid = rawRef.slice(7);
    const w = getArmoryWeapon(wid);
    return {
      id: `weapon:${wid}`,
      name: w?.name ?? opts.label ?? wid,
      kind: 'weapon',
      weaponId: wid,
      icon: (w?.icon as IconName | undefined) ?? 'lorc/crossed-swords',
    };
  }

  // 2. Explicit evolution ref
  if (rawRef?.startsWith('evo:')) {
    const eid = rawRef.slice(4);
    const rec = getRecipe(eid);
    return {
      id: `evo:${eid}`,
      name: rec?.name ?? opts.label ?? eid,
      kind: 'evolution',
      icon: (rec?.icon as IconName | undefined) ?? 'lorc/crystal-shine',
    };
  }

  // 3. Explicit skill node ref
  if (rawRef?.startsWith('node:')) {
    const nid = rawRef.slice(5);
    const node = getSkillNode(nid);
    return {
      id: `node:${nid}`,
      name: node?.name ?? opts.label ?? nid,
      kind: 'skill',
      icon: (node?.icon as IconName | undefined) ?? 'lorc/spark-spirit',
    };
  }

  // 4. Explicit passive ref
  if (rawRef?.startsWith('passive:')) {
    const pid = rawRef.slice(8) as PassiveId;
    const p = PASSIVES[pid];
    return {
      id: `passive:${pid}`,
      name: p?.name ?? opts.label ?? pid,
      kind: 'passive',
      icon: (p?.icon as IconName | undefined) ?? 'lorc/spark-spirit',
    };
  }

  // 4b. Explicit Role Set Bonus ref
  if (rawRef?.startsWith('role:')) {
    const rid = rawRef.slice(5) as WeaponRole;
    return {
      id: `role:${rid}`,
      name: `${roleLabel(rid)} Set Bonus`,
      kind: 'bonus',
      icon: 'lorc/spark-spirit',
    };
  }

  // 5. Event-owned weapon (e.g. blast/laser/fire/pinata_break owned by a held weapon)
  if (opts.line) {
    const owner = ownerOfEvent(opts.line.type, opts.line.text, held);
    if (owner) {
      const w = getArmoryWeapon(owner);
      return {
        id: `weapon:${owner}`,
        name: w?.name ?? owner,
        kind: 'weapon',
        weaponId: owner,
        icon: (w?.icon as IconName | undefined) ?? 'lorc/crossed-swords',
      };
    }
    if (opts.line.type === 'hot_streak_hit') {
      const p = PASSIVES.hot_streak;
      return { id: 'passive:hot_streak', name: p.name, kind: 'passive', icon: p.icon };
    }
    if (opts.line.type === 'grudge_release') {
      const p = PASSIVES.grudge;
      return { id: 'passive:grudge', name: p.name, kind: 'passive', icon: p.icon };
    }
    if (opts.line.type === 'patience') {
      const p = PASSIVES.patience;
      return { id: 'passive:patience', name: p.name, kind: 'passive', icon: p.icon };
    }
    if (opts.line.type === 'fire' || opts.line.text?.toLowerCase().includes('burn')) {
      return { id: 'fx:burn', name: 'Burn Damage', kind: 'bonus', icon: 'lorc/candle-flame' };
    }
    if (opts.line.type === 'trap_defused') {
      return { id: 'bonus:traps', name: 'Trap Defusal', kind: 'bonus', icon: 'lorc/checked-shield' };
    }
  }

  // 6. Label matching (passives, Workshop upgrades, Rainbow, Parry, Surge, Purity, Power)
  const cleanLabel = (opts.label ?? opts.line?.source ?? opts.line?.text ?? '').replace(/!$/, '').trim();
  const low = cleanLabel.toLowerCase();

  if (PASSIVE_BY_NAME[low]) {
    const pid = PASSIVE_BY_NAME[low];
    const p = PASSIVES[pid];
    return { id: `passive:${pid}`, name: p.name, kind: 'passive', icon: p.icon };
  }
  if (EVOLUTION_BY_NAME[low]) {
    const rec = EVOLUTION_BY_NAME[low];
    return { id: `evo:${rec.id}`, name: rec.name, kind: 'evolution', icon: rec.icon };
  }
  if (low.includes('hot streak')) return { id: 'passive:hot_streak', name: PASSIVES.hot_streak.name, kind: 'passive', icon: PASSIVES.hot_streak.icon };
  if (low.includes('scrappy')) return { id: 'passive:scrappy', name: PASSIVES.scrappy.name, kind: 'passive', icon: PASSIVES.scrappy.icon };
  if (low.includes('grudge')) return { id: 'passive:grudge', name: PASSIVES.grudge.name, kind: 'passive', icon: PASSIVES.grudge.icon };
  if (low.includes('patience')) return { id: 'passive:patience', name: PASSIVES.patience.name, kind: 'passive', icon: PASSIVES.patience.icon };
  if (low.includes('combo')) return { id: 'passive:combo', name: PASSIVES.combo.name, kind: 'passive', icon: PASSIVES.combo.icon };
  if (low.includes('big scoop') || low.includes('free set')) return { id: 'passive:big_scoop', name: PASSIVES.big_scoop.name, kind: 'passive', icon: PASSIVES.big_scoop.icon };
  if (low.includes('purity')) return { id: 'bonus:purity', name: 'Purity Chain', kind: 'bonus', icon: 'lorc/crystal-shine' };
  if (low.includes('heavy hitter')) {
    const u = getUpgrade('heavy_hitter');
    return { id: 'upgrade:heavy_hitter', name: u.name, kind: 'passive', icon: u.icon };
  }
  if (low === 'rainbow' || low === 'rainbow strike') return { id: 'bonus:rainbow', name: 'Rainbow Strike', kind: 'bonus', icon: 'lorc/rainbow-star' };
  if (low.includes('parry') || low.includes('stagger')) return { id: 'bonus:parry', name: 'Set-Parry Counter', kind: 'bonus', icon: 'lorc/sword-clash' };
  if (low.includes('surge')) return { id: 'bonus:surge', name: 'Shading Surge', kind: 'bonus', icon: 'lorc/power-lightning' };
  if (low.includes('power')) return { id: 'power:scale', name: 'Power Scaling', kind: 'power', icon: 'lorc/power-lightning' };

  // Match weapon by display name if held
  for (const wid of held) {
    const w = getArmoryWeapon(wid);
    if (w && low && (w.name.toLowerCase() === low || low.startsWith(w.name.toLowerCase()))) {
      return { id: `weapon:${wid}`, name: w.name, kind: 'weapon', weaponId: wid, icon: (w.icon as IconName) ?? 'lorc/crossed-swords' };
    }
  }

  if (cleanLabel) {
    return { id: `bonus:${low.replace(/[^a-z0-9]+/g, '_')}`, name: cleanLabel, kind: 'bonus', icon: 'lorc/spark-spirit' };
  }
  return { id: 'set:cards', name: 'Matched Sets', kind: 'set', icon: 'lorc/crossed-swords' };
};

/** Attribute a single `FightLogEntry`'s damage across contributing sources (conserving exact `entry.damage`). */
const attributeEntry = (
  e: FightLogEntry,
  held: readonly string[],
  metaMap: Map<string, DamageSourceMeta>
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (e.damage <= 0) return out;

  const credit = (meta: DamageSourceMeta, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!metaMap.has(meta.id)) metaMap.set(meta.id, meta);
    out[meta.id] = (out[meta.id] ?? 0) + amount;
  };

  const setCardsMeta: DamageSourceMeta = { id: 'set:cards', name: 'Matched Sets', kind: 'set', icon: 'lorc/crossed-swords' };
  const cardBonusMeta: DamageSourceMeta = { id: 'set:card_bonus', name: 'Power Cards', kind: 'bonus', icon: 'lorc/flat-star' };
  const powerMeta: DamageSourceMeta = { id: 'power:scale', name: 'Power Scaling', kind: 'power', icon: 'lorc/power-lightning' };

  // ── 1. Set hit damage (`e.setDamage`) ──────────────────────────────────────
  if (e.kind === 'set' && e.set && e.setDamage > 0) {
    const m = e.set;
    const setPart: Record<string, number> = {};
    const addSet = (meta: DamageSourceMeta, amt: number) => {
      if (!Number.isFinite(amt) || amt <= 0) return;
      if (!metaMap.has(meta.id)) metaMap.set(meta.id, meta);
      setPart[meta.id] = (setPart[meta.id] ?? 0) + amt;
    };

    const baseCards = m.baseCards ?? Math.min(m.cards, m.cardCount ?? 3);
    const cardBonus = m.cardBonus ?? Math.max(0, m.cards - baseCards);
    addSet(setCardsMeta, baseCards);
    if (cardBonus > 0) addSet(cardBonusMeta, cardBonus);

    // Collateral cards destroyed by weapon procs inside the Set
    let collateralSum = 0;
    for (const [kind, pts] of Object.entries(m.collateral)) {
      if (!pts || pts <= 0) continue;
      collateralSum += pts;
      const evType = COLLATERAL_EVENT[kind];
      const owner = evType ? ownerOfEvent(evType, undefined, held) : null;
      if (owner) {
        const w = getArmoryWeapon(owner);
        addSet({ id: `weapon:${owner}`, name: w?.name ?? owner, kind: 'weapon', weaponId: owner, icon: (w?.icon as IconName) ?? 'lorc/bright-explosion' }, pts);
      } else {
        const fb = COLLATERAL_FALLBACK_NAME[kind] ?? { id: `fx:${kind}`, name: kind, icon: 'lorc/bright-explosion' as IconName };
        addSet({ ...fb, kind: 'bonus' }, pts);
      }
    }

    // Shading Surge: unified logs include Shading Surge inside `multItems` & `multiplier` (post-addition);
    // legacy saved logs applied `surgeMultiplier` to cards+collateral before `flatBonus`.
    const surgeInMult = (m.multItems ?? []).some(it => it.label.toLowerCase().includes('surge'));
    const surgeMult = m.surgeMultiplier ?? 1;
    const preSurge = !surgeInMult && surgeMult > 1 ? surgeMult : 1;
    if (preSurge > 1) {
      const surgeLift = (m.cards + collateralSum) * (preSurge - 1);
      addSet({ id: 'bonus:surge', name: 'Shading Surge', kind: 'bonus', icon: 'lorc/power-lightning' }, surgeLift);
    }

    // Flat per-Set bonuses (weapons, passives, Workshop Heavy Hitter, skill nodes, evolutions, Piñata, Purity, Traps)
    let flatSum = 0;
    if (m.flatItems && m.flatItems.length > 0) {
      for (const item of m.flatItems) {
        if (item.amount <= 0) continue;
        flatSum += item.amount;
        addSet(resolveDamageSourceMeta({ sourceRef: item.sourceRef, label: item.label, held }), item.amount);
      }
    }
    const flatRem = m.flatBonus - flatSum;
    if (flatRem > 0.05) {
      addSet({ id: 'bonus:flat', name: 'Set Bonuses', kind: 'bonus', icon: 'lorc/spark-spirit' }, flatRem);
    }

    // Pre-multiplier subtotal
    const preMult = Math.max(0, (m.cards + collateralSum) * preSurge + Math.max(0, m.flatBonus));

    // Multiplier uplift (Rainbow ×2, Hot Streak ×2, Parry ×1.75, Staggered ×2, weapon multipliers)
    const mult = Math.max(1, m.multiplier);
    const multLift = preMult * (mult - 1);
    if (multLift > 0.05) {
      const posMults = (m.multItems ?? []).filter(it => it.amount > 1);
      if (posMults.length > 0) {
        const weightSum = posMults.reduce((s, it) => s + Math.log(it.amount), 0) || posMults.length;
        for (const it of posMults) {
          const share = weightSum > 0 ? Math.log(it.amount) / weightSum : 1 / posMults.length;
          addSet(resolveDamageSourceMeta({ sourceRef: it.sourceRef, label: it.label, held }), multLift * share);
        }
      } else {
        addSet(
          m.rainbow
            ? { id: 'bonus:rainbow', name: 'Rainbow Strike', kind: 'bonus', icon: 'lorc/rainbow-star' }
            : { id: 'bonus:mult', name: 'Set Multipliers', kind: 'bonus', icon: 'lorc/power-lightning' },
          multLift
        );
      }
    }

    // Post-multiplier extras (Purity, traps)
    let extraSum = 0;
    if (m.extraItems && m.extraItems.length > 0) {
      for (const it of m.extraItems) {
        if (it.amount <= 0) continue;
        extraSum += it.amount;
        addSet(resolveDamageSourceMeta({ sourceRef: it.sourceRef, label: it.label, held }), it.amount);
      }
    }
    if (m.extra - extraSum > 0.05) {
      addSet({ id: 'bonus:purity', name: 'Purity & Traps', kind: 'bonus', icon: 'lorc/crystal-shine' }, m.extra - extraSum);
    }

    // Power scaling uplift (fight-wide ×N multiplier)
    const pMult = m.powerMultiplier ?? 1;
    const beforePower = preMult * mult + Math.max(0, m.extra);
    if (pMult > 1 && e.setDamage > beforePower + 0.05) {
      addSet(powerMeta, e.setDamage - beforePower);
    }

    // Normalize setPart to match `e.setDamage` exactly (accounts for enemy armor / integer rounding)
    const rawSetSum = Object.values(setPart).reduce((s, v) => s + v, 0);
    if (rawSetSum > 0) {
      const scale = e.setDamage / rawSetSum;
      for (const [id, v] of Object.entries(setPart)) {
        const meta = metaMap.get(id) ?? setCardsMeta;
        credit(meta, v * scale);
      }
    } else {
      credit(setCardsMeta, e.setDamage);
    }
  } else if (e.setDamage > 0) {
    credit(setCardsMeta, e.setDamage);
  }

  // ── 2. Triggered / Follow-up / Burn damage (`e.damage - e.setDamage`) ──────
  const triggered = Math.max(0, e.damage - e.setDamage);
  if (triggered > 0.05) {
    const trigPart: Record<string, number> = {};
    for (const l of e.lines) {
      const amt = l.amount ?? 0;
      if (amt <= 0 || !Number.isFinite(amt)) continue;
      // Skip the Set's own lead hit line (already accounted for in e.setDamage)
      if ((l.type === 'hit' && !l.text) || l.type === 'rainbow' || l.type === 'surge_hit') continue;
      const isDmg = DAMAGE_LINE_TYPES.has(l.type) || (l.type === 'rule' && !isMultRuleLine(l)) || l.type === 'fire';
      if (!isDmg) continue;
      const meta = resolveDamageSourceMeta({ sourceRef: l.sourceRef, label: l.source ?? l.text, line: l, held });
      if (!metaMap.has(meta.id)) metaMap.set(meta.id, meta);
      trigPart[meta.id] = (trigPart[meta.id] ?? 0) + amt;
    }
    const rawTrigSum = Object.values(trigPart).reduce((s, v) => s + v, 0);
    if (rawTrigSum > 0) {
      const scale = triggered / rawTrigSum;
      for (const [id, v] of Object.entries(trigPart)) {
        const meta = metaMap.get(id)!;
        credit(meta, v * scale);
      }
    } else {
      // Burn or unlabelled triggered damage fallback
      const fb: DamageSourceMeta =
        e.kind === 'burn'
          ? { id: 'fx:burn', name: 'Burn Damage', kind: 'bonus', icon: 'lorc/candle-flame' }
          : { id: 'fx:triggered', name: 'Triggered Effects', kind: 'bonus', icon: 'lorc/bright-explosion' };
      credit(fb, triggered);
    }
  }

  return out;
};

/** Choose up to 7 well-spaced musical/particle crescendo peaks across the 3-second replay sweep. */
const pickCrescendoBeats = (
  points: readonly DamageTimelinePoint[],
  sourcesById: Map<string, DamageSourceSummary>,
  stepDeltas: readonly Record<string, number>[]
): CrescendoBeat[] => {
  if (points.length <= 1) return [];
  const totalSpan = Math.max(1, points.length - 1);
  // Candidate indices (exclude t=0 origin at index 0)
  const candidates: { idx: number; damage: number; sourceId: string; callout?: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.stepDamage <= 0) continue;
    const deltas = stepDeltas[i] ?? {};
    // Prefer a weapon or passive over bare matched sets when close in contribution so players hear their build!
    let bestId = pt.peakSourceId ?? '';
    let bestScore = -1;
    for (const [id, amt] of Object.entries(deltas)) {
      const s = sourcesById.get(id);
      const boost = s?.kind === 'weapon' ? 1.35 : s?.kind === 'evolution' ? 1.3 : s?.kind === 'passive' || s?.kind === 'skill' ? 1.2 : 1;
      if (amt * boost > bestScore) {
        bestScore = amt * boost;
        bestId = id;
      }
    }
    if (bestId) candidates.push({ idx: i, damage: pt.stepDamage, sourceId: bestId, callout: pt.callout });
  }
  if (candidates.length === 0) return [];

  const maxBeats = Math.min(7, candidates.length);
  const chosen: typeof candidates = [];
  const used = new Set<number>();

  // Always include the final damage beat as the crescendo climax
  const last = candidates[candidates.length - 1];
  chosen.push(last);
  used.add(last.idx);

  // Pick remaining highest-impact beats preferring distinct sources and clean spacing
  const remaining = candidates
    .slice(0, -1)
    .sort((a, b) => (b.damage + (b.callout ? 8 : 0)) - (a.damage + (a.callout ? 8 : 0)));

  const seenSources = new Set<string>([last.sourceId]);
  const minGap = Math.max(0.11, 0.72 / Math.max(2, maxBeats));

  const tryPick = (requireNewSource: boolean) => {
    for (const c of remaining) {
      if (chosen.length >= maxBeats) break;
      if (used.has(c.idx)) continue;
      if (requireNewSource && seenSources.has(c.sourceId)) continue;
      const p = c.idx / totalSpan;
      if (chosen.some(o => Math.abs(o.idx / totalSpan - p) < minGap)) continue;
      chosen.push(c);
      used.add(c.idx);
      seenSources.add(c.sourceId);
    }
  };
  tryPick(true);
  tryPick(false);

  chosen.sort((a, b) => a.idx - b.idx);
  return chosen.map((c, i) => {
    const src = sourcesById.get(c.sourceId);
    const rawProgress = c.idx / totalSpan;
    // Match the exact dot x-position along the timeline (0.06..0.985) so playhead & sparks land together
    const progress = chosen.length === 1 ? 0.88 : Math.max(0.06, Math.min(0.985, rawProgress));
    const label = c.callout ?? (src ? `${src.name} +${Math.round(c.damage)}` : `+${Math.round(c.damage)}`);
    return {
      progress,
      pointIndex: c.idx,
      sourceId: c.sourceId,
      weaponId: src?.weaponId,
      color: src?.color ?? STORY_PALETTE[0],
      damage: round1(c.damage),
      label,
    };
  });
};

/** Build a complete Brotato-style Damage Story from a finished (or in-progress) `RunState`. */
export const buildDamageStory = (run: RunState): DamageStory => {
  const held = run.weapons.map(w => w.id);
  const metaMap = new Map<string, DamageSourceMeta>();
  const totals = new Map<string, { damage: number; hits: number; biggestHit: number }>();

  // Pre-seed origin point at t = 0
  const points: DamageTimelinePoint[] = [
    { tMs: 0, label: '0:00', totalCumulative: 0, stepDamage: 0, peakSourceId: null },
  ];
  const stepDeltas: Record<string, number>[] = [{}];
  const runningBySource = new Map<string, number>();
  const snapshots: Map<string, number>[] = [new Map()];

  let cumulativeTotal = 0;
  let setCount = 0;

  for (const e of run.log) {
    if (e.kind === 'set') setCount += 1;
    if (e.damage <= 0) continue;

    const deltas = attributeEntry(e, held, metaMap);
    let peakId: string | null = null;
    let peakAmt = -1;
    for (const [id, amt] of Object.entries(deltas)) {
      const prev = totals.get(id) ?? { damage: 0, hits: 0, biggestHit: 0 };
      prev.damage += amt;
      prev.hits += 1;
      if (amt > prev.biggestHit) prev.biggestHit = amt;
      totals.set(id, prev);
      runningBySource.set(id, (runningBySource.get(id) ?? 0) + amt);
      if (amt > peakAmt) {
        peakAmt = amt;
        peakId = id;
      }
    }

    cumulativeTotal += e.damage;
    let callout: string | undefined;
    if (e.lines.some(l => l.type === 'foe_defeated')) callout = 'K.O.!';
    else if (e.lines.some(l => l.type === 'perfect_parry')) callout = 'PERFECT PARRY!';
    else if (e.lines.some(l => l.type === 'evolution_start')) callout = 'EVOLUTION!';
    else if (e.set?.rainbow) callout = `RAINBOW +${Math.round(e.damage)}`;

    points.push({
      tMs: e.t,
      label: e.kind === 'set' ? `S${setCount}` : fmtClockShort(e.t),
      totalCumulative: round1(cumulativeTotal),
      stepDamage: round1(e.damage),
      peakSourceId: peakId,
      callout,
    });
    stepDeltas.push(deltas);
    snapshots.push(new Map(runningBySource));
  }

  // Fallback for synthetic runs without log entries (e.g. legacy unit tests)
  if (points.length === 1 && run.totalDamage > 0) {
    const fallbackMeta: DamageSourceMeta = { id: 'set:cards', name: 'Matched Sets', kind: 'set', icon: 'lorc/crossed-swords' };
    metaMap.set(fallbackMeta.id, fallbackMeta);
    totals.set(fallbackMeta.id, { damage: run.totalDamage, hits: Math.max(1, run.matches), biggestHit: run.biggestHit || run.totalDamage });
    const snap = new Map<string, number>([[fallbackMeta.id, run.totalDamage]]);
    points.push({
      tMs: Math.max(1000, run.elapsedMs),
      label: fmtClockShort(run.elapsedMs),
      totalCumulative: round1(run.totalDamage),
      stepDamage: round1(run.totalDamage),
      peakSourceId: fallbackMeta.id,
      callout: run.status === 'won' ? 'K.O.!' : undefined,
    });
    stepDeltas.push({ [fallbackMeta.id]: run.totalDamage });
    snapshots.push(snap);
    cumulativeTotal = run.totalDamage;
  }

  const grandTotal = round1(cumulativeTotal);
  const sortedIds = [...totals.entries()]
    .filter(([, s]) => s.damage >= 0.05)
    .sort((a, b) => b[1].damage - a[1].damage)
    .map(([id]) => id);

  const sources: DamageSourceSummary[] = sortedIds.map((id, idx) => {
    const meta = metaMap.get(id)!;
    const stat = totals.get(id)!;
    const cumulative = snapshots.map(snap => round1(snap.get(id) ?? 0));
    return {
      ...meta,
      color: STORY_PALETTE[idx % STORY_PALETTE.length],
      totalDamage: round1(stat.damage),
      share: grandTotal > 0 ? stat.damage / grandTotal : 0,
      hits: stat.hits,
      biggestHit: round1(stat.biggestHit),
      cumulative,
    };
  });

  const sourcesById = new Map(sources.map(s => [s.id, s]));
  const chartSources = sources.slice(0, 5);
  const crescendoBeats = pickCrescendoBeats(points, sourcesById, stepDeltas);

  // Build plain-English 1-line summary headline
  const mvp = sources[0];
  let peakPt: DamageTimelinePoint | null = null;
  for (let i = 1; i < points.length; i++) {
    if (!peakPt || points[i].stepDamage > peakPt.stepDamage) peakPt = points[i];
  }
  let headline = 'No damage dealt this battle.';
  if (mvp && grandTotal > 0) {
    const pct = Math.max(1, Math.round(mvp.share * 100));
    const peakPart = peakPt && peakPt.stepDamage > 0 ? ` · Peak +${Math.round(peakPt.stepDamage)} at ${fmtClockShort(peakPt.tMs)}` : '';
    headline = `${mvp.name} led with ${Math.round(mvp.totalDamage)} dmg (${pct}%)${peakPart}`;
  }

  return {
    totalDamage: grandTotal,
    durationMs: Math.max(1000, run.elapsedMs, points[points.length - 1]?.tMs ?? 0),
    xAxisMode: 'time',
    sources,
    chartSources,
    points,
    headline,
    crescendoBeats,
  };
};

/**
 * Merge one finished Spire battle's damage breakdown into the cumulative run-wide ledger
 * stored on `SpireRunStats` (so `SpireEndScreen` shows your entire roguelike climb!).
 */
export const mergeSpireDamageLedger = (
  prevSources: Record<string, SpireSourceDamageEntry> | undefined,
  prevFloors: SpireFloorDamageSnapshot[] | undefined,
  floor: number,
  fight: RunState
): { sourceDamage: Record<string, SpireSourceDamageEntry>; floorLedger: SpireFloorDamageSnapshot[] } => {
  const story = buildDamageStory(fight);
  const nextSources: Record<string, SpireSourceDamageEntry> = { ...(prevSources ?? {}) };
  const bySource: Record<string, number> = {};

  for (const s of story.sources) {
    bySource[s.id] = s.totalDamage;
    const existing = nextSources[s.id];
    nextSources[s.id] = existing
      ? {
          ...existing,
          damage: round1(existing.damage + s.totalDamage),
          hits: existing.hits + s.hits,
          biggestHit: Math.max(existing.biggestHit, s.biggestHit),
        }
      : {
          id: s.id,
          name: s.name,
          kind: s.kind,
          weaponId: s.weaponId,
          icon: s.icon,
          damage: s.totalDamage,
          hits: s.hits,
          biggestHit: s.biggestHit,
        };
  }

  const nextFloors: SpireFloorDamageSnapshot[] = [
    ...(prevFloors ?? []),
    { floor, foeName: fight.foeName, totalDamage: story.totalDamage, bySource },
  ];

  return { sourceDamage: nextSources, floorLedger: nextFloors };
};

/** Build a cumulative full-climb Brotato Damage Story across every floor of a Starfall Spire run! */
export const buildSpireRunDamageStory = (
  sourceDamage: Record<string, SpireSourceDamageEntry> | undefined,
  floorLedger: readonly SpireFloorDamageSnapshot[] | undefined
): DamageStory | null => {
  const entries = Object.values(sourceDamage ?? {}).filter(e => e.damage >= 0.05);
  const floors = floorLedger ?? [];
  if (entries.length === 0 || floors.length === 0) return null;

  const sorted = [...entries].sort((a, b) => b.damage - a.damage);
  const points: DamageTimelinePoint[] = [
    { tMs: 0, label: 'Start', totalCumulative: 0, stepDamage: 0, peakSourceId: null },
  ];
  const running = new Map<string, number>();
  const snapshots: Map<string, number>[] = [new Map()];
  const stepDeltas: Record<string, number>[] = [{}];
  let grandTotal = 0;

  for (const fl of floors) {
    grandTotal += fl.totalDamage;
    let peakId: string | null = null;
    let peakAmt = -1;
    for (const [id, amt] of Object.entries(fl.bySource)) {
      running.set(id, (running.get(id) ?? 0) + amt);
      if (amt > peakAmt) {
        peakAmt = amt;
        peakId = id;
      }
    }
    points.push({
      tMs: fl.floor,
      label: `Fl ${fl.floor}`,
      totalCumulative: round1(grandTotal),
      stepDamage: round1(fl.totalDamage),
      peakSourceId: peakId,
      callout: `Fl ${fl.floor} · ${fl.foeName}`,
    });
    stepDeltas.push(fl.bySource);
    snapshots.push(new Map(running));
  }

  const finalTotal = round1(grandTotal);
  const sources: DamageSourceSummary[] = sorted.map((e, idx) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    weaponId: e.weaponId,
    icon: e.icon,
    color: STORY_PALETTE[idx % STORY_PALETTE.length],
    totalDamage: round1(e.damage),
    share: finalTotal > 0 ? e.damage / finalTotal : 0,
    hits: e.hits,
    biggestHit: round1(e.biggestHit),
    cumulative: snapshots.map(snap => round1(snap.get(e.id) ?? 0)),
  }));

  const sourcesById = new Map(sources.map(s => [s.id, s]));
  const mvp = sources[0];
  const pct = mvp && finalTotal > 0 ? Math.max(1, Math.round(mvp.share * 100)) : 0;
  const headline = mvp
    ? `${mvp.name} carried the climb with ${Math.round(mvp.totalDamage).toLocaleString()} dmg (${pct}%) across ${floors.length} ${floors.length === 1 ? 'battle' : 'battles'}`
    : `Dealt ${Math.round(finalTotal).toLocaleString()} total damage across the Spire`;

  return {
    totalDamage: finalTotal,
    durationMs: floors.length,
    xAxisMode: 'floors',
    sources,
    chartSources: sources.slice(0, 5),
    points,
    headline,
    crescendoBeats: pickCrescendoBeats(points, sourcesById, stepDeltas),
  };
};
