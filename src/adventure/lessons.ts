/**
 * Which lessons a player still has to sit through before a fight, and the
 * lesson pages that are written from their save rather than fixed in data.
 */
import type { AdventureSave, LessonPage, LevelDef, MechanicDef, WeaponEvolutionDef } from './types';
import { MAIN_LEVELS } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { getArmoryWeapon } from './data/armory';
import {
  defaultEvolutionForWeapon,
  evolutionConditionShort,
  evolutionConditionText,
  getWeaponEvolution,
} from './data/evolutions';
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

const firstOwnedEvolution = (save: AdventureSave): WeaponEvolutionDef | undefined => {
  // Prefer an evolution currently equipped on one of the player's belt weapons
  for (const weaponId of save.charms) {
    const equippedId = save.equippedEvolutions?.[weaponId];
    if (equippedId) {
      const def = getWeaponEvolution(equippedId);
      if (def) return def;
    }
  }
  // Otherwise pick the first unlocked per-weapon evolution
  for (const evoId of save.unlockedWeaponEvolutions ?? []) {
    const def = getWeaponEvolution(evoId);
    if (def) return def;
  }
  return defaultEvolutionForWeapon('blast-powder');
};

/** The evolutions lesson, rewritten around the weapon evolution the player unlocked first. */
export const buildAdaptiveEvolutionMechanic = (save: AdventureSave): MechanicDef => {
  const id = evolutionsMechanicId();
  const base = id ? MECHANICS[id] : undefined;
  if (!base) throw new Error('No mechanic explains evolutions');
  const evo = firstOwnedEvolution(save);
  if (!evo) return base;
  const weapon = getArmoryWeapon(evo.weaponId);
  const weaponName = weapon?.name ?? evo.weaponId;
  const condFull = evolutionConditionText(evo);
  const condShort = evolutionConditionShort(evo);
  const secs = Math.round(evo.durationMs / 1000);
  return {
    ...base,
    tagline: `${evo.name} is ready on ${weaponName} — ${condFull.toLowerCase()} to evolve!`,
    body: [
      `Equip ${weaponName} on your Weapon Belt with ${evo.name} selected (each weapon has 3 Evolutions unlocked via Bounties).`,
      `Mid-fight, ${condFull.toLowerCase()} to burst for +18 base damage and ignite ${evo.name} for ${secs}s: ${evo.tagline}`,
    ],
    demo: {
      type: 'icons',
      items: [
        { icon: weapon?.icon ?? 'lorc/gems', label: weaponName },
        { icon: 'lorc/archery-target', label: condShort },
        { icon: evo.icon, label: `${evo.name} (${secs}s)` },
      ],
    },
  };
};

// ─── Lessons due before a fight ─────────────────────────────────────────────

/**
 * In playing order: the level's own mechanic the first time, then the
 * evolutions lesson once the player owns a weapon evolution and gear is on.
 */
export const lessonsDueBefore = (level: LevelDef, save: AdventureSave): LessonPlan[] => {
  // Level 1-1 teaches directly on the live board with glowing cards & Orange Tabby — zero pre-fight modals!
  if (level.id === MAIN_LEVELS[0].id) return [];
  const seen = (key: string) => save.seenMechanics.includes(key);
  const evoId = evolutionsMechanicId();
  const plans: LessonPlan[] = [];
  if (!seen(LESSON_KEYS.mechanic(level.introduces))) {
    plans.push({
      // The level that teaches evolutions teaches them around the weapon evolution the player owns
      mechanic: level.introduces === evoId ? buildAdaptiveEvolutionMechanic(save) : MECHANICS[level.introduces],
      marks: [LESSON_KEYS.mechanic(level.introduces)],
    });
  }
  const hasAnyEvo = (save.unlockedWeaponEvolutions?.length ?? 0) > 0;
  if (
    evoId &&
    level.introduces !== evoId &&
    !level.rules.noGear &&
    hasAnyEvo &&
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
