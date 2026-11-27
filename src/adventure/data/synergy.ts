/**
 * The 15-Node Synergy Graph & Base-Level Scaling Hooks for all 64 Armory Weapons.
 *
 * Replaces global `POWER ×N` with genuine Brotato / Clair Obscur-inspired
 * weapon synergy scaling: every Armory weapon produces, consumes, or amplifies
 * shared live fight attributes (`RunState.synergy`), so belts form emergent,
 * self-reinforcing contraptions.
 *
 * Single source of truth consumed by:
 *  - Combat engine (`engine/run.ts`, `engine/fight.ts`, `rules/engine.ts`)
 *  - Weapon UI (`WeaponExplainer.tsx`, Armory Synergy filters, Spire offers)
 *  - Auto-build & Synergy scoring (`loadout.ts`, `loadoutPresets.ts`)
 *  - Balance fingerprints (`src/analytics/balanceFingerprints.ts`)
 */
import type {
  FightMetrics,
  SynergyAttrDef,
  SynergyAttrId,
  SynergyCounters,
  SynergyHook,
  WeaponSynergyProfile,
} from '../types';
import type { Modifiers, Rule } from '../rules/types';

export type { SynergyAttrDef, SynergyAttrId, SynergyCounters, SynergyHook, WeaponSynergyProfile };

/** Canonical ordered list of all 15 Synergy Graph attributes. */
export const SYNERGY_ATTR_IDS: readonly SynergyAttrId[] = [
  'field_size',
  'destruction',
  'marks',
  'coins',
  'burn',
  'links',
  'holo',
  'graces',
  'hints',
  'vitality',
  'streaks',
  'hazards',
  'parries',
  'prism',
  'echoes',
] as const;

/** Canonical visual & copy metadata for all 15 Synergy Graph attributes (15/15 verified ICON_REGISTRY keys). */
export const SYNERGY_ATTR_META: Readonly<Record<SynergyAttrId, SynergyAttrDef>> = {
  field_size: {
    id: 'field_size',
    label: 'Field',
    icon: 'lorc/field',
    color: '#15803D',
    paleBg: '#DCFCE7',
    description: 'Extra cards on the board beyond 12.',
  },
  destruction: {
    id: 'destruction',
    label: 'Blast',
    icon: 'lorc/bright-explosion',
    color: '#EA580C',
    paleBg: '#FFEDD5',
    description: 'Extra cards destroyed by blasts, lasers, ricochets, links, burns, and twins.',
  },
  marks: {
    id: 'marks',
    label: 'Marks',
    icon: 'lorc/archery-target',
    color: '#DC2626',
    paleBg: '#FEE2E2',
    description: 'Marked, Wanted, Piñata, Chained, Decoy, Hot, and Synergy-marked cards resolved.',
  },
  coins: {
    id: 'coins',
    label: 'Coins',
    icon: 'lorc/crown-coin',
    color: '#B45309',
    paleBg: '#FEF3C7',
    description: 'Battle coins earned during this fight from Gold cards, weapons, Parries, and Overkill.',
  },
  burn: {
    id: 'burn',
    label: 'Burn',
    icon: 'lorc/campfire',
    color: '#C2410C',
    paleBg: '#FFEDD5',
    description: 'Cards burned out this fight plus 2× currently burning cards on the board.',
  },
  links: {
    id: 'links',
    label: 'Links',
    icon: 'lorc/linked-rings',
    color: '#0F766E',
    paleBg: '#CCFBF1',
    description: 'Linked cards destroyed this fight plus 2× currently active link pairs.',
  },
  holo: {
    id: 'holo',
    label: 'Holo',
    icon: 'delapouite/sparkles',
    color: '#7C3AED',
    paleBg: '#F3E8FF',
    description: 'Holographic cards (+4 base & ×1.2 mult) matched this fight plus live Holo cards on board.',
  },
  graces: {
    id: 'graces',
    label: 'Graces',
    icon: 'lorc/clover',
    color: '#047857',
    paleBg: '#D1FAE5',
    description: 'Graces held right now plus Grace saves triggered this fight.',
  },
  hints: {
    id: 'hints',
    label: 'Hints',
    icon: 'lorc/light-bulb',
    color: '#A16207',
    paleBg: '#FEF9C3',
    description: 'Hints held right now plus Hints used and hinted Sets completed.',
  },
  vitality: {
    id: 'vitality',
    label: 'Vitality',
    icon: 'lorc/shining-heart',
    color: '#BE123C',
    paleBg: '#FFE4E6',
    description: 'Heals, overheals, Over-Shields gained, and bonus max hearts above 3.',
  },
  streaks: {
    id: 'streaks',
    label: 'Streaks',
    icon: 'lorc/power-lightning',
    color: '#1D4ED8',
    paleBg: '#DBEAFE',
    description: 'Current unbroken clean Set streak plus active Speed Combo steps.',
  },
  hazards: {
    id: 'hazards',
    label: 'Hazards',
    icon: 'lorc/time-bomb',
    color: '#991B1B',
    paleBg: '#FEE2E2',
    description: 'Traps, bombs, snares, duds, curses, thorns, fuses, fog, and frost conquered.',
  },
  parries: {
    id: 'parries',
    label: 'Parries',
    icon: 'lorc/shield-reflect',
    color: '#0369A1',
    paleBg: '#E0F2FE',
    description: 'Parries (+1), Perfect Parries (+2), and Sets landed while the foe is Staggered (+1).',
  },
  prism: {
    id: 'prism',
    label: 'Prism',
    icon: 'lorc/rainbow-star',
    color: '#9333EA',
    paleBg: '#F3E8FF',
    description: 'Rainbow Sets (+2), 4-diff Sets, Purity steps, Clarity simplifies, and Album pages.',
  },
  echoes: {
    id: 'echoes',
    label: 'Echoes',
    icon: 'lorc/echo-ripples',
    color: '#2563EB',
    paleBg: '#DBEAFE',
    description: 'Echo Sets, Auto-Sets, and Doubled weapon triggers fired this fight.',
  },
};

export const createInitialSynergyCounters = (boardSize = 12): SynergyCounters => ({
  field_size: Math.max(0, boardSize - 12),
  destruction: 0,
  marks: 0,
  coins: 0,
  burn: 0,
  links: 0,
  holo: 0,
  graces: 0,
  hints: 0,
  vitality: 0,
  streaks: 0,
  hazards: 0,
  parries: 0,
  prism: 0,
  echoes: 0,
});

export const createInitialFightMetrics = (boardSize = 12): FightMetrics => ({
  synergy: createInitialSynergyCounters(boardSize),
  synergyPeak: createInitialSynergyCounters(boardSize),
  sets: 0,
  rainbows: 0,
  sameColorSets: 0,
  colorSets: { red: 0, green: 0, purple: 0 },
  sameShapeSets: 0,
  oneDiffSets: 0,
  numberOnlyDiffSets: 0,
  numberTriadSets: 0,
  purityChains: 0,
  threeStepPurities: 0,
  maxBaseDamage: 0,
  maxSingleHit: 0,
  maxOverkill: 0,
  maxBoardSize: boardSize,
  maxCardsDestroyedInSet: 0,
  maxCleanStreak: 0,
  maxCombo: 0,
  quickSets: 0,
  patientSets: 0,
  surgeSets: 0,
  hintedSets: 0,
  hintsUsed: 0,
  gracesSaved: 0,
  heals: 0,
  overheals: 0,
  heartsLost: 0,
  mistakes: 0,
  blasts: 0,
  lasers: 0,
  burns: 0,
  cardsBurned: 0,
  ricochets: 0,
  maxRicochetChain: 0,
  echoes: 0,
  doubleEchoes: 0,
  linksCreated: 0,
  linksDestroyed: 0,
  powerCards: 0,
  goldCards: 0,
  holoCards: 0,
  bonusCardsMatched: 0,
  pinatasBroken: 0,
  trapsDefused: 0,
  parries: 0,
  perfectParries: 0,
  timeGainedSec: 0,
  xpGained: 0,
  levelUps: 0,
  shopBuys: 0,
  doubledTriggers: 0,
  simplifies: 0,
  freezes: 0,
  evolutionsTriggered: 0,
  maxSimultaneousEvos: 0,
  distinctWeaponsEvolved: 0,
  weaponEvos: {},
  trickPayouts: {},
  ownTriggers: {},
});

// ─── Authoring helpers for all 64 Armory weapon Synergy profiles ────────────

const lvVal = (base: number, perLevel: number, level: number): number =>
  Math.round((base + perLevel * Math.max(0, Math.min(4, Math.floor(level) - 1))) * 100) / 100;

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

const dmgHook = (
  id: string,
  attr: SynergyAttrId,
  base: number,
  perLevel: number,
  opts?: { step?: number; cap?: number; role?: SynergyHook['role']; liveSource?: SynergyHook['liveSource']; label?: string }
): SynergyHook => {
  const step = opts?.step ?? 1;
  const cap = opts?.cap;
  const attrName = opts?.label ?? SYNERGY_ATTR_META[attr].label;
  return {
    id,
    attr,
    role: opts?.role ?? 'consumer',
    step,
    ...(cap !== undefined ? { cap } : {}),
    ...(opts?.liveSource ? { liveSource: opts.liveSource } : {}),
    baseDamagePerStep: { base, perLevel },
    summary: lv => {
      const v = lvVal(base, perLevel, lv);
      const unit = step > 1 ? `${step} ${attrName}` : attrName;
      return `+${fmt(v)} Set base dmg per ${unit}${cap ? ` (max ${cap}×)` : ''}`;
    },
  };
};

const edgeHook = (
  id: string,
  attr: SynergyAttrId,
  role: SynergyHook['role'],
  summaryText: string | ((lv: number) => string),
  crossEdgeRule?: Rule,
  modPerStep?: SynergyHook['modPerStep'],
  opts?: { step?: number; cap?: number }
): SynergyHook => ({
  id,
  attr,
  role,
  ...(opts?.step ? { step: opts.step } : {}),
  ...(opts?.cap ? { cap: opts.cap } : {}),
  ...(crossEdgeRule ? { crossEdgeRule } : {}),
  ...(modPerStep ? { modPerStep } : {}),
  summary: typeof summaryText === 'function' ? summaryText : () => summaryText,
});

/**
 * Base-level Synergy Graph profiles covering ALL 64 Armory weapons.
 * Every weapon declares 1–3 concrete scaling hooks (base damage scaling + cross-edge production/amplification).
 */
export const WEAPON_SYNERGY_PROFILES: Readonly<Record<string, WeaponSynergyProfile>> = {
  // ── 1. Damage (9) ─────────────────────────────────────────────────────────
  'blast-powder': {
    weaponId: 'blast-powder',
    produces: ['destruction'],
    consumes: ['destruction', 'burn'],
    hooks: [
      dmgHook('bp-destr', 'destruction', 0.5, 0.2, { step: 2, cap: 20 }),
      edgeHook(
        'bp-burn-edge',
        'burn',
        'amplifier',
        lv => `Blasts while cards burn ignite +1 card & hit +${fmt(lvVal(3, 1, lv))} scorch dmg`,
        {
          trigger: { on: 'weapon', kind: 'explosion' },
          when: [{ kind: 'synergyAtLeast', attr: 'burn', n: 1 }],
          effects: [{ do: 'damage', amount: 4 }, { do: 'ignite', count: 1 }],
          callout: 'Scorch!',
        }
      ),
    ],
  },
  'flint-spark': {
    weaponId: 'flint-spark',
    produces: ['burn'],
    consumes: ['burn', 'destruction'],
    amplifies: ['burn'],
    hooks: [
      dmgHook('fs-burn', 'burn', 0.6, 0.2, { cap: 25 }),
      edgeHook(
        'fs-destr-ignite',
        'destruction',
        'producer',
        'Every 3rd Set with 5+ Blast ignites 1 bonus card',
        {
          trigger: { on: 'everyNthSet', n: 3 },
          when: [{ kind: 'synergyAtLeast', attr: 'destruction', n: 5 }],
          effects: [{ do: 'ignite', count: 1 }],
          callout: 'Sparks!',
        }
      ),
    ],
  },
  'prismatic-ray': {
    weaponId: 'prismatic-ray',
    produces: ['destruction'],
    consumes: ['prism', 'holo'],
    hooks: [
      dmgHook('pr-prism', 'prism', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'pr-holo-beam',
        'holo',
        'consumer',
        lv => `Sets with a Holo card hit +${fmt(lvVal(4, 1, lv))} & have 30% chance to fire a row laser`,
        {
          trigger: { on: 'holoMatched' },
          effects: [{ do: 'damage', amount: 5 }],
          callout: 'Refract!',
        }
      ),
    ],
  },
  'chaos-shard': {
    weaponId: 'chaos-shard',
    produces: ['destruction'],
    consumes: ['destruction', 'echoes'],
    hooks: [
      dmgHook('cs-destr', 'destruction', 0.4, 0.2, { step: 2, cap: 20 }),
      edgeHook(
        'cs-echo-bounce',
        'echoes',
        'consumer',
        'Every Echo fires +1 free ricochet across the board',
        {
          trigger: { on: 'weapon', kind: 'echo' },
          effects: [{ do: 'ricochet', count: 1 }],
          callout: 'Ricochet!',
        }
      ),
    ],
  },
  'rainbow-charm': {
    weaponId: 'rainbow-charm',
    produces: ['prism'],
    consumes: ['prism', 'holo'],
    hooks: [
      dmgHook('rc-prism', 'prism', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'rc-holo-rainbow',
        'holo',
        'amplifier',
        lv => `Holo cards inside a Rainbow Set add +${fmt(lvVal(8, 2, lv))} bonus base dmg`,
        {
          trigger: { on: 'rainbow' },
          when: [{ kind: 'holoInSet' }],
          effects: [{ do: 'damage', amount: 8 }],
          callout: 'Holo Prism!',
        }
      ),
    ],
  },
  'war-drum': {
    weaponId: 'war-drum',
    produces: ['streaks'],
    consumes: ['streaks', 'parries'],
    hooks: [
      dmgHook('wd-streaks', 'streaks', 1.2, 0.4, { cap: 14 }),
      edgeHook(
        'wd-parry-beat',
        'parries',
        'consumer',
        lv => `Parries empower the whole board +${fmt(lvVal(2, 0.5, lv))} & add +1 Combo`,
        {
          trigger: { on: 'parry' },
          effects: [{ do: 'empowerBoard', amount: 2 }, { do: 'comboStep', amount: 1 }],
          callout: 'War Beat!',
        }
      ),
    ],
  },
  'rally-horn': {
    weaponId: 'rally-horn',
    produces: ['parries'],
    consumes: ['parries', 'streaks'],
    hooks: [
      dmgHook('rh-parries', 'parries', 3.0, 1.0, { cap: 10 }),
      edgeHook(
        'rh-parry-rally',
        'parries',
        'amplifier',
        'Every Parry blasts a Rally fanfare (+10 base dmg)',
        {
          trigger: { on: 'parry' },
          effects: [{ do: 'damage', amount: 10 }],
          callout: 'Rally!',
        }
      ),
    ],
  },
  pinata: {
    weaponId: 'pinata',
    produces: ['marks', 'destruction'],
    consumes: ['marks', 'destruction'],
    hooks: [
      dmgHook('pin-marks', 'marks', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'pin-break-marks',
        'destruction',
        'producer',
        'Breaking a Piñata drops +3 battle coins & marks 1 card',
        {
          trigger: { on: 'cardBroken' },
          effects: [{ do: 'coins', amount: 3 }, { do: 'markCard', count: 1 }],
          callout: 'Candy!',
        }
      ),
    ],
  },
  'amplifier-coil': {
    weaponId: 'amplifier-coil',
    produces: ['echoes'],
    consumes: ['echoes'],
    amplifies: ['echoes'],
    hooks: [
      dmgHook('ac-echoes', 'echoes', 2.0, 0.6, { cap: 14 }),
      edgeHook(
        'ac-charge-evo',
        'echoes',
        'amplifier',
        'Every 3rd Echo/doubled trigger charges all evolutions +1 tick',
        {
          trigger: { on: 'weapon', kind: 'echo' },
          when: [{ kind: 'chance', pct: 35 }],
          effects: [{ do: 'chargeEvolution', target: 'all', amount: 1 }],
          callout: 'Overvolt!',
        }
      ),
    ],
  },

  // ── 2. Chains: Echoes & Links (7) ─────────────────────────────────────────
  'echo-stone': {
    weaponId: 'echo-stone',
    produces: ['echoes'],
    consumes: ['echoes', 'streaks'],
    hooks: [
      dmgHook('es-echoes', 'echoes', 2.0, 0.6, { cap: 14 }),
      edgeHook(
        'es-streak-luck',
        'streaks',
        'consumer',
        '+2% weapon luck per 3 Streaks',
        undefined,
        { key: 'luckPct', base: 2, perLevel: 0.5 },
        { step: 3, cap: 8 }
      ),
    ],
  },
  'chain-reaction': {
    weaponId: 'chain-reaction',
    produces: ['echoes', 'streaks'],
    consumes: ['echoes', 'streaks'],
    hooks: [
      dmgHook('cr-echoes', 'echoes', 1.5, 0.5, { cap: 16 }),
      dmgHook('cr-streaks', 'streaks', 1.0, 0.3, { cap: 12 }),
    ],
  },
  'cascade-core': {
    weaponId: 'cascade-core',
    produces: ['echoes', 'burn'],
    consumes: ['burn', 'echoes'],
    hooks: [
      dmgHook('cc-burn', 'burn', 1.0, 0.3, { cap: 16 }),
      edgeHook(
        'cc-burn-echo',
        'echoes',
        'producer',
        'Burned cards have a 12% chance to fire a free Echo',
        {
          trigger: { on: 'cardBurned' },
          when: [{ kind: 'chance', pct: 12 }],
          effects: [{ do: 'trigger', kind: 'echo' }],
          callout: 'Wildfire!',
        }
      ),
    ],
  },
  connector: {
    weaponId: 'connector',
    produces: ['links', 'marks'],
    consumes: ['links'],
    hooks: [
      dmgHook('con-links', 'links', 0.8, 0.25, { cap: 24 }),
      edgeHook(
        'con-link-mark',
        'marks',
        'producer',
        'Destroying linked cards has a 25% chance to mark 1 card',
        {
          trigger: { on: 'linkDestroyed' },
          when: [{ kind: 'chance', pct: 25 }],
          effects: [{ do: 'markCard', count: 1 }],
        }
      ),
    ],
  },
  'web-weaver': {
    weaponId: 'web-weaver',
    produces: ['links'],
    consumes: ['links', 'field_size'],
    hooks: [
      dmgHook('ww-live-links', 'links', 1.0, 0.3, { liveSource: 'liveLinks', cap: 12, label: 'active Link' }),
      edgeHook(
        'ww-field-web',
        'field_size',
        'producer',
        'Wave start with 15+ board cards weaves +1 extra opening link',
        {
          trigger: { on: 'waveStart' },
          when: [{ kind: 'boardAtLeast', n: 15 }],
          effects: [{ do: 'link', count: 1 }],
          callout: 'Wide Web!',
        }
      ),
    ],
  },
  'neural-network': {
    weaponId: 'neural-network',
    produces: ['links', 'holo'],
    consumes: ['links'],
    hooks: [
      dmgHook('nn-links', 'links', 0.7, 0.2, { cap: 24 }),
      edgeHook(
        'nn-link-holo',
        'holo',
        'producer',
        'Destroyed linked cards have a 25% chance to turn 1 board card Holo',
        {
          trigger: { on: 'linkDestroyed' },
          when: [{ kind: 'chance', pct: 25 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Holo Link!',
        }
      ),
    ],
  },
  'echo-chamber': {
    weaponId: 'echo-chamber',
    produces: ['links', 'echoes'],
    consumes: ['links', 'echoes'],
    hooks: [
      dmgHook('ec-links', 'links', 0.8, 0.25, { cap: 20 }),
      edgeHook(
        'ec-link-echo',
        'echoes',
        'producer',
        'Destroyed linked cards have a 15% chance to fire an Echo Set',
        {
          trigger: { on: 'linkDestroyed' },
          when: [{ kind: 'chance', pct: 15 }],
          effects: [{ do: 'trigger', kind: 'echo' }],
          callout: 'Resonate!',
        }
      ),
    ],
  },

  // ── 3. Board (4) ──────────────────────────────────────────────────────────
  'field-stone': {
    weaponId: 'field-stone',
    produces: ['field_size', 'holo'],
    consumes: ['field_size'],
    hooks: [
      dmgHook('fst-field', 'field_size', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'fst-overflow-holo',
        'holo',
        'producer',
        'At 15+ cards, wave start & every 4th Set converts 1 card to Holo',
        {
          trigger: { on: 'everyNthSet', n: 4 },
          when: [{ kind: 'boardAtLeast', n: 15 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Holo Field!',
        }
      ),
    ],
  },
  'growth-seed': {
    weaponId: 'growth-seed',
    produces: ['field_size'],
    consumes: ['field_size', 'holo'],
    hooks: [
      dmgHook('gs-field', 'field_size', 1.2, 0.4, { cap: 12 }),
      edgeHook(
        'gs-holo-bloom',
        'holo',
        'amplifier',
        'Matching a Holo card empowers the entire board +1',
        {
          trigger: { on: 'holoMatched' },
          effects: [{ do: 'empowerBoard', amount: 1 }],
          callout: 'Holo Bloom!',
        }
      ),
    ],
  },
  'clarity-lens': {
    weaponId: 'clarity-lens',
    produces: ['prism', 'holo'],
    consumes: ['prism', 'field_size'],
    hooks: [
      dmgHook('cl-field', 'field_size', 1.0, 0.3, { cap: 12 }),
      edgeHook(
        'cl-simplify-holo',
        'holo',
        'producer',
        'Every 5th Set converts 1 card to Holo and deals +6 prism dmg',
        {
          trigger: { on: 'everyNthSet', n: 5 },
          effects: [{ do: 'convert', to: 'holo', count: 1 }, { do: 'damage', amount: 6 }],
          callout: 'Prism Focus!',
        }
      ),
    ],
  },
  'wild-card': {
    weaponId: 'wild-card',
    produces: ['holo', 'prism'],
    consumes: ['field_size', 'holo'],
    hooks: [
      dmgHook('wc-field', 'field_size', 1.0, 0.35, { cap: 12 }),
      edgeHook(
        'wc-wild-empower',
        'holo',
        'producer',
        'Matching a Wild Card empowers the board +2 & turns 1 card Holo',
        {
          trigger: { on: 'trick', kind: 'wild' },
          effects: [{ do: 'empowerBoard', amount: 2 }, { do: 'convert', to: 'holo', count: 1 }],
          callout: 'Wild Holo!',
        }
      ),
    ],
  },

  // ── 4. Survival: Hearts & Graces (9) ──────────────────────────────────────
  'mending-charm': {
    weaponId: 'mending-charm',
    produces: ['vitality', 'holo'],
    consumes: ['vitality'],
    hooks: [
      dmgHook('mc-vit', 'vitality', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'mc-overheal-holo',
        'holo',
        'producer',
        'Overhealing at full hearts converts 1 card to Holo',
        {
          trigger: { on: 'healed' },
          when: [{ kind: 'heartsFull' }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Radiant!',
        }
      ),
    ],
  },
  'life-vessel': {
    weaponId: 'life-vessel',
    produces: ['vitality'],
    consumes: ['vitality'],
    hooks: [
      dmgHook('lv-hearts', 'vitality', 1.2, 0.4, { liveSource: 'currentHearts', cap: 12, label: 'Heart' }),
      edgeHook(
        'lv-full-wave',
        'vitality',
        'amplifier',
        'Wave starts at full HP hit for +6 Vitality shockwave',
        {
          trigger: { on: 'waveStart' },
          when: [{ kind: 'heartsFull' }],
          effects: [{ do: 'damage', amount: 6 }],
          callout: 'Full Vigor!',
        }
      ),
    ],
  },
  'life-link': {
    weaponId: 'life-link',
    produces: ['vitality', 'destruction'],
    consumes: ['vitality', 'destruction'],
    hooks: [
      dmgHook('ll-vit', 'vitality', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'll-destr-shield',
        'destruction',
        'producer',
        'Blasts while at full hearts have a 25% chance to grant +1 Over-Shield',
        {
          trigger: { on: 'weapon', kind: 'explosion' },
          when: [{ kind: 'heartsFull' }, { kind: 'chance', pct: 25 }],
          effects: [{ do: 'shield', count: 1 }],
          callout: 'Heart Ward!',
        }
      ),
    ],
  },
  'soul-harvest': {
    weaponId: 'soul-harvest',
    produces: ['destruction', 'vitality'],
    consumes: ['vitality', 'destruction'],
    hooks: [
      dmgHook('sh-vit', 'vitality', 1.0, 0.35, { cap: 14 }),
      dmgHook('sh-destr', 'destruction', 0.6, 0.2, { step: 2, cap: 16 }),
    ],
  },
  'revenge-linker': {
    weaponId: 'revenge-linker',
    produces: ['links', 'hazards'],
    consumes: ['hazards', 'links'],
    hooks: [
      dmgHook('rl-hazards', 'hazards', 1.2, 0.4, { cap: 16 }),
      dmgHook('rl-links', 'links', 0.8, 0.25, { cap: 16 }),
    ],
  },
  'second-chance': {
    weaponId: 'second-chance',
    produces: ['graces'],
    consumes: ['graces'],
    amplifies: ['graces'],
    hooks: [
      dmgHook('sc-graces', 'graces', 1.8, 0.5, { cap: 12 }),
      edgeHook(
        'sc-grace-luck',
        'graces',
        'amplifier',
        lv => `+${fmt(lvVal(3, 1, lv))}% weapon luck per Grace synergy stack`,
        undefined,
        { key: 'luckPct', base: 3, perLevel: 1 },
        { cap: 10 }
      ),
    ],
  },
  'fortune-token': {
    weaponId: 'fortune-token',
    produces: ['graces', 'coins'],
    consumes: ['graces'],
    hooks: [
      dmgHook('ft-graces', 'graces', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'ft-grace-coins',
        'coins',
        'producer',
        'Every Grace gained drops +3 battle coins',
        {
          trigger: { on: 'weapon', kind: 'grace' },
          effects: [{ do: 'coins', amount: 3 }],
          callout: '+3¢!',
        }
      ),
    ],
  },
  'grace-conduit': {
    weaponId: 'grace-conduit',
    produces: ['graces', 'destruction'],
    consumes: ['graces', 'parries'],
    hooks: [
      dmgHook('gc-graces', 'graces', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'gc-parry-grace',
        'parries',
        'producer',
        'Parries have a 50% chance to grant +1 Grace & fire a row laser',
        {
          trigger: { on: 'parry' },
          when: [{ kind: 'chance', pct: 50 }],
          effects: [{ do: 'grace', amount: 1 }, { do: 'laser', area: { shape: 'row' } }],
          callout: 'Grace Beam!',
        }
      ),
    ],
  },
  'chaos-conduit': {
    weaponId: 'chaos-conduit',
    produces: ['destruction', 'graces'],
    consumes: ['graces', 'destruction'],
    hooks: [
      dmgHook('chc-graces', 'graces', 1.2, 0.4, { cap: 12 }),
      dmgHook('chc-destr', 'destruction', 0.4, 0.15, { step: 2, cap: 16 }),
    ],
  },

  // ── 5. Insight: Hints, Coins & XP (8) ─────────────────────────────────────
  'seeker-lens': {
    weaponId: 'seeker-lens',
    produces: ['hints'],
    consumes: ['hints'],
    hooks: [
      dmgHook('sl-hints', 'hints', 1.2, 0.4, { cap: 14 }),
      edgeHook(
        'sl-hint-power',
        'hints',
        'producer',
        'Every 3rd Set made on a hint converts 1 card to Power (+5)',
        {
          trigger: { on: 'everyNthSet', n: 3 },
          when: [{ kind: 'hintedSet' }],
          effects: [{ do: 'convert', to: 'power', count: 1 }],
          callout: 'Found!',
        }
      ),
    ],
  },
  'crystal-orb': {
    weaponId: 'crystal-orb',
    produces: ['hints', 'holo'],
    consumes: ['hints'],
    hooks: [
      dmgHook('co-hints', 'hints', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'co-hint-holo',
        'holo',
        'producer',
        'Spending a hint converts 1 board card to Holo',
        {
          trigger: { on: 'hintUsed' },
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Holo Sight!',
        }
      ),
    ],
  },
  'oracle-eye': {
    weaponId: 'oracle-eye',
    produces: ['hints', 'streaks'],
    consumes: ['hints', 'streaks'],
    hooks: [
      dmgHook('oe-hints', 'hints', 1.0, 0.3, { cap: 12 }),
      edgeHook(
        'oe-hint-combo',
        'streaks',
        'producer',
        'Hinted Sets deal +4 base dmg & add +1 Combo step',
        {
          trigger: { on: 'set' },
          when: [{ kind: 'hintedSet' }],
          effects: [{ do: 'damage', amount: 4 }, { do: 'comboStep', amount: 1 }],
          callout: 'Foreseen!',
        }
      ),
    ],
  },
  'mystic-sight': {
    weaponId: 'mystic-sight',
    produces: ['hints', 'marks'],
    consumes: ['hints', 'marks'],
    hooks: [
      dmgHook('ms-marks', 'marks', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'ms-hint-mark',
        'marks',
        'producer',
        'Hinted Sets mark 1 random board card',
        {
          trigger: { on: 'set' },
          when: [{ kind: 'hintedSet' }],
          effects: [{ do: 'markCard', count: 1 }],
        }
      ),
    ],
  },
  'fortunes-favor': {
    weaponId: 'fortunes-favor',
    produces: ['coins'],
    consumes: ['coins'],
    hooks: [
      dmgHook('ff-coins', 'coins', 1.0, 0.3, { step: 5, cap: 25 }),
      edgeHook(
        'ff-gold-gild',
        'coins',
        'producer',
        'Every 4th Set with 10+ Battle Coins gilds 1 card',
        {
          trigger: { on: 'everyNthSet', n: 4 },
          when: [{ kind: 'synergyAtLeast', attr: 'coins', n: 10 }],
          effects: [{ do: 'convert', to: 'gold', count: 1 }],
          callout: 'Midas!',
        }
      ),
    ],
  },
  'fortunes-blessing': {
    weaponId: 'fortunes-blessing',
    produces: ['coins', 'hints', 'holo'],
    consumes: ['coins'],
    hooks: [
      dmgHook('fb-coins', 'coins', 0.8, 0.3, { step: 5, cap: 20 }),
      edgeHook(
        'fb-wave-holo',
        'holo',
        'producer',
        'Wave starts have a 45% chance to turn 1 card Holo',
        {
          trigger: { on: 'waveStart' },
          when: [{ kind: 'chance', pct: 45 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Blessed!',
        }
      ),
    ],
  },
  'scholars-tome': {
    weaponId: 'scholars-tome',
    produces: ['hints'],
    consumes: ['hints', 'coins'],
    hooks: [
      dmgHook('st-hints', 'hints', 1.0, 0.25, { cap: 10 }),
      edgeHook(
        'st-xp-study',
        'hints',
        'amplifier',
        lv => `Every XP proc adds +${fmt(lvVal(1, 0.25, lv))} fight-long base damage`,
        {
          trigger: { on: 'weapon', kind: 'xp' },
          effects: [{ do: 'addFightBaseDamage', amount: 1 }],
        }
      ),
    ],
  },
  'wisdom-chain': {
    weaponId: 'wisdom-chain',
    produces: ['coins'],
    consumes: ['coins', 'prism'],
    hooks: [
      dmgHook('wch-coins', 'coins', 0.8, 0.25, { step: 5, cap: 20 }),
      edgeHook(
        'wch-prism-dividend',
        'prism',
        'producer',
        'Rainbow Sets grant +3 XP & +3 Battle Coins',
        {
          trigger: { on: 'rainbow' },
          effects: [{ do: 'xp', amount: 3 }, { do: 'coins', amount: 3 }],
          callout: 'Dividend!',
        }
      ),
    ],
  },

  // ── 6. Tempo: Time & Evolutions (5) ───────────────────────────────────────
  'chrono-shard': {
    weaponId: 'chrono-shard',
    produces: ['streaks'],
    consumes: ['streaks', 'parries'],
    hooks: [
      dmgHook('chs-clock', 'streaks', 1.0, 0.3, { liveSource: 'timeLeftChunks', cap: 12, label: '10s left' }),
      dmgHook('chs-streaks', 'streaks', 0.8, 0.25, { cap: 10 }),
    ],
  },
  'time-drop': {
    weaponId: 'time-drop',
    produces: ['streaks'],
    consumes: ['streaks', 'prism'],
    hooks: [
      edgeHook(
        'td-time-base',
        'streaks',
        'producer',
        lv => `Each time gain adds +${fmt(lvVal(2.5, 0.75, lv))} fight-long base dmg & extends evolutions +1s`,
        {
          trigger: { on: 'weapon', kind: 'time' },
          effects: [{ do: 'addFightBaseDamage', amount: 3 }, { do: 'extendEvolutions', ms: 1000 }],
          callout: 'Overtime!',
        }
      ),
      dmgHook('td-prism', 'prism', 1.0, 0.3, { cap: 10 }),
    ],
  },
  'temporal-rift': {
    weaponId: 'temporal-rift',
    produces: ['echoes'],
    consumes: ['echoes', 'streaks'],
    hooks: [
      dmgHook('tr-echoes', 'echoes', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'tr-time-rift',
        'streaks',
        'producer',
        'Time gains add +1 Combo & deal +6 rift damage',
        {
          trigger: { on: 'weapon', kind: 'time' },
          effects: [{ do: 'comboStep', amount: 1 }, { do: 'damage', amount: 6 }],
          callout: 'Rift!',
        }
      ),
    ],
  },
  'catalyst-prism': {
    weaponId: 'catalyst-prism',
    produces: ['prism', 'holo'],
    consumes: ['prism', 'holo'],
    amplifies: ['prism'],
    hooks: [
      dmgHook('cp-holo', 'holo', 2.0, 0.6, { cap: 14 }),
      edgeHook(
        'cp-rainbow-charge',
        'prism',
        'amplifier',
        'Rainbows convert 1 card Holo, charge all evolutions +1 tick & extend active evos +2s',
        {
          trigger: { on: 'rainbow' },
          effects: [
            { do: 'convert', to: 'holo', count: 1 },
            { do: 'chargeEvolution', target: 'all', amount: 1 },
            { do: 'extendEvolutions', ms: 2000 },
          ],
          callout: 'Prism Charge!',
        }
      ),
    ],
  },
  'encore-mask': {
    weaponId: 'encore-mask',
    produces: ['echoes'],
    consumes: ['echoes', 'parries'],
    amplifies: ['echoes'],
    hooks: [
      dmgHook('em-echoes', 'echoes', 1.5, 0.5, { cap: 12 }),
      edgeHook(
        'em-evo-finale',
        'echoes',
        'amplifier',
        'Evolutions last longer, hit harder, and replay opening effects + grant +1 head-start tick on expiry'
      ),
    ],
  },

  // ── 7. Tricks (10) ────────────────────────────────────────────────────────
  magnet: {
    weaponId: 'magnet',
    produces: ['marks', 'holo'],
    consumes: ['marks'],
    hooks: [
      dmgHook('mag-marks', 'marks', 1.2, 0.4, { cap: 18 }),
      edgeHook(
        'mag-holo-mark',
        'holo',
        'producer',
        'Every 4th Magnet match converts 1 board card to Holo',
        {
          trigger: { on: 'trick', kind: 'magnet' },
          when: [{ kind: 'chance', pct: 25 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Holo Pull!',
        }
      ),
    ],
  },
  'bounty-poster': {
    weaponId: 'bounty-poster',
    produces: ['marks', 'coins'],
    consumes: ['marks', 'coins'],
    hooks: [
      dmgHook('bp-marks', 'marks', 0.8, 0.25, { cap: 18 }),
      edgeHook(
        'bp-poster-coins',
        'coins',
        'producer',
        'Matching Wanted cards drops +2 Battle Coins',
        {
          trigger: { on: 'trick', kind: 'bounty' },
          effects: [{ do: 'coins', amount: 2 }],
        }
      ),
    ],
  },
  'mirror-shard': {
    weaponId: 'mirror-shard',
    produces: ['holo', 'echoes'],
    consumes: ['holo'],
    hooks: [
      dmgHook('msh-holo', 'holo', 1.8, 0.55, { cap: 14 }),
      edgeHook(
        'msh-mirror-holo',
        'holo',
        'producer',
        'Mirror Sets have a 35% chance to turn 1 board card Holo',
        {
          trigger: { on: 'trick', kind: 'mirror' },
          when: [{ kind: 'chance', pct: 35 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Reflected!',
        }
      ),
    ],
  },
  'odd-one-out': {
    weaponId: 'odd-one-out',
    produces: ['prism', 'marks'],
    consumes: ['prism', 'marks'],
    hooks: [
      dmgHook('ooo-prism', 'prism', 1.2, 0.4, { cap: 14 }),
      edgeHook(
        'ooo-mark',
        'marks',
        'producer',
        'Odd One Out Sets mark 1 random card',
        {
          trigger: { on: 'trick', kind: 'odd' },
          effects: [{ do: 'markCard', count: 1 }],
        }
      ),
    ],
  },
  'devils-bargain': {
    weaponId: 'devils-bargain',
    produces: ['burn'],
    consumes: ['vitality', 'burn'],
    hooks: [
      dmgHook('db-burn', 'burn', 1.0, 0.3, { cap: 16 }),
      edgeHook(
        'db-low-ignite',
        'burn',
        'producer',
        'Sets at ≤2 Hearts ignite 1 board card',
        {
          trigger: { on: 'set' },
          when: [{ kind: 'heartsAtMost', n: 2 }],
          effects: [{ do: 'ignite', count: 1 }],
          callout: 'Hellfire!',
        }
      ),
    ],
  },
  snowball: {
    weaponId: 'snowball',
    produces: ['streaks'],
    consumes: ['streaks'],
    hooks: [
      dmgHook('sb-streaks', 'streaks', 1.0, 0.3, { cap: 14 }),
      edgeHook(
        'sb-clean-empower',
        'streaks',
        'amplifier',
        'At 5+ Streaks, every 3rd Set empowers the whole board +1',
        {
          trigger: { on: 'everyNthSet', n: 3 },
          when: [{ kind: 'synergyAtLeast', attr: 'streaks', n: 5 }],
          effects: [{ do: 'empowerBoard', amount: 1 }],
          callout: 'Snowpack!',
        }
      ),
    ],
  },
  'collectors-album': {
    weaponId: 'collectors-album',
    produces: ['prism', 'holo'],
    consumes: ['prism', 'holo'],
    hooks: [
      dmgHook('ca-prism', 'prism', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'ca-album-holo',
        'holo',
        'producer',
        'Stamping an Album page has a 40% chance to turn 1 card Holo',
        {
          trigger: { on: 'trick', kind: 'album' },
          when: [{ kind: 'chance', pct: 40 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Foil Page!',
        }
      ),
    ],
  },
  'glass-sword': {
    weaponId: 'glass-sword',
    produces: ['streaks'],
    consumes: ['streaks', 'parries'],
    hooks: [
      dmgHook('gl-streaks', 'streaks', 1.0, 0.35, { cap: 14 }),
      edgeHook(
        'gl-parry-reforge',
        'parries',
        'consumer',
        'Landing a Parry immediately reforges Glass Sword & deals +6 slash dmg',
        {
          trigger: { on: 'parry' },
          effects: [{ do: 'repairGlass' }, { do: 'damage', amount: 6 }],
          callout: 'Reforged!',
        }
      ),
    ],
  },
  tightrope: {
    weaponId: 'tightrope',
    produces: ['streaks'],
    consumes: ['streaks', 'marks'],
    hooks: [
      dmgHook('trp-streaks', 'streaks', 1.2, 0.4, { cap: 14 }),
      edgeHook(
        'trp-marked-bonus',
        'marks',
        'consumer',
        'Matching a marked card adds +6 Tightrope balance damage',
        {
          trigger: { on: 'markedMatched' },
          effects: [{ do: 'damage', amount: 6 }],
          callout: 'Poise!',
        }
      ),
    ],
  },
  understudy: {
    weaponId: 'understudy',
    produces: ['echoes'],
    consumes: ['echoes'],
    amplifies: ['echoes'],
    hooks: [
      edgeHook(
        'us-copy-left',
        'echoes',
        'amplifier',
        'Copies its left neighbor’s base stats, rules, and Synergy scaling hooks'
      ),
      edgeHook(
        'us-evo-bonus',
        'echoes',
        'consumer',
        'Whenever any ally weapon evolves, deals +8 base encore strike',
        {
          trigger: { on: 'evolutionStart' },
          effects: [{ do: 'damage', amount: 8 }],
          callout: 'Cue!',
        }
      ),
    ],
  },

  // ── 8. Board Gambles (12) ─────────────────────────────────────────────────
  'cursed-idol': {
    weaponId: 'cursed-idol',
    produces: ['hazards', 'marks'],
    consumes: ['hazards'],
    hooks: [
      dmgHook('ci-hazards', 'hazards', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'ci-curse-mark',
        'marks',
        'producer',
        'Matching a lifted Curse card marks 1 board card',
        {
          trigger: { on: 'trick', kind: 'curse' },
          effects: [{ do: 'markCard', count: 1 }],
        }
      ),
    ],
  },
  'chain-gang': {
    weaponId: 'chain-gang',
    produces: ['marks', 'links'],
    consumes: ['links', 'marks'],
    hooks: [
      dmgHook('cg-links', 'links', 1.0, 0.3, { cap: 16 }),
      edgeHook(
        'cg-chain-link',
        'links',
        'producer',
        'Matching a Chained pair weaves 1 new board link',
        {
          trigger: { on: 'trick', kind: 'chain' },
          effects: [{ do: 'link', count: 1 }],
          callout: 'Chained!',
        }
      ),
    ],
  },
  'thorn-bush': {
    weaponId: 'thorn-bush',
    produces: ['hazards', 'parries'],
    consumes: ['hazards', 'parries'],
    hooks: [
      dmgHook('tb-hazards', 'hazards', 1.4, 0.4, { cap: 14 }),
      dmgHook('tb-parries', 'parries', 2.0, 0.5, { cap: 10 }),
    ],
  },
  rust: {
    weaponId: 'rust',
    produces: ['coins', 'hazards'],
    consumes: ['coins', 'hazards'],
    hooks: [
      dmgHook('ru-coins', 'coins', 0.8, 0.25, { step: 5, cap: 20 }),
      dmgHook('ru-hazards', 'hazards', 1.0, 0.3, { cap: 12 }),
    ],
  },
  'tar-pit': {
    weaponId: 'tar-pit',
    produces: ['hazards', 'marks'],
    consumes: ['hazards', 'marks'],
    hooks: [
      dmgHook('tp-hazards', 'hazards', 1.0, 0.3, { cap: 14 }),
      edgeHook(
        'tp-tar-blast',
        'destruction',
        'producer',
        'Tar Pit Sets have a 35% chance to blast 1 card & mark 1 card',
        {
          trigger: { on: 'trick', kind: 'tar' },
          when: [{ kind: 'chance', pct: 35 }],
          effects: [{ do: 'explode', area: { shape: 'random', count: 1 } }, { do: 'markCard', count: 1 }],
        }
      ),
    ],
  },
  decoy: {
    weaponId: 'decoy',
    produces: ['marks', 'graces'],
    consumes: ['marks', 'hints'],
    hooks: [
      dmgHook('dec-marks', 'marks', 1.5, 0.5, { cap: 14 }),
      dmgHook('dec-hints', 'hints', 1.5, 0.5, { cap: 10 }),
    ],
  },
  'long-fuse': {
    weaponId: 'long-fuse',
    produces: ['hazards', 'burn'],
    consumes: ['burn', 'hazards'],
    hooks: [
      dmgHook('lf-burn', 'burn', 1.0, 0.35, { cap: 16 }),
      edgeHook(
        'lf-fuse-burn',
        'burn',
        'producer',
        'Matching a Short-Fuse card ignites 2 board cards',
        {
          trigger: { on: 'trick', kind: 'fuse' },
          effects: [{ do: 'ignite', count: 2 }],
          callout: 'Powder Burn!',
        }
      ),
    ],
  },
  'ice-block': {
    weaponId: 'ice-block',
    produces: ['hazards', 'holo'],
    consumes: ['holo', 'hazards'],
    hooks: [
      dmgHook('ib-holo', 'holo', 1.8, 0.55, { cap: 14 }),
      edgeHook(
        'ib-thaw-holo',
        'holo',
        'producer',
        'Thawing an Ice Block converts 1 additional board card to Holo',
        {
          trigger: { on: 'trick', kind: 'ice' },
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Cryo Holo!',
        }
      ),
    ],
  },
  'greedy-chest': {
    weaponId: 'greedy-chest',
    produces: ['coins', 'streaks'],
    consumes: ['coins', 'streaks'],
    hooks: [
      dmgHook('gch-coins', 'coins', 0.8, 0.25, { step: 5, cap: 18 }),
      edgeHook(
        'gch-chest-gold',
        'coins',
        'producer',
        'Opening a Greedy Chest drops +4 bonus Battle Coins',
        {
          trigger: { on: 'trick', kind: 'chest' },
          effects: [{ do: 'coins', amount: 4 }],
          callout: 'Loot!',
        }
      ),
    ],
  },
  'hot-potato': {
    weaponId: 'hot-potato',
    produces: ['hazards', 'burn'],
    consumes: ['burn', 'hazards'],
    hooks: [
      dmgHook('hp-burn', 'burn', 1.2, 0.4, { cap: 14 }),
      dmgHook('hp-hazards', 'hazards', 1.0, 0.3, { cap: 14 }),
      edgeHook(
        'hp-ignite',
        'burn',
        'producer',
        'Matching the Hot Potato ignites 1 board card',
        {
          trigger: { on: 'trick', kind: 'potato' },
          effects: [{ do: 'ignite', count: 1 }],
          callout: 'Sizzle!',
        }
      ),
    ],
  },
  'twin-seed': {
    weaponId: 'twin-seed',
    produces: ['destruction', 'field_size'],
    consumes: ['destruction', 'field_size'],
    hooks: [
      dmgHook('ts-destr', 'destruction', 0.6, 0.2, { step: 2, cap: 16 }),
      dmgHook('ts-field', 'field_size', 1.0, 0.35, { cap: 12 }),
    ],
  },
  'fog-lantern': {
    weaponId: 'fog-lantern',
    produces: ['hazards', 'holo'],
    consumes: ['hazards', 'holo'],
    hooks: [
      dmgHook('fl-hazards', 'hazards', 1.5, 0.5, { cap: 14 }),
      edgeHook(
        'fl-fog-holo',
        'holo',
        'producer',
        'Lifted Fog cards have a 50% chance to turn Holo when matched',
        {
          trigger: { on: 'trick', kind: 'fog' },
          when: [{ kind: 'chance', pct: 50 }],
          effects: [{ do: 'convert', to: 'holo', count: 1 }],
          callout: 'Beacon!',
        }
      ),
    ],
  },
};

/** Flat lookup of `SynergyHook[]` per Armory weapon ID (all 64 weapons). */
export const WEAPON_SYNERGY_HOOKS: Readonly<Record<string, readonly SynergyHook[]>> = Object.fromEntries(
  Object.entries(WEAPON_SYNERGY_PROFILES).map(([id, p]) => [id, p.hooks])
);

const EMPTY_PROFILE = (weaponId: string): WeaponSynergyProfile => ({
  weaponId,
  produces: [],
  consumes: [],
  hooks: [],
});

export const getWeaponSynergyProfile = (weaponId: string): WeaponSynergyProfile =>
  WEAPON_SYNERGY_PROFILES[weaponId] ?? EMPTY_PROFILE(weaponId);

export const getWeaponSynergyHooks = (weaponId: string): readonly SynergyHook[] =>
  WEAPON_SYNERGY_HOOKS[weaponId] ?? [];

/** All distinct Synergy attributes a weapon touches (produces + consumes + amplifies). */
export const weaponSynergyAttrs = (weaponId: string): SynergyAttrId[] => {
  const p = getWeaponSynergyProfile(weaponId);
  return [...new Set<SynergyAttrId>([...p.produces, ...p.consumes, ...(p.amplifies ?? [])])];
};

/**
 * Synergy attributes shared between `candidateWeaponId` and any weapon in `otherWeaponIds`.
 * Powers Armory `Synergy Match` filters, `WeaponExplainer` belt-match glow, Spire offers, and `autoBuildLoadout`.
 */
export const beltSynergyOverlap = (
  candidateWeaponId: string,
  otherWeaponIds: readonly string[]
): SynergyAttrId[] => {
  const cand = getWeaponSynergyProfile(candidateWeaponId);
  const candSet = new Set<SynergyAttrId>([...cand.produces, ...cand.consumes, ...(cand.amplifies ?? [])]);
  const shared = new Set<SynergyAttrId>();
  for (const oid of otherWeaponIds) {
    if (oid === candidateWeaponId) continue;
    const op = getWeaponSynergyProfile(oid);
    for (const a of [...op.produces, ...op.consumes, ...(op.amplifies ?? [])]) {
      if (candSet.has(a)) shared.add(a);
    }
  }
  return [...shared];
};

export interface SynergyEvalContext {
  hearts?: number | null;
  maxHearts?: number | null;
  timeLeft?: number | null;
  movesLeft?: number | null;
  liveLinks?: number;
}

const hookRawValue = (hook: SynergyHook, synergy: SynergyCounters, ctx?: SynergyEvalContext): number => {
  if (hook.liveSource === 'currentHearts') return Math.max(0, ctx?.hearts ?? 0);
  if (hook.liveSource === 'missingHearts') {
    return ctx?.hearts != null && ctx?.maxHearts != null ? Math.max(0, ctx.maxHearts - ctx.hearts) : 0;
  }
  if (hook.liveSource === 'timeLeftChunks') {
    if (ctx?.timeLeft != null) return Math.floor(Math.max(0, ctx.timeLeft) / 10);
    if (ctx?.movesLeft != null) return Math.max(0, ctx.movesLeft);
    return 0;
  }
  if (hook.liveSource === 'liveLinks') return Math.max(0, ctx?.liveLinks ?? 0);
  return Math.max(0, synergy[hook.attr] ?? 0);
};

export interface SynergyDamageLine {
  hookId: string;
  attr: SynergyAttrId;
  steps: number;
  amount: number;
  note: string;
}

/**
 * Evaluate all base-damage Synergy scaling hooks of one equipped weapon (supports Understudy copying its left neighbor).
 */
export const evaluateWeaponSynergyDamage = (
  weaponId: string,
  level: number,
  synergy: SynergyCounters,
  ctx?: SynergyEvalContext
): { total: number; items: SynergyDamageLine[] } => {
  const hooks = getWeaponSynergyHooks(weaponId);
  let total = 0;
  const items: SynergyDamageLine[] = [];
  for (const h of hooks) {
    if (!h.baseDamagePerStep) continue;
    const raw = hookRawValue(h, synergy, ctx);
    const step = h.step && h.step > 0 ? h.step : 1;
    let steps = Math.floor(raw / step);
    if (h.cap !== undefined) steps = Math.min(h.cap, steps);
    if (steps <= 0) continue;
    const per = lvVal(h.baseDamagePerStep.base, h.baseDamagePerStep.perLevel, level);
    const amount = Math.round(per * steps * 100) / 100;
    if (amount <= 0) continue;
    total += amount;
    items.push({
      hookId: h.id,
      attr: h.attr,
      steps,
      amount,
      note: `${SYNERGY_ATTR_META[h.attr].label} synergy (${steps}×)`,
    });
  }
  return { total: Math.round(total * 100) / 100, items };
};

/**
 * Evaluate standing modifier deltas granted by a weapon's `modPerStep` Synergy hooks (e.g. luckPct from streaks/graces).
 */
export const evaluateWeaponSynergyModifiers = (
  weaponId: string,
  level: number,
  synergy: SynergyCounters,
  ctx?: SynergyEvalContext
): Modifiers => {
  const hooks = getWeaponSynergyHooks(weaponId);
  const out: Record<string, number> = {};
  for (const h of hooks) {
    if (!h.modPerStep) continue;
    const raw = hookRawValue(h, synergy, ctx);
    const step = h.step && h.step > 0 ? h.step : 1;
    let steps = Math.floor(raw / step);
    if (h.cap !== undefined) steps = Math.min(h.cap, steps);
    if (steps <= 0) continue;
    const per = lvVal(h.modPerStep.base, h.modPerStep.perLevel, level);
    const key = h.modPerStep.key as string;
    out[key] = (out[key] ?? 0) + Math.round(per * steps * 100) / 100;
  }
  return out as Modifiers;
};

/** All cross-edge Rules contributed by a weapon's Synergy hooks (resolved cleanly by `sources.ts`). */
export const weaponSynergyRules = (weaponId: string): Rule[] =>
  getWeaponSynergyHooks(weaponId)
    .map(h => h.crossEdgeRule)
    .filter((r): r is Rule => !!r);
