/**
 * Which lessons a player still has to sit through before a fight, and the
 * lesson pages that are written from their save rather than fixed in data.
 */
import type { AdventureSave, EvolutionRecipe, LessonPage, LevelDef, MechanicDef } from './types';
import { MAIN_LEVELS } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { LESSON_KEYS } from './progress';

const recipeOf = (id: string): EvolutionRecipe | undefined => EVOLUTION_RECIPES.find(r => r.id === id);

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

/** The evolutions lesson, rewritten around the recipe the player unlocked first. */
export const buildAdaptiveEvolutionMechanic = (save: AdventureSave): MechanicDef => {
  const id = evolutionsMechanicId();
  const base = id ? MECHANICS[id] : undefined;
  if (!base) throw new Error('No mechanic explains evolutions');
  const recipe = save.unlockedEvolutions.map(recipeOf).find((r): r is EvolutionRecipe => !!r);
  if (!recipe) return base;
  return {
    ...base,
    tagline: `${recipe.name} is ready — match the Catalyst card to evolve!`,
    body: [
      `Equip both families of ${recipe.name} (${recipe.familyText}) to arm it.`,
      `Match the glowing Catalyst card in any Set: ${recipe.activeText}`,
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
 * In playing order: the level's own mechanic the first time, then the
 * evolutions lesson once the player owns a recipe and gear is on.
 *
 * (The level that pays the first recipe used to open with a page announcing
 * it. A wall of text about a reward, before a boss, about something that
 * does nothing in that fight: it is gone. The reward is teased on the preview
 * as a secret, and explained by its own reveal when it is won.)
 */
export const lessonsDueBefore = (level: LevelDef, save: AdventureSave): LessonPlan[] => {
  // Level 1-1 teaches directly on the live board with glowing cards & Orange Tabby — zero pre-fight modals!
  if (level.id === MAIN_LEVELS[0].id) return [];
  const seen = (key: string) => save.seenMechanics.includes(key);
  const evoId = evolutionsMechanicId();
  const plans: LessonPlan[] = [];
  if (!seen(LESSON_KEYS.mechanic(level.introduces))) {
    plans.push({
      // The level that teaches evolutions teaches them around the recipe the player owns
      mechanic: level.introduces === evoId ? buildAdaptiveEvolutionMechanic(save) : MECHANICS[level.introduces],
      marks: [LESSON_KEYS.mechanic(level.introduces)],
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

/**
 * A lesson the level preview has already given: the level's own mechanic, shown
 * there as the NEW card with its demo (including `2-2` Evolutions, eliminating
 * the double-modal). Nothing more is needed before the fight; only extra
 * standalone preludes still get their own screen.
 */
export const taughtOnPreview = (plan: LessonPlan, level: LevelDef): boolean =>
  !plan.prelude?.length && plan.mechanic.id === level.introduces;

/** The very first visit: nothing played yet and the first level's lesson not seen. */
export const isFirstVisit = (save: AdventureSave): boolean =>
  Object.keys(save.plays).length === 0 && !save.seenMechanics.includes(LESSON_KEYS.mechanic(MAIN_LEVELS[0].introduces));
