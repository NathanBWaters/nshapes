/**
 * Which lessons a player still has to sit through before a fight, and the
 * lesson pages that are written from their save rather than fixed in data.
 */
import type { AdventureSave, EvolutionRecipe, LessonPage, LevelDef, MechanicDef } from './types';
import { LEVELS, MAIN_LEVELS, mainIndexOf } from './data/levels';
import { worldNumber } from './data/biomes';
import { levelFoe } from './data/foes';
import { MECHANICS } from './data/mechanics';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { starRewards } from './data/rewards';
import { LESSON_KEYS } from './progress';

/** The mechanic that explains evolutions: the one that switches them on, else the older id. */
export const evolutionsMechanicId = (): string | undefined =>
  Object.values(MECHANICS).find(m => m.enables === 'evolutions')?.id ??
  ['evolutions', 'weapon_evolutions'].find(id => !!MECHANICS[id]);

export interface LessonPlan {
  mechanic: MechanicDef;
  /** Pages shown ahead of the mechanic's own */
  prelude?: LessonPage[];
  /** LESSON_KEYS to record once the player has accepted the lesson */
  marks: string[];
}

// ─── First Weapon Combo ─────────────────────────────────────────────────────

interface ComboStage {
  level: LevelDef;
  star: number;
  recipeId: string;
}

const COMBO_STAGES: ComboStage[] = LEVELS.flatMap(level =>
  starRewards(level).flatMap((reward, i) => (reward.evolution ? [{ level, star: i + 1, recipeId: reward.evolution }] : []))
);

/**
 * The stages where a player can win their first Combo: everything up to the
 * first main-path level that grants one. Nobody gets past that level without
 * its lesson, so later Combo levels never need the discovery page.
 */
const FIRST_COMBO_STAGES: ComboStage[] = (() => {
  const onMainPath = COMBO_STAGES.filter(s => !s.level.branchOf).map(s => mainIndexOf(s.level));
  const last = Math.min(...onMainPath);
  return COMBO_STAGES.filter(s => mainIndexOf(s.level) <= last);
})();

const recipeOf = (id: string): EvolutionRecipe | undefined => EVOLUTION_RECIPES.find(r => r.id === id);

const comboDiscoveryPage = (stage: ComboStage): LessonPage => {
  const { level } = stage;
  const recipe = recipeOf(stage.recipeId);
  const name = recipe?.name ?? 'an evolution';
  const stars = '★'.repeat(stage.star);
  const unlocks = `unlocks your very first EVOLUTION: ${name}${recipe ? ` (${recipe.familyText})` : ''}`;
  const knockout = stage.star >= 2 ? `Knocking out ${levelFoe(level).name} (${stars})` : `Earning ${stars} against ${levelFoe(level).name}`;
  const catalysts = 'Carry both of its weapon families as charms and a Catalyst card can turn up on the board. Match it in a Set to evolve for 30 seconds';
  const comboIcon = recipe?.icon ?? 'lorc/fireball';
  if (level.branchOf) {
    // Reached before the main-path evolution level, so nothing taught there (the clock) may be mentioned
    const ahead = FIRST_COMBO_STAGES.find(s => !s.level.branchOf);
    return {
      title: 'Elite Reward: First Evolution',
      body: [
        `You discovered World ${worldNumber(level.biome)}'s Elite branch! ${knockout} ${unlocks}.`,
        `${catalysts}!${ahead ? ` (Another World ${worldNumber(ahead.level.biome)} evolution also awaits ahead on ${ahead.level.id}.)` : ''}`,
      ],
      demo: {
        type: 'icons',
        items: [
          { icon: 'lorc/daemon-skull', label: `${level.id} Elite` },
          { icon: comboIcon, label: 'Unlock evolution' },
          { icon: 'lorc/crystal-shine', label: 'Match the Catalyst' },
        ],
      },
    };
  }
  const elite = FIRST_COMBO_STAGES.find(s => s.level.branchOf);
  return {
    title: 'Milestone Reward: First Evolution',
    body: [
      `${knockout} ${unlocks}!`,
      `${catalysts}.${elite ? ` (Tip: World ${worldNumber(elite.level.biome)}'s ${elite.level.id} Elite branch also guards an evolution whenever you're ready!)` : ''}`,
    ],
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/crossed-swords', label: `Beat ${level.id} (${stars})` },
        { icon: comboIcon, label: 'Unlock evolution' },
        { icon: 'lorc/crystal-shine', label: 'Match the Catalyst' },
      ],
    },
  };
};

/**
 * Shown once, on whichever first-evolution stage the player reaches first while
 * they still own no recipe.
 */
export const buildComboDiscoveryPages = (levelId: string, save: AdventureSave): LessonPage[] => {
  if (save.seenMechanics.includes(LESSON_KEYS.comboDiscovery) || save.unlockedEvolutions.length > 0) return [];
  return FIRST_COMBO_STAGES.filter(s => s.level.id === levelId).map(comboDiscoveryPage);
};

/** The evolutions lesson, rewritten around the recipe the player unlocked first. */
export const buildAdaptiveEvolutionMechanic = (save: AdventureSave): MechanicDef => {
  const id = evolutionsMechanicId();
  const base = id ? MECHANICS[id] : undefined;
  if (!base) throw new Error('No mechanic explains evolutions');
  const recipe = save.unlockedEvolutions.map(recipeOf).find((r): r is EvolutionRecipe => !!r);
  if (!recipe) return base;
  return {
    ...base,
    tagline: `${recipe.name} is ready: match the Catalyst card to evolve for 30 seconds!`,
    body: [
      `You unlocked ${recipe.name}! It is ARMED in any fight where your charms include both of its families: ${recipe.familyText}.`,
      'While a recipe is armed, refills can bring an Evolution Catalyst card. Match it in any Set: the foe takes 10 at once and the evolution runs for 30 seconds, with every Set dealing ×1.5.',
      `While it runs: ${recipe.activeText} Every Set also deals ×1.5 and +2.`,
      'Up to 3 evolutions per fight, and no new Catalyst turns up for an evolution that is already running. The Recipe Guide in the Field Guide lists every recipe.',
    ],
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gems', label: 'Equip both families' },
        { icon: 'lorc/crystal-shine', label: 'Match the Catalyst' },
        { icon: recipe.icon, label: recipe.name },
      ],
    },
  };
};

// ─── Lessons due before a fight ─────────────────────────────────────────────

/**
 * In playing order: the level's own mechanic the first time (with the Combo
 * discovery page in front of it when that applies), then the Weapon Combos
 * lesson once the player owns a recipe and gear is on.
 */
export const lessonsDueBefore = (level: LevelDef, save: AdventureSave): LessonPlan[] => {
  const seen = (key: string) => save.seenMechanics.includes(key);
  const evoId = evolutionsMechanicId();
  const plans: LessonPlan[] = [];
  if (!seen(LESSON_KEYS.mechanic(level.introduces))) {
    const discovery = buildComboDiscoveryPages(level.id, save);
    plans.push({
      // The level that teaches evolutions teaches them around the recipe the player owns
      mechanic: level.introduces === evoId ? buildAdaptiveEvolutionMechanic(save) : MECHANICS[level.introduces],
      prelude: discovery.length > 0 ? discovery : undefined,
      marks: [LESSON_KEYS.mechanic(level.introduces), ...(discovery.length > 0 ? [LESSON_KEYS.comboDiscovery] : [])],
    });
  }
  if (
    evoId &&
    level.introduces !== evoId &&
    !level.rules.noGear &&
    save.unlockedEvolutions.length > 0 &&
    !seen(LESSON_KEYS.mechanic(evoId)) &&
    // Saves from before the rename recorded the lesson under its old id
    !seen(LESSON_KEYS.mechanic('weapon_evolutions'))
  ) {
    plans.push({ mechanic: buildAdaptiveEvolutionMechanic(save), marks: [LESSON_KEYS.mechanic(evoId)] });
  }
  return plans;
};

/** The very first visit: nothing played yet and the first level's lesson not seen. */
export const isFirstVisit = (save: AdventureSave): boolean =>
  Object.keys(save.plays).length === 0 && !save.seenMechanics.includes(LESSON_KEYS.mechanic(MAIN_LEVELS[0].introduces));
