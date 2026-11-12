/**
 * Which lessons a player still has to sit through before a fight, and the
 * lesson pages that are written from their save rather than fixed in data.
 */
import type { AdventureSave, LessonPage, LevelDef, MechanicDef } from './types';
import { LEVELS, MAIN_LEVELS, mainIndexOf } from './data/levels';
import { worldNumber } from './data/biomes';
import { levelFoe } from './data/foes';
import { MECHANICS } from './data/mechanics';
import { getEvolutionRecipe } from './data/evolutions';
import { starRewards } from './data/rewards';
import { LESSON_KEYS } from './progress';

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

const comboDiscoveryPage = (stage: ComboStage): LessonPage => {
  const { level } = stage;
  const recipe = getEvolutionRecipe(stage.recipeId);
  const stars = '★'.repeat(stage.star);
  const unlocks = `unlocks your very first WEAPON COMBO recipe: ${recipe.result.name} (fusing ${recipe.gearRequirementText.replace(/ families$/, '')})`;
  const knockout = `Knocking out ${levelFoe(level).name} (${stars})`;
  const catalysts = 'Once you unlock a Combo recipe, hidden Catalyst crystals begin appearing behind cards in future fights';
  const comboIcon = recipe.result.icon ?? 'lorc/fireball';
  if (level.branchOf) {
    // Reached before the main-path Combo level, so nothing taught there (the clock) may be mentioned
    const ahead = FIRST_COMBO_STAGES.find(s => !s.level.branchOf);
    return {
      title: 'Combo Vault: First Weapon Combo',
      body: [
        `You discovered World ${worldNumber(level.biome)}'s Elite branch! ${knockout} ${unlocks}.`,
        `${catalysts}!${ahead ? ` (Another World ${worldNumber(ahead.level.biome)} Combo also awaits ahead on ${ahead.level.id}.)` : ''}`,
      ],
      demo: {
        type: 'icons',
        items: [
          { icon: 'lorc/daemon-skull', label: `${level.id} Elite` },
          { icon: comboIcon, label: 'Unlock Combo' },
          { icon: 'lorc/crystal-shine', label: 'Awaken Catalysts' },
        ],
      },
    };
  }
  const elite = FIRST_COMBO_STAGES.find(s => s.level.branchOf);
  return {
    title: 'Milestone Reward: First Weapon Combo',
    body: [
      `${knockout} ${unlocks}!`,
      `${catalysts}.${elite ? ` (Tip: World ${worldNumber(elite.level.biome)}'s ${elite.level.id} Elite branch also guards a second Combo recipe whenever you're ready!)` : ''}`,
    ],
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/crossed-swords', label: `Beat ${level.id} (${stars})` },
        { icon: comboIcon, label: 'Unlock Combo' },
        { icon: 'lorc/crystal-shine', label: 'Awaken Catalysts' },
      ],
    },
  };
};

/**
 * Shown once, on whichever first-Combo stage the player reaches first while
 * they still own no Combo recipe.
 */
export const buildComboDiscoveryPages = (levelId: string, save: AdventureSave): LessonPage[] => {
  if (save.seenMechanics.includes(LESSON_KEYS.comboDiscovery) || save.unlockedEvolutions.length > 0) return [];
  return FIRST_COMBO_STAGES.filter(s => s.level.id === levelId).map(comboDiscoveryPage);
};

/** The `weapon_evolutions` lesson, rewritten around the Combo recipe the player unlocked first. */
export const buildAdaptiveEvolutionMechanic = (save: AdventureSave): MechanicDef => {
  const base = MECHANICS.weapon_evolutions;
  const firstId = save.unlockedEvolutions[0];
  if (!firstId) return base;
  const recipe = getEvolutionRecipe(firstId);
  return {
    ...base,
    tagline: `Your ${recipe.result.name} combo is live — watch for a hidden Catalyst card!`,
    body: [
      `You unlocked ${recipe.result.name}! Bring ${recipe.gearRequirementText}, and complete its condition (${recipe.primeRequirementText.toLowerCase()}).`,
      'At most ONE card on screen hides an Evolution Catalyst. Wait until its badge turns gold (EVO) before matching on it — matching too early shatters and loses it!',
      'Check the Recipe Guide in the Field Guide anytime to review your unlocked combos.',
    ],
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gems', label: 'Pair Gear' },
        { icon: 'lorc/crystal-shine', label: 'Wait for EVO' },
        { icon: recipe.result.icon ?? 'lorc/fireball', label: recipe.result.name },
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
  const plans: LessonPlan[] = [];
  if (!seen(LESSON_KEYS.mechanic(level.introduces))) {
    const discovery = buildComboDiscoveryPages(level.id, save);
    plans.push({
      mechanic: MECHANICS[level.introduces],
      prelude: discovery.length > 0 ? discovery : undefined,
      marks: [LESSON_KEYS.mechanic(level.introduces), ...(discovery.length > 0 ? [LESSON_KEYS.comboDiscovery] : [])],
    });
  }
  const combos = MECHANICS.weapon_evolutions;
  if (!level.rules.noGear && save.unlockedEvolutions.length > 0 && !seen(LESSON_KEYS.mechanic(combos.id))) {
    plans.push({ mechanic: buildAdaptiveEvolutionMechanic(save), marks: [LESSON_KEYS.mechanic(combos.id)] });
  }
  return plans;
};

/** The very first visit: nothing played yet and the first level's lesson not seen. */
export const isFirstVisit = (save: AdventureSave): boolean =>
  Object.keys(save.plays).length === 0 && !save.seenMechanics.includes(LESSON_KEYS.mechanic(MAIN_LEVELS[0].introduces));
