/** Plain-language text for the fight replay (FightReplay.tsx): titles, damage math and "what got triggered" lines. */
import { ownerOfEvent } from '../data/weaponGuide';
import type { FightLogEntry, FightLogLine, FightLogSetMath, RunEventType } from '../types';

/** Events whose amount is damage dealt to the foe. */
const DAMAGE: ReadonlySet<RunEventType> = new Set(['hit', 'rainbow', 'blast', 'laser', 'ricochet', 'pinata_break']);

const plural = (n: number | undefined, one: string, many = `${one}s`) => `${n ?? 0} ${n === 1 ? one : many}`;

/** Label for one event, or null when the replay shows it elsewhere (the Set's own hit, coins, the mistake itself). */
const LABEL: Partial<Record<RunEventType, (l: FightLogLine) => string | null>> = {
  hit: l => l.text ?? null,
  rainbow: l => (l.text ? `${l.text} (Rainbow)` : null),
  blast: l => `Explosion · ${plural(Number(l.text), 'card')}`,
  laser: l => `Laser · ${plural(Number(l.text), 'card')}`,
  ricochet: l => `Ricochet · ${plural(Number(l.text), 'card')}`,
  link_burst: l => `Linked cards went too · ${plural(Number(l.text), 'card')}`,
  echo: l => `Echo matched a Set · ${plural(Number(l.text), 'card')}`,
  grow: l => `Board grew by ${plural(l.amount, 'card')}`,
  pinata_break: () => 'Piñata broke',
  coins: () => null,
  mistake: () => null,
  heal: l => `+${plural(l.amount, 'heart')}`,
  hurt: l => `−${plural(l.amount, 'heart')}`,
  grace: () => 'Grace saved a heart',
  levelup: () => 'Level up!',
  foe_defeated: () => 'Foe knocked out',
  wave: l => `Wave ${l.amount}`,
  regen: l => `Foe healed ${l.amount}`,
  fire: l => `${plural(l.amount, 'card')} set on fire`,
  hint: l => `+${plural(l.amount, 'hint')}`,
  time_gain: l => `+${l.amount}s on the clock`,
  time_up: () => 'Time ran out',
  moves_out: () => 'Out of moves',
  combo: l => `Combo ×${l.amount}`,
  hot_streak: () => 'Hot Streak ready (next Set ×2)',
  hot_streak_hit: l => `Hot Streak ×${l.amount}`,
  grudge: l => `Grudge stored (${l.amount})`,
  grudge_release: l => `Grudge released (+${l.amount} to the Set)`,
  nine_lives: () => 'Nine Lives saved you',
  thick_hide: () => 'Thick Hide took the mistake',
  patience: l => `Patience (+${l.amount} to the Set)`,
  freeze: l => `Frozen ${Math.round((l.amount ?? 0) / 100) / 10}s`,
  redeal: () => 'Zoomies re-dealt the board',
  scoop: () => 'Big Scoop',
  keen_eye: () => 'Keen Eye spotted a Set',
  fetch: l => (l.text ? `Fetched ${l.amount} → ${l.text}` : `Fetched ${l.amount}`),
  free_mistake: () => 'Mistake forgiven',
  rule: l => l.text ?? 'Rule fired',
  doubled: () => 'Trigger doubled',
  double_ready: () => 'Next trigger will double',
  charged: l => `Next Set ×${l.amount}`,
  empowered: l => `Empowered ${plural(l.amount, 'card')}`,
  simplified: l => `Simplified (${l.text})`,
  simplify_end: () => 'Simplify ended',
  pinata: l => `Piñata appeared (${l.amount})`,
  link: l => `+${plural(l.amount, 'link')}`,
  purity: l => `Purity ×${l.amount}`,
  purity_max: l => `Max Purity ×${l.amount}`,
  catalyst_spawn: () => 'A Catalyst appeared',
  evolution_start: l => `Evolution: ${l.text}`,
  evolution_end: l => `${l.text} wore off`,
  trap_placed: l => `Foe placed a ${l.text}`,
  trap_defused: l => `Defused a ${l.text}`,
  trap_sprung: l => `A ${l.text} went off`,
  arcana_burn: () => 'Arcana burn',
  overkill: l => `Overkill ${l.amount}`,
  dud: () => 'Foe made a card a dud',
  face_down: () => 'Cards turned face-down',
  countdown: () => 'Countdown card',
  bomb: () => 'Bomb on the board',
  triple: () => 'Armored cards',
  shuffle: () => 'Foe shuffled the board',
  attr_shift: () => 'Foe changed a card',
  card_removed: () => 'A card was removed',
  time_stolen: () => 'Foe stole time',
  inactivity: () => 'Foe punished standing still',
};

const humanize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');

export interface ReplayLine {
  label: string;
  source?: string;
  /** "weapon:<id>", "node:<id>" or "evo:<id>": what to explain when the line is opened */
  sourceRef?: string;
  /** Damage dealt (summed over repeats) */
  damage?: number;
  count: number;
}

/** What happened during an entry beyond the Set's own hit, with repeats folded together ("Burn ×4 · 8 dmg"). */
export const describeLines = (lines: FightLogLine[], held: readonly string[] = []): ReplayLine[] => {
  const out: ReplayLine[] = [];
  const byKey = new Map<string, ReplayLine>();
  for (const l of lines) {
    const fn = LABEL[l.type];
    const label = fn ? fn(l) : `${humanize(l.type)}${l.amount !== undefined ? ` ${l.amount}` : ''}`;
    if (!label) continue;
    // (a blast the board rolled carries no amount: its damage is inside the Set's own hit)
    const isDamage = DAMAGE.has(l.type) && l.amount !== undefined;
    // A blast or a callout with no rule behind it still has an owner: the held weapon that causes that kind of thing
    const owner = l.sourceRef ? null : ownerOfEvent(l.type, l.text, held);
    const sourceRef = l.sourceRef ?? (owner ? `weapon:${owner}` : undefined);
    const key = `${label}|${l.source ?? sourceRef ?? ''}|${isDamage}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.count += 1;
      if (isDamage) prev.damage = (prev.damage ?? 0) + (l.amount ?? 0);
      continue;
    }
    const line: ReplayLine = {
      label, count: 1,
      ...(l.source ? { source: l.source } : {}),
      ...(sourceRef ? { sourceRef } : {}),
      ...(isDamage ? { damage: l.amount ?? 0 } : {}),
    };
    byKey.set(key, line);
    out.push(line);
  }
  // A rule's callout and the damage it dealt carry the same name: keep just the damage line
  const dealt = new Set(out.filter(l => l.damage !== undefined).map(l => `${l.label}|${l.source ?? ''}`));
  return out.filter(l => l.damage !== undefined || !dealt.has(`${l.label}|${l.source ?? ''}`));
};

const COLLATERAL_LABEL: Record<string, string> = {
  explosion: 'Explosion cards', laser: 'Laser cards', ricochet: 'Ricochet cards', fire: 'Burned cards', connected: 'Linked cards', grace: 'Grace',
};

export interface MathRow { label: string; value: string; total?: boolean }

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** The Set's own hit as a sum someone can check: cards + bonuses, × multipliers, + extras = hit. */
export const setMathRows = (m: FightLogSetMath): MathRow[] => {
  const rows: MathRow[] = [{ label: 'Matched cards', value: fmt(m.cards) }];
  for (const [kind, pts] of Object.entries(m.collateral)) if (pts) rows.push({ label: COLLATERAL_LABEL[kind] ?? kind, value: `+${fmt(pts)}` });
  if (m.flatBonus) rows.push({ label: 'Per-Set bonuses', value: `${m.flatBonus > 0 ? '+' : ''}${fmt(m.flatBonus)}` });
  if (m.multiplier !== 1) rows.push({ label: m.rainbow ? 'Multiplier (Rainbow ×2 and others)' : 'Multiplier', value: `×${fmt(m.multiplier)}` });
  if (m.extra) rows.push({ label: 'Purity & traps', value: `+${fmt(m.extra)}` });
  rows.push({ label: 'Set hit', value: `${m.hit}`, total: true });
  return rows;
};

export const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "Set #4", "Mistake", "Bought Flint Spark"… (setNo counts Sets up to and including this one). */
export const entryTitle = (e: FightLogEntry, setNo: number): string => {
  switch (e.kind) {
    case 'set': return `Set #${setNo}`;
    case 'mistake': return 'Mistake';
    case 'burn': return 'Cards burned';
    case 'time': return 'On the clock';
    case 'hint': return 'Hint used';
    case 'pick': return `Level-up pick: ${e.label ?? 'weapon'}`;
    case 'buy': return `Bought ${e.label ?? 'a weapon'}`;
    case 'wave': return e.wave === 0 ? 'Fight start' : `Wave ${e.wave + 1}`;
  }
};

/** One short line for the move list. */
export const entrySummary = (e: FightLogEntry): string => {
  if (e.kind === 'set' && e.set) {
    const bits = [e.set.rainbow ? 'Rainbow' : `${e.set.diffTraits} trait${e.set.diffTraits === 1 ? '' : 's'} differ`];
    if (e.set.graceUsed) bits.push('grace');
    const triggers = describeLines(e.lines).filter(l => l.damage).map(l => l.source ?? l.label);
    if (triggers.length) bits.push([...new Set(triggers)].slice(0, 2).join(', '));
    return bits.join(' · ');
  }
  if (e.kind === 'mistake') return e.heartsDelta < 0 ? `lost ${plural(-e.heartsDelta, 'heart')}` : 'no heart lost';
  const lines = describeLines(e.lines);
  return lines.slice(0, 2).map(l => l.source ?? l.label).join(', ');
};

// ─── What each piece of gear did ────────────────────────────────────────────

export interface GearStat {
  /** Times it did something (a blast, a callout, a rule firing) */
  fired: number;
  /** Damage it dealt itself or added to Sets */
  damage: number;
}

/** The weapon a log line belongs to: the rule that caused it, or the held weapon that owns that kind of event. */
export const weaponOfLine = (l: FightLogLine, held: readonly string[]): string | null => {
  if (l.sourceRef?.startsWith('weapon:')) return l.sourceRef.slice(7);
  if (l.sourceRef) return null;
  return ownerOfEvent(l.type, l.text, held);
};

/** A callout that carries a multiplier, not damage ("Curse broken ×2") */
const isMultiplier = (l: FightLogLine) => l.type === 'rule' && (l.text?.includes('×') ?? false);

/** What every weapon, evolution and skill node did over the whole fight, by ref ("weapon:<id>", "evo:<id>", "node:<id>"). */
export const gearStats = (log: readonly FightLogEntry[], held: readonly string[]): Record<string, GearStat> => {
  const out: Record<string, GearStat> = {};
  for (const e of log) {
    // One entry can hold several lines of one firing (a callout and its damage): count the source once per entry
    const seen = new Set<string>();
    for (const l of e.lines) {
      const weapon = weaponOfLine(l, held);
      const ref = weapon ? `weapon:${weapon}` : l.sourceRef;
      if (!ref) continue;
      const stat = (out[ref] ??= { fired: 0, damage: 0 });
      if (!seen.has(ref)) {
        seen.add(ref);
        stat.fired += 1;
      }
      const amount = l.amount ?? 0;
      if (DAMAGE.has(l.type) || (l.type === 'rule' && amount > 0 && !isMultiplier(l) && Number.isFinite(amount))) stat.damage += amount;
    }
  }
  for (const stat of Object.values(out)) stat.damage = Math.round(stat.damage * 10) / 10;
  return out;
};

/** "Fired 6 times · 48 damage (20% of the fight)", in words. */
export const gearStatText = (stat: GearStat | undefined, totalDamage: number, kind: 'always' | 'other'): string => {
  if (!stat || stat.fired === 0) return kind === 'always' ? 'Always on: its bonus is inside your Set hits.' : 'Did not fire this fight.';
  const times = `Fired ${stat.fired} ${stat.fired === 1 ? 'time' : 'times'}`;
  if (stat.damage <= 0) return `${times}.`;
  const share = totalDamage > 0 ? Math.round((stat.damage / totalDamage) * 100) : 0;
  return `${times} · ${fmt(stat.damage)} damage${share >= 1 ? ` (${share}% of the fight)` : ''}.`;
};

/** The fight in two or three plain sentences. */
export const fightSummary = (o: {
  totalDamage: number; ms: number; sets: number; mistakes: number; setDamage: number;
  /** The gear that dealt the most, by name */
  best?: { name: string; damage: number };
}): string => {
  const parts = [`You dealt ${Math.round(o.totalDamage)} damage in ${fmtClock(o.ms)}, with ${plural(o.sets, 'Set')} and ${plural(o.mistakes, 'mistake')}.`];
  if (o.totalDamage > 0) {
    const own = Math.max(0, Math.min(100, Math.round((o.setDamage / o.totalDamage) * 100)));
    parts.push(own >= 100 ? 'All of it came from your Sets.' : `${own}% came from your Sets and ${100 - own}% from what they set off.`);
  }
  if (o.best && o.best.damage > 0) parts.push(`${o.best.name} did the most: ${fmt(o.best.damage)} damage.`);
  return parts.join(' ');
};
