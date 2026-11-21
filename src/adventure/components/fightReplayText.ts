/** Plain-language text for the fight replay (FightReplay.tsx): titles, damage math and "what got triggered" lines. */
import { ownerOfEvent } from '../data/weaponGuide';
import type { FightLogCard, FightLogEntry, FightLogLine, FightLogSetMath, RunEventType } from '../types';

/** Events whose amount is damage dealt to the foe. */
const DAMAGE: ReadonlySet<RunEventType> = new Set(['hit', 'rainbow', 'surge_hit', 'blast', 'laser', 'ricochet', 'pinata_break']);

const plural = (n: number | undefined, one: string, many = `${one}s`) => `${n ?? 0} ${n === 1 ? one : many}`;

/** Label for one event, or null when the replay shows it elsewhere (the Set's own hit, coins, the mistake itself). */
const LABEL: Partial<Record<RunEventType, (l: FightLogLine) => string | null>> = {
  hit: l => l.text ?? null,
  rainbow: l => (l.text ? `${l.text} (Rainbow)` : null),
  surge_hit: l => (l.text ? `${l.text} (Shading Surge)` : null),
  surge_start: l => `Shading Surge! ${l.text ? `${l.text} ` : ''}Sets ×5`,
  surge_end: () => 'Shading Surge ended',
  surge_warn: () => null,
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
  breather: () => 'Out of hearts: refilled (practice)',
  power_up: l => `Weapon scaled up: ${l.text ?? 'stronger'}`,
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
  parry_warn: () => null,
  parry: l => `Parried ${l.text ?? 'strike'}!`,
  perfect_parry: l => `Perfect Parry on ${l.text ?? 'strike'}! (Stagger ×2)`,
  foe_strike: l => `Unparried ${l.text ?? 'strike'} landed`,
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

/** Log line types whose contribution is already itemized inside HOW THE SET HIT for Set entries. */
const SET_MATH_LINE_TYPES: ReadonlySet<RunEventType> = new Set(['grudge_release', 'patience', 'hot_streak_hit']);

/** A callout that carries a multiplier, not damage ("Curse broken ×2") */
const isMultiplier = (l: FightLogLine) => l.type === 'rule' && (l.text?.includes('×') ?? false);

/** What happened during an entry beyond the Set's own hit, with repeats folded together ("Burn ×4 · 8 dmg"). */
export const describeLines = (
  lines: FightLogLine[],
  held: readonly string[] = [],
  opts?: { excludeSetMathRules?: boolean }
): ReplayLine[] => {
  const out: ReplayLine[] = [];
  const byKey = new Map<string, ReplayLine>();
  for (const l of lines) {
    if (opts?.excludeSetMathRules) {
      if (l.type === 'rule' && l.amount !== undefined) continue;
      if (SET_MATH_LINE_TYPES.has(l.type)) continue;
    }
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

export interface MathRow {
  label: string;
  value: string;
  sub?: string;
  explain?: string;
  sourceRef?: string;
  total?: boolean;
  subtotal?: boolean;
  isPower?: boolean;
  powerPoints?: number;
  powerMultiplier?: number;
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(Math.abs(n))}`);

const LEGACY_TRICK_REF: Record<string, string> = {
  'Greedy Chest': 'weapon:greedy-chest',
  Magnet: 'weapon:magnet',
  'Chain Gang': 'weapon:chain-gang',
  Thorns: 'weapon:thorn-bush',
  Rust: 'weapon:rust',
  'Tar Pit': 'weapon:tar-pit',
  'Decoy found': 'weapon:decoy',
  'Short fuse': 'weapon:long-fuse',
  'Hot Potato': 'weapon:hot-potato',
  Bounty: 'weapon:bounty-poster',
  "Devil's Bargain": 'weapon:devils-bargain',
  Snowball: 'weapon:snowball',
  Mirror: 'weapon:mirror-shard',
  'Odd one out': 'weapon:odd-one-out',
  'Glass Sword': 'weapon:glass-sword',
  'Album complete': 'weapon:collectors-album',
  Tightrope: 'weapon:tightrope',
};

/** Inferred bonus on a logged card (works for both v0.1.119 cards and legacy v0.1.118 cards with only tags). */
export const loggedCardBonus = (c: FightLogCard): number => {
  if (c.bonusPoints !== undefined) return c.bonusPoints;
  let total = 0;
  for (const tag of c.tags) {
    const m = /^(?:Power|Charged)?\s*\+(\d+)(?:\s*dmg)?$/.exec(tag);
    if (m) total += Number(m[1]);
  }
  return total;
};

/** Total damage points a single matched card was worth (1 base + card bonus). */
export const loggedCardPoints = (c: FightLogCard): number => c.points ?? (1 + loggedCardBonus(c));

/** Plain-English explanation shown when a player taps one of the 3 matched cards in the replay. */
export const explainLogCard = (c: FightLogCard): { title: string; points: number; base: number; bonus: number; summary: string; notes: string[] } => {
  const bonus = loggedCardBonus(c);
  const points = loggedCardPoints(c);
  const base = Math.max(0, points - bonus);
  const shapeWord = c.number === 1 ? c.shape : `${c.shape}s`;
  const title = `${c.number} ${c.color} ${c.shading} ${shapeWord}`;
  const notes: string[] = [];
  if (bonus > 0) {
    const hasPower = c.tags.some(t => t.startsWith('Power '));
    const hasCharged = c.tags.some(t => t.startsWith('Charged '));
    if (hasPower) notes.push(`Power card (+${bonus}): landed boosted on the board, so this card counts for ${points} damage instead of 1.`);
    else if (hasCharged) notes.push(`Charged card (+${bonus}): held extra charge damage, counting for ${points} total.`);
    else notes.push(`Boosted card (+${bonus} dmg): special board boost made this card count for ${points} instead of 1.`);
  } else {
    notes.push('Standard card: counts for 1 base damage toward the Set.');
  }
  for (const tag of c.tags) {
    if (tag.startsWith('Power ') || tag.startsWith('Charged ') || /^\+\d+\s*dmg$/.test(tag)) continue;
    if (tag === 'Magnet') notes.push('Magnetized card: matching it triggered your Magnet bonus.');
    else if (tag.startsWith('Chest +')) notes.push(`Greedy Chest (${tag}): matching this card cracked open the chest bonus.`);
    else if (tag === 'Cursed ×2') notes.push('Cursed card: clearing it broke the curse and multiplied this Set.');
    else if (tag === 'Hot Potato') notes.push('Hot Potato: matching it scored its bonus before passing or exploding.');
    else if (tag === 'Wild') notes.push('Wild card: stood in for any trait needed to complete the Set.');
    else if (tag === 'Catalyst') notes.push('Evolution Catalyst: matching it advanced an Evolution.');
    else if (tag === 'On fire') notes.push('On fire: had been scorching the board before you matched it.');
    else if (tag === 'Face-down') notes.push('Was hidden face-down before this Set.');
    else if (tag === 'Fused') notes.push('Had an active fuse/countdown timer.');
    else if (tag.startsWith('Armored ')) notes.push(`${tag}: armored card on the board.`);
    else if (tag.endsWith('¢')) notes.push(`Gold card (${tag}): paid bonus coins when matched.`);
    else if (tag === 'Dud') notes.push('Dud card: corrupted board card.');
  }
  const summary = bonus > 0
    ? `Contributed ${points} dmg (${base} base + ${bonus} bonus on this card).`
    : `Contributed ${points} base dmg to the Set.`;
  return { title, points, base, bonus, summary, notes };
};

/** The Set's own hit as an itemized receipt: matched cards + card bonuses + itemized Set bonuses -> subtotal -> multipliers & Power = Set hit. */
export const setMathRows = (
  m: FightLogSetMath,
  ctx?: { lines?: readonly FightLogLine[]; cards?: readonly FightLogCard[]; held?: readonly string[] }
): MathRow[] => {
  const rows: MathRow[] = [];
  const cardCount = m.cardCount ?? ctx?.cards?.length ?? 3;
  const baseCards = m.baseCards ?? Math.min(m.cards, cardCount);
  const cardBonus = m.cardBonus ?? Math.max(0, m.cards - baseCards);
  rows.push({
    label: `${cardCount} matched cards (${fmt(cardCount > 0 ? baseCards / cardCount : 1)} dmg each)`,
    value: fmt(baseCards),
    explain: `You matched ${cardCount} cards (a Set is always ${cardCount} cards). Every card in a Set starts at 1 base damage.`,
  });
  if (cardBonus > 0) {
    let note = m.cardBonusNote;
    if (!note && ctx?.cards) {
      const boosted = ctx.cards.map(loggedCardBonus).filter(n => n > 0);
      if (boosted.length > 0) {
        note = `${boosted.length} boosted card${boosted.length === 1 ? '' : 's'} (+${boosted.reduce((a, b) => a + b, 0)} printed on card${boosted.length === 1 ? '' : 's'})`;
      }
    }
    rows.push({
      label: 'Bonus on those cards',
      value: `+${fmt(cardBonus)}`,
      sub: note ?? 'Power cards or charge on matched cards',
      explain: `Special cards like Power cards hold extra damage right on the card itself. Adding that +${fmt(cardBonus)} to the ${fmt(baseCards)} base card points gives ${fmt(m.cards)} from your 3 cards.`,
    });
  }
  // Unified logs put Shading Surge ×5 directly inside multItems (after additions);
  // legacy logs omitted Surge from multItems and multiplied cards + collateral before flatBonus.
  const surgeInMult = (m.multItems ?? []).some(it => it.label.toLowerCase().includes('surge'));
  const legacyPreSurge = !surgeInMult && m.surgeMultiplier && m.surgeMultiplier !== 1 ? m.surgeMultiplier : 1;
  if (legacyPreSurge !== 1) {
    rows.push({
      label: 'Shading Surge',
      value: `×${fmt(legacyPreSurge)}`,
      sub: 'multiplied the matched card points',
      explain: 'Shading Surge multiplied your matched-card damage before adding per-Set bonuses.',
    });
  }
  for (const [kind, pts] of Object.entries(m.collateral)) {
    if (pts) {
      rows.push({
        label: COLLATERAL_LABEL[kind] ?? kind,
        value: `+${fmt(pts)}`,
        explain: 'Extra board cards destroyed along with your Set count toward the Set hit.',
      });
    }
  }

  // Flat per-Set bonuses (itemized for v0.1.119, or reconstructed from lines for legacy v0.1.118)
  if (m.flatItems && m.flatItems.length > 0) {
    let accounted = 0;
    for (const item of m.flatItems) {
      if (item.amount === 0) continue;
      accounted += item.amount;
      rows.push({
        label: item.label,
        value: signed(item.amount),
        ...(item.note ? { sub: item.note } : {}),
        ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}),
        explain: item.sourceRef
          ? `${item.label} added ${signed(item.amount)} flat damage to this Set${item.note ? ` (${item.note})` : ''}. Tap below to inspect the source.`
          : `${item.label} added ${signed(item.amount)} flat damage to this Set${item.note ? ` (${item.note})` : ''}.`,
      });
    }
    const diff = Math.round((m.flatBonus - accounted) * 10) / 10;
    if (Math.abs(diff) >= 0.1) {
      rows.push({
        label: 'Other per-Set bonuses',
        value: signed(diff),
        explain: 'Additional flat damage active for this Set.',
      });
    }
  } else if (m.flatBonus !== 0) {
    const recovered: MathRow[] = [];
    let accounted = 0;
    for (const l of ctx?.lines ?? []) {
      if (l.type === 'rule' && l.amount !== undefined && !isMultiplier(l) && Number.isFinite(l.amount) && l.amount !== 0) {
        const clean = (l.text ?? 'Rule bonus').replace(/!$/, '');
        const owner = !l.sourceRef && ctx?.held ? ownerOfEvent(l.type, l.text, ctx.held) : null;
        const sourceRef = l.sourceRef ?? LEGACY_TRICK_REF[clean] ?? (owner ? `weapon:${owner}` : undefined);
        accounted += l.amount;
        recovered.push({
          label: clean,
          value: signed(l.amount),
          ...(sourceRef ? { sourceRef } : {}),
          explain: `${clean} added ${signed(l.amount)} flat damage to this Set before multipliers.`,
        });
      } else if (l.type === 'grudge_release' && l.amount) {
        accounted += l.amount;
        recovered.push({ label: 'Grudge release', value: signed(l.amount), sub: 'stored mistakes released' });
      } else if (l.type === 'patience' && l.amount) {
        accounted += l.amount;
        recovered.push({ label: 'Patience', value: signed(l.amount), sub: 'slow careful Set bonus' });
      }
    }
    rows.push(...recovered);
    const rem = Math.round((m.flatBonus - accounted) * 10) / 10;
    if (Math.abs(rem) >= 0.1) {
      rows.push({
        label: recovered.length > 0 ? 'Other per-Set bonuses' : 'Per-Set bonuses',
        value: signed(rem),
        explain: 'Flat per-Set damage from your weapons, skill tree, passives, and Workshop upgrades added before multipliers.',
      });
    }
  }

  const collateralTotal = Object.values(m.collateral).reduce((s, n) => s + (n ?? 0), 0);
  const preMult = Math.max(0, Math.round(((m.cards + collateralTotal) * legacyPreSurge + m.flatBonus) * 10) / 10);
  const hasScalingAfter = m.multiplier !== 1 || m.extra !== 0 || (m.powerMultiplier ?? 1) > 1;
  if (hasScalingAfter && (cardBonus > 0 || m.flatBonus !== 0 || collateralTotal > 0)) {
    rows.push({
      label: 'Subtotal before multipliers',
      value: fmt(preMult),
      subtotal: true,
      explain: `All your card points and flat bonuses added together before multipliers applied (= ${fmt(preMult)}).`,
    });
  }

  if (m.multItems && m.multItems.length > 0) {
    for (const item of m.multItems) {
      rows.push({
        label: item.label,
        value: `×${fmt(item.amount)}`,
        ...(item.note ? { sub: item.note } : {}),
        ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}),
        explain: `${item.label} multiplied this Set by ×${fmt(item.amount)}${item.note ? ` (${item.note})` : ''}.`,
      });
    }
  } else if (m.multiplier !== 1) {
    rows.push({
      label: m.rainbow ? 'Multiplier (Rainbow bonus and others)' : 'Multiplier',
      value: `×${fmt(m.multiplier)}`,
      ...(m.rainbow ? { sub: 'all traits differed in this Set' } : {}),
      explain: m.rainbow
        ? 'Your Rainbow gear multiplied Set damage alongside any other Set multipliers.'
        : 'Multiplies your card points and flat per-Set bonuses together.',
    });
  }

  if (m.extraItems && m.extraItems.length > 0) {
    for (const item of m.extraItems) {
      rows.push({
        label: item.label,
        value: signed(item.amount),
        ...(item.note ? { sub: item.note } : {}),
        ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}),
        explain: `${item.label} was added after Set multipliers and then scaled by Power.`,
      });
    }
  } else if (m.extra) {
    rows.push({
      label: 'Purity & traps',
      value: `+${fmt(m.extra)}`,
      explain: 'Purity chain and trap-clearing bonus damage added after Set multipliers.',
    });
  }

  if (m.powerMultiplier && m.powerMultiplier > 1) {
    rows.push({
      label: 'Power',
      value: `×${fmt(m.powerMultiplier)}`,
      sub: 'fight-wide multiplier · tap to explain',
      isPower: true,
      powerPoints: m.powerPoints,
      powerMultiplier: m.powerMultiplier,
    });
  }
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
export const entrySummary = (e: FightLogEntry, held: readonly string[] = []): string => {
  if (e.kind === 'set' && e.set) {
    const bits = [e.set.rainbow ? 'Rainbow' : `${e.set.diffTraits} trait${e.set.diffTraits === 1 ? '' : 's'} differ`];
    if (e.set.surgeMultiplier && e.set.surgeMultiplier > 1) bits.push(`Surge ×${fmt(e.set.surgeMultiplier)}`);
    if (e.set.graceUsed) bits.push('grace');
    const triggers = describeLines(e.lines, held, { excludeSetMathRules: true }).filter(l => l.damage).map(l => l.source ?? l.label);
    if (triggers.length) bits.push([...new Set(triggers)].slice(0, 2).join(', '));
    return bits.join(' · ');
  }
  if (e.kind === 'mistake') return e.heartsDelta < 0 ? `lost ${plural(-e.heartsDelta, 'heart')}` : 'no heart lost';
  const lines = describeLines(e.lines, held);
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
