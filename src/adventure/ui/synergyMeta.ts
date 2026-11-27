/**
 * Canonical UI metadata & belt-summary helpers for the 15-Node Synergy Graph.
 *
 * Syncs 1:1 with `SYNERGY_ATTR_META` and `WEAPON_SYNERGY_PROFILES` in
 * `src/adventure/data/synergy.ts` so Armory filters, `WeaponExplainer.tsx`,
 * `LevelPreview.tsx`, `SharedCards.tsx`, and Starfall Summit share one
 * color-coded, accessible palette (Sakurai Ep. #132 & #238).
 */
import type { SynergyAttrDef, SynergyAttrId, SynergyRole } from '../types';
import {
  SYNERGY_ATTR_IDS,
  SYNERGY_ATTR_META,
  beltSynergyOverlap,
  getWeaponSynergyProfile,
  weaponSynergyAttrs,
} from '../data/synergy';

export type { SynergyAttrDef, SynergyAttrId, SynergyRole };
export { SYNERGY_ATTR_IDS, SYNERGY_ATTR_META, beltSynergyOverlap, weaponSynergyAttrs };

export interface SynergyRoleMeta {
  glyph: '▲' | '◆' | '★';
  label: string;
  shortLabel: string;
  verb: string;
}

/** Role indicators shown on Synergy chips & hooks inside `WeaponExplainer.tsx`. */
export const SYNERGY_ROLE_META: Readonly<Record<SynergyRole, SynergyRoleMeta>> = {
  producer: { glyph: '▲', label: 'PRODUCES', shortLabel: 'Builds', verb: 'Generates' },
  consumer: { glyph: '◆', label: 'SCALES WITH', shortLabel: 'Scales', verb: 'Scales off' },
  amplifier: { glyph: '★', label: 'AMPLIFIES', shortLabel: 'Boosts', verb: 'Amplifies' },
};

/** Safe canonical lookup for any SynergyAttrId visual metadata. */
export const getSynergyAttrMeta = (attr: SynergyAttrId): SynergyAttrDef => SYNERGY_ATTR_META[attr];

export interface SynergyBeltLink {
  attr: SynergyAttrId;
  meta: SynergyAttrDef;
  count: number;
  weaponIds: string[];
}

/**
 * Summarize shared Synergy Graph links across an equipped weapon belt
 * (returns attributes touched by `minCount` or more weapons, default 2,
 * sorted by count desc then canonical order).
 */
export const summarizeBeltSynergies = (
  weaponIds: readonly string[],
  minCount = 2
): SynergyBeltLink[] => {
  const byAttr = new Map<SynergyAttrId, string[]>();
  const uniqueIds = [...new Set(weaponIds)];
  for (const wId of uniqueIds) {
    for (const attr of weaponSynergyAttrs(wId)) {
      const list = byAttr.get(attr);
      if (list) list.push(wId);
      else byAttr.set(attr, [wId]);
    }
  }
  const orderIndex = new Map<SynergyAttrId, number>(SYNERGY_ATTR_IDS.map((id, i) => [id, i]));
  const links: SynergyBeltLink[] = [];
  for (const [attr, ids] of byAttr.entries()) {
    if (ids.length < minCount) continue;
    links.push({
      attr,
      meta: SYNERGY_ATTR_META[attr],
      count: ids.length,
      weaponIds: ids,
    });
  }
  return links.sort(
    (a, b) =>
      b.count - a.count ||
      (orderIndex.get(a.attr) ?? 99) - (orderIndex.get(b.attr) ?? 99)
  );
};

/**
 * Set of Synergy attributes touched by OTHER equipped belt weapons (excluding
 * `excludeWeaponId`), used to light up matching Synergy tags inside `WeaponExplainer`.
 */
export const beltSynergyAttrSet = (
  weaponIds: readonly string[],
  excludeWeaponId?: string
): ReadonlySet<SynergyAttrId> => {
  const out = new Set<SynergyAttrId>();
  for (const wId of weaponIds) {
    if (excludeWeaponId && wId === excludeWeaponId) continue;
    const profile = getWeaponSynergyProfile(wId);
    for (const a of profile.produces) out.add(a);
    for (const a of profile.consumes) out.add(a);
    for (const a of profile.amplifies ?? []) out.add(a);
  }
  return out;
};
