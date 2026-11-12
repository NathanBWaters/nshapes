/**
 * The one table of capped weapon effects.
 *
 * Effect caps limit how much of a stat is actually used, even if a build has
 * accumulated more. Players raise a cap by acquiring Cap Increaser weapons.
 *
 * Everything else about caps is derived from this table: the cap-type union,
 * the `EffectCaps` record on PlayerStats, the default caps, and the
 * stat <-> cap-type lookups. It has no imports so that src/types.ts can derive
 * its types from it; import it through `@/utils/gameConfig`.
 */
interface EffectCapConfig {
  defaultCap: number;
  /** How much one Cap Increaser weapon raises the cap. */
  capIncrease: number;
  /** PlayerStats fields limited by this cap. The first is the effect's main stat. */
  stats: readonly [string, ...string[]];
  /** Uncapped PlayerStats fields that still count as "the same build" for shop weighting. */
  relatedStats?: readonly string[];
}

export const EFFECT_CAPS = {
  echo: { defaultCap: 25, capIncrease: 5, stats: ['echoChance'] }, // Echo Stone
  laser: { defaultCap: 30, capIncrease: 5, stats: ['laserChance'] }, // Prismatic Ray
  graceGain: { defaultCap: 30, capIncrease: 5, stats: ['graceGainChance'] }, // Fortune Token
  explosion: { defaultCap: 40, capIncrease: 10, stats: ['explosionChance'] }, // Blast Powder
  hint: { defaultCap: 40, capIncrease: 10, stats: ['hintGainChance', 'autoHintChance', 'enhancedHintChance'] }, // Oracle Eye, Seeker Lens
  timeGain: { defaultCap: 40, capIncrease: 10, stats: ['timeGainChance'], relatedStats: ['timeGainAmount'] }, // Time Drop
  healing: { defaultCap: 50, capIncrease: 10, stats: ['healingChance'] }, // Mending Charm
  fire: { defaultCap: 50, capIncrease: 10, stats: ['fireSpreadChance'] }, // Flint Spark
  ricochet: { defaultCap: 60, capIncrease: 10, stats: ['ricochetChance'] }, // Chaos Shard
  boardGrowth: { defaultCap: 60, capIncrease: 10, stats: ['boardGrowthChance'] }, // Growth Seed
  coinGain: { defaultCap: 70, capIncrease: 15, stats: ['coinGainChance'] }, // Fortune's Favor
  xpGain: { defaultCap: 100, capIncrease: 0, stats: ['xpGainChance'] }, // Scholar's Tome (no cap increase)
} as const satisfies Record<string, EffectCapConfig>;

export type EffectCapType = keyof typeof EFFECT_CAPS;

/** Current cap per effect type (stored on PlayerStats). */
export type EffectCaps = Record<EffectCapType, number>;

/** A PlayerStats field that is limited by some cap. */
export type CappedStat = (typeof EFFECT_CAPS)[EffectCapType]['stats'][number];

export const EFFECT_CAP_TYPES = Object.keys(EFFECT_CAPS) as EffectCapType[];

export const DEFAULT_EFFECT_CAPS: EffectCaps = Object.fromEntries(
  EFFECT_CAP_TYPES.map(type => [type, EFFECT_CAPS[type].defaultCap])
) as EffectCaps;

/** PlayerStats field name -> the cap that limits it. */
export const STAT_TO_CAP_TYPE: Record<string, EffectCapType> = Object.fromEntries(
  EFFECT_CAP_TYPES.flatMap(type => EFFECT_CAPS[type].stats.map(stat => [stat, type]))
);

/** The main PlayerStats field of a capped effect (e.g. hint -> hintGainChance). */
export const getMainStatForCap = (type: EffectCapType): CappedStat => EFFECT_CAPS[type].stats[0];

/** Every PlayerStats field that belongs to a capped effect's build, capped or not. */
export const getBuildStatsForCap = (type: EffectCapType): readonly string[] => {
  const config: EffectCapConfig = EFFECT_CAPS[type];
  return [...config.stats, ...(config.relatedStats ?? [])];
};
