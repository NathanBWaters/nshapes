/**
 * Starfall Spire Ascension ladder (0 → 20).
 *
 * Each tier adds one concrete, legible modifier on top of the previous tiers
 * so climbing feels like Slay the Spire / Balatro Stakes.
 */
export const MAX_ASCENSION = 20;

export interface AscensionModifiers {
  /** Multiplier on all foe HP */
  foeHpScale: number;
  /** Additional HP multiplier on Elites & Bosses */
  bossHpScale: number;
  /** Multiplier on fight clock seconds */
  timerScale: number;
  /** Delta on starting max hearts */
  maxHeartsDelta: number;
  /** Shop price multiplier */
  shopPriceScale: number;
  /** Extra elite nodes generated per act */
  extraElites: number;
  /** Specific parry counters start on Act 1 Elites & Act 2 Skirmishes */
  earlySpecificCounters: boolean;
  /** Multiplier on foe telegraph wind-up & cooldown (lower = faster attacks) */
  parrySpeedScale: number;
  /** Extra hazards on Elites & Bosses */
  extraHazards: boolean;
  /** Starting coins delta */
  startingCoinsDelta: number;
}

export const ASCENSION_DESCRIPTIONS: readonly string[] = [
  'Standard Climb — balanced 3-Act gauntlet.',
  'More Elites stalk every Act (+1 Elite per map).',
  'All foes gain +12% HP.',
  'Start with −1 Max Heart.',
  'Fight clocks are 8% shorter.',
  'Specific Set-Parry counters appear earlier in the climb.',
  'Merchant prices rise by 15%.',
  'Elites and Bosses gain +18% bonus HP and extra traps.',
  'All foes gain +16% HP and telegraphed attacks wind up 8% faster.',
  'Foe telegraphed attacks wind up another 8% faster.',
  'Start with 25 fewer coins.',
  'All foes gain another +12% HP.',
  'Fight clocks shorten by another 6%.',
  'Bosses gain another +15% HP.',
  'Merchant prices rise another 10%.',
  'Foe telegraphed attacks wind up another 8% faster.',
  'All foes gain another +14% HP.',
  'Start with another −1 Max Heart (min 3).',
  'Elites and Bosses gain another +15% HP.',
  'Fight clocks shorten by another 6%.',
  'STARFALL APEX — final Boss gauntlet (+20% Boss HP & faster parries).',
];

export const ascensionModifiers = (level: number): AscensionModifiers => {
  const a = Math.max(0, Math.min(MAX_ASCENSION, Math.floor(level)));
  let foeHpScale = 1;
  let bossHpScale = 1;
  let timerScale = 1;
  let maxHeartsDelta = 0;
  let shopPriceScale = 1;
  let extraElites = 0;
  let earlySpecificCounters = false;
  let parrySpeedScale = 1;
  let extraHazards = false;
  let startingCoinsDelta = 0;

  if (a >= 1) extraElites += 1;
  if (a >= 2) foeHpScale *= 1.14;
  if (a >= 3) maxHeartsDelta -= 1;
  if (a >= 4) timerScale *= 0.92;
  if (a >= 5) earlySpecificCounters = true;
  if (a >= 6) shopPriceScale *= 1.15;
  if (a >= 7) {
    bossHpScale *= 1.18;
    extraHazards = true;
  }
  if (a >= 8) {
    foeHpScale *= 1.16;
    parrySpeedScale *= 0.92;
  }
  if (a >= 9) parrySpeedScale *= 0.92;
  if (a >= 10) startingCoinsDelta -= 25;
  if (a >= 11) foeHpScale *= 1.14;
  if (a >= 12) timerScale *= 0.94;
  if (a >= 13) bossHpScale *= 1.16;
  if (a >= 14) shopPriceScale *= 1.1;
  if (a >= 15) parrySpeedScale *= 0.92;
  if (a >= 16) foeHpScale *= 1.15;
  if (a >= 17) maxHeartsDelta -= 1;
  if (a >= 18) bossHpScale *= 1.16;
  if (a >= 19) timerScale *= 0.94;
  if (a >= 20) {
    bossHpScale *= 1.22;
    parrySpeedScale *= 0.92;
  }

  return {
    foeHpScale,
    bossHpScale,
    timerScale,
    maxHeartsDelta,
    shopPriceScale,
    extraElites,
    earlySpecificCounters,
    parrySpeedScale,
    extraHazards,
    startingCoinsDelta,
  };
};
