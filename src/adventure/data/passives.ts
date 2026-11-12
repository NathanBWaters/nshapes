/**
 * Fighter passives: two per fighter, always on. Their behaviour is hand-coded
 * in engine/passives.ts; the numbers live here as tuning keys, which skill
 * nodes adjust through `Modifiers.passiveTuning` (deltas that add up).
 */
import type { PassiveDef, PassiveId } from '../types';

export const PASSIVE_TUNING = {
  nine_lives: { 'nineLives.charges': 1 },
  scrappy: { 'scrappy.perHeart': 1 },
  combo: { 'combo.windowMs': 5000, 'combo.max': 4, 'combo.perStep': 1 },
  hot_streak: { 'hotStreak.multiplier': 2 },
  grudge: { 'grudge.max': 3, 'grudge.damage': 3 },
  thick_hide: { 'thickHide.perWave': 1 },
  patience: { 'patience.ms': 6000, 'patience.damage': 3 },
  deep_freeze: { 'deepFreeze.ms': 4000 },
  zoomies: { 'zoomies.every': 5, 'zoomies.powerCards': 0 },
  fetch: { 'fetch.count': 1 },
  big_scoop: { 'scoop.every': 6, 'scoop.weaponTriggers': 0 },
  keen_eye: { 'keenEye.ms': 8000 },
} as const satisfies Record<PassiveId, Record<string, number>>;

/** The combo window every fighter's combo counter uses when Sly Fox's tuning doesn't apply. */
export const DEFAULT_COMBO_WINDOW_MS = PASSIVE_TUNING.combo['combo.windowMs'];

type Tuning = Record<string, number>;

const s = (n: number) => (n === 1 ? '' : 's');
const secs = (ms: number) => `${Math.round(ms / 100) / 10}s`;
const nth = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

const TEXT: Record<PassiveId, (t: Tuning) => string> = {
  nine_lives: t => {
    const n = t['nineLives.charges'];
    return n === 1
      ? 'Once per fight, a knockout leaves you on 1 heart.'
      : `${n} times per fight, a knockout leaves you on 1 heart.`;
  },
  scrappy: t => `+${t['scrappy.perHeart']} damage per missing heart on every Set.`,
  combo: t =>
    `Sets within ${secs(t['combo.windowMs'])} chain: +${t['combo.perStep']} damage per step (max +${t['combo.max'] * t['combo.perStep']}). A mistake breaks it.`,
  hot_streak: t => `At max Combo, your next Set deals ×${t['hotStreak.multiplier']}.`,
  grudge: t =>
    `Each mistake stores a grudge (max ${t['grudge.max']}). Your next Set releases +${t['grudge.damage']} damage per grudge.`,
  thick_hide: t => {
    const n = t['thickHide.perWave'];
    return n === 1 ? 'Your first mistake each wave costs no heart.' : `Your first ${n} mistakes each wave cost no heart.`;
  },
  patience: t => `A Set made ${secs(t['patience.ms'])}+ after the last one deals +${t['patience.damage']}.`,
  deep_freeze: t => `Every Rainbow Strike freezes the clock and the foe for ${secs(t['deepFreeze.ms'])}.`,
  zoomies: t =>
    `Every ${nth(t['zoomies.every'])} Set re-deals the board clean (duds and hidden cards gone).` +
    (t['zoomies.powerCards'] > 0 ? ` Each re-deal turns ${t['zoomies.powerCards']} card${s(t['zoomies.powerCards'])} into power cards.` : ''),
  fetch: t => {
    const n = t['fetch.count'];
    return `Matching a power or gold card brings ${n === 1 ? 'a new one' : `${n} new ones`} onto the board.`;
  },
  big_scoop: t =>
    `Every ${nth(t['scoop.every'])} Set, a free Set is scooped for you.` +
    (t['scoop.weaponTriggers'] > 0 ? ' Scooped Sets trigger every weapon you hold.' : ''),
  keen_eye: t => `After ${secs(t['keenEye.ms'])} without a Set, one card of a Set glows (free).`,
};

const META: Record<PassiveId, Pick<PassiveDef, 'name' | 'icon'>> = {
  nine_lives: { name: 'Nine Lives', icon: 'lorc/cat' },
  scrappy: { name: 'Scrappy', icon: 'lorc/fist' },
  combo: { name: 'Combo', icon: 'lorc/lightning-branches' },
  hot_streak: { name: 'Hot Streak', icon: 'lorc/fireball' },
  grudge: { name: 'Grudge', icon: 'lorc/fist' },
  thick_hide: { name: 'Thick Hide', icon: 'lorc/turtle-shell' },
  patience: { name: 'Patience', icon: 'lorc/hourglass' },
  deep_freeze: { name: 'Deep Freeze', icon: 'lorc/snowflake-1' },
  zoomies: { name: 'Zoomies', icon: 'delapouite/jumping-dog' },
  fetch: { name: 'Fetch', icon: 'delapouite/sitting-dog' },
  big_scoop: { name: 'Big Scoop', icon: 'delapouite/eating-pelican' },
  keen_eye: { name: 'Keen Eye', icon: 'lorc/light-bulb' },
};

/** Player-facing text for a passive with (possibly node-adjusted) tuning. */
export const describePassive = (id: PassiveId, tuning?: Tuning): string =>
  TEXT[id]({ ...PASSIVE_TUNING[id], ...tuning });

const passiveDef = (id: PassiveId): PassiveDef => ({
  id,
  ...META[id],
  tuning: { ...PASSIVE_TUNING[id] },
  text: describePassive(id),
});

export const PASSIVES = Object.fromEntries(
  (Object.keys(PASSIVE_TUNING) as PassiveId[]).map(id => [id, passiveDef(id)])
) as Record<PassiveId, PassiveDef>;

export const getPassive = (id: PassiveId): PassiveDef => PASSIVES[id];
