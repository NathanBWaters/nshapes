import type { ImageSourcePropType } from 'react-native';

export interface EnemySpriteAtlasSpec {
  /** Kebab-case asset slug under `assets/enemies/<slug>.webp` */
  readonly slug: string;
  /** Static Metro-bundled `8×8` RGBA WebP sprite sheet source */
  readonly source: ImageSourcePropType;
  /** Airborne / floating species (uses center-anchored settle cushion & scale instead of foot anchor) */
  readonly hover: boolean;
  /** Iconic Chapter / Tier-4 boss using `1280×1280` (`160×160` cell) boss sheets & boss hitstop scaling */
  readonly isBoss: boolean;
  /** Per-frame windup cadence (ms) for slots `32..35` (`48ms` bosses, `40ms` nimble, `62.5ms` standard) */
  readonly windupStepMs: number;
  /** Native idle playback frame rate (`0..31` = 32f @ 16fps, 2000ms seamless cycle) */
  readonly idleFps: number;
  /** Horizontal display offset (fraction of `size`) centering neutral `Pose0` over `enemy-ground-shadow` */
  readonly displayOffsetX?: number;
  /** Static hero display scale compensating for wide leftward attack global union crops */
  readonly displayScale?: number;
}

const DEFAULT_IDLE_FPS = 16;
const STANDARD_WINDUP_STEP_MS = 1000 / 16; // 62.5ms
const BOSS_WINDUP_STEP_MS = 48;
const NIMBLE_WINDUP_STEP_MS = 40;

/**
 * Static Metro-bundled Wave 1 enemy sprite atlases (9 Bosses + 10 World 1 Meadow foes).
 * Aliases (`Mammoth` -> `dusty-mammoth`, `Bramble Frog` -> `clover-frog`) share the exact
 * same preloaded texture reference (`0` duplicate bundle weight / `0` extra VRAM).
 */
const ENEMY_ATLAS_SOURCES = {
  // 9 Iconic Bosses (`1280×1280`, `160×160` cells)
  'ancient-dragon': require('../../../assets/enemies/ancient-dragon.webp') as ImageSourcePropType,
  'the-hydra': require('../../../assets/enemies/the-hydra.webp') as ImageSourcePropType,
  'krakens-grasp': require('../../../assets/enemies/krakens-grasp.webp') as ImageSourcePropType,
  'the-reaper': require('../../../assets/enemies/the-reaper.webp') as ImageSourcePropType,
  'world-eater': require('../../../assets/enemies/world-eater.webp') as ImageSourcePropType,
  'iron-shell': require('../../../assets/enemies/iron-shell.webp') as ImageSourcePropType,
  'hyena-boss': require('../../../assets/enemies/hyena-boss.webp') as ImageSourcePropType,
  'dusty-mammoth': require('../../../assets/enemies/dusty-mammoth.webp') as ImageSourcePropType,
  'stone-sentinel': require('../../../assets/enemies/stone-sentinel.webp') as ImageSourcePropType,

  // 10 World 1 Meadow Foes (`1024×1024`, `128×128` cells)
  'dozy-bunny': require('../../../assets/enemies/dozy-bunny.webp') as ImageSourcePropType,
  prickle: require('../../../assets/enemies/prickle.webp') as ImageSourcePropType,
  'clover-frog': require('../../../assets/enemies/clover-frog.webp') as ImageSourcePropType,
  'sunny-gecko': require('../../../assets/enemies/sunny-gecko.webp') as ImageSourcePropType,
  nutkin: require('../../../assets/enemies/nutkin.webp') as ImageSourcePropType,
  'prism-moth': require('../../../assets/enemies/prism-moth.webp') as ImageSourcePropType,
  'old-quillback': require('../../../assets/enemies/old-quillback.webp') as ImageSourcePropType,
  'golden-mole': require('../../../assets/enemies/golden-mole.webp') as ImageSourcePropType,
  'bumble-bomber': require('../../../assets/enemies/bumble-bomber.webp') as ImageSourcePropType,
  'stalking-wolf': require('../../../assets/enemies/stalking-wolf.webp') as ImageSourcePropType,
} as const;

type EnemyAtlasSlug = keyof typeof ENEMY_ATLAS_SOURCES;

function spec(
  slug: EnemyAtlasSlug,
  opts: {
    hover?: boolean;
    isBoss?: boolean;
    windupStepMs?: number;
    idleFps?: number;
    displayOffsetX?: number;
    displayScale?: number;
  } = {}
): EnemySpriteAtlasSpec {
  const isBoss = opts.isBoss ?? false;
  return {
    slug,
    source: ENEMY_ATLAS_SOURCES[slug],
    hover: opts.hover ?? false,
    isBoss,
    windupStepMs: opts.windupStepMs ?? (isBoss ? BOSS_WINDUP_STEP_MS : STANDARD_WINDUP_STEP_MS),
    idleFps: opts.idleFps ?? DEFAULT_IDLE_FPS,
    displayOffsetX: opts.displayOffsetX,
    displayScale: opts.displayScale,
  };
}

const DUSTY_MAMMOTH_SPEC = spec('dusty-mammoth', {
  isBoss: true,
  displayOffsetX: -0.086,
  displayScale: 1.18,
});
const CLOVER_FROG_SPEC = spec('clover-frog', {
  displayOffsetX: -0.063,
  displayScale: 1.22,
});

/**
 * Locked Wave 1 enemy sprite atlas registry:
 * 19 unique `8×8` (64-slot) atlases + 2 exact visual aliases (`Mammoth`, `Bramble Frog`).
 */
export const ENEMY_SPRITE_ATLAS_SPECS: Readonly<Record<string, EnemySpriteAtlasSpec>> = {
  // 9 Bosses (+ `Mammoth` alias)
  'Ancient Dragon': spec('ancient-dragon', {
    isBoss: true,
    displayOffsetX: 0.022,
    displayScale: 1.24,
  }),
  'The Hydra': spec('the-hydra', {
    isBoss: true,
    displayOffsetX: -0.021,
    displayScale: 1.16,
  }),
  "Kraken's Grasp": spec('krakens-grasp', {
    isBoss: true,
    displayOffsetX: -0.113,
    displayScale: 1.24,
  }),
  'The Reaper': spec('the-reaper', {
    isBoss: true,
    hover: true,
    displayOffsetX: -0.158,
    displayScale: 1.16,
  }),
  'World Eater': spec('world-eater', {
    isBoss: true,
    displayOffsetX: -0.105,
    displayScale: 1.24,
  }),
  'Iron Shell': spec('iron-shell', {
    isBoss: true,
    displayOffsetX: -0.07,
    displayScale: 1.08,
  }),
  'Hyena Boss': spec('hyena-boss', {
    isBoss: true,
    displayOffsetX: 0.032,
    displayScale: 1.22,
  }),
  'Dusty Mammoth': DUSTY_MAMMOTH_SPEC,
  Mammoth: DUSTY_MAMMOTH_SPEC,
  'Stone Sentinel': spec('stone-sentinel', {
    isBoss: true,
    displayOffsetX: -0.131,
    displayScale: 1.24,
  }),

  // 10 World 1 Meadow foes (+ `Bramble Frog` alias)
  'Dozy Bunny': spec('dozy-bunny', {
    displayOffsetX: -0.035,
    displayScale: 1.08,
  }),
  Prickle: spec('prickle', {
    displayOffsetX: -0.048,
    displayScale: 1.05,
  }),
  'Clover Frog': CLOVER_FROG_SPEC,
  'Bramble Frog': CLOVER_FROG_SPEC,
  'Sunny Gecko': spec('sunny-gecko', {
    displayOffsetX: 0.038,
    displayScale: 1.24,
  }),
  Nutkin: spec('nutkin', {
    windupStepMs: NIMBLE_WINDUP_STEP_MS,
    displayOffsetX: -0.019,
    displayScale: 1.22,
  }),
  'Prism Moth': spec('prism-moth', {
    hover: true,
    windupStepMs: NIMBLE_WINDUP_STEP_MS,
    displayOffsetX: -0.038,
    displayScale: 1.0,
  }),
  'Old Quillback': spec('old-quillback', {
    displayOffsetX: -0.129,
    displayScale: 1.18,
  }),
  'Golden Mole': spec('golden-mole', {
    displayOffsetX: -0.11,
    displayScale: 1.24,
  }),
  'Bumble Bomber': spec('bumble-bomber', {
    hover: true,
    windupStepMs: NIMBLE_WINDUP_STEP_MS,
    displayOffsetX: -0.045,
    displayScale: 1.0,
  }),
  'Stalking Wolf': spec('stalking-wolf', {
    displayOffsetX: -0.012,
    displayScale: 1.09,
  }),
};

/** All 19 unique Wave 1 enemy sprite atlas asset slugs. */
export const WAVE1_ENEMY_SPRITE_SLUGS: readonly string[] = Object.keys(ENEMY_ATLAS_SOURCES);

/** All 21 Wave 1 enemy names mapped to sprite atlases (19 canonical + 2 exact visual aliases). */
export const WAVE1_ENEMY_SPRITE_NAMES: readonly string[] = Object.keys(ENEMY_SPRITE_ATLAS_SPECS);

export function hasEnemySpriteAtlas(name?: string | null): boolean {
  return Boolean(name) && Object.prototype.hasOwnProperty.call(ENEMY_SPRITE_ATLAS_SPECS, name as string);
}

export function getEnemySpriteAtlasSpec(name?: string | null): EnemySpriteAtlasSpec | undefined {
  if (!name || !Object.prototype.hasOwnProperty.call(ENEMY_SPRITE_ATLAS_SPECS, name)) {
    return undefined;
  }
  return ENEMY_SPRITE_ATLAS_SPECS[name];
}
