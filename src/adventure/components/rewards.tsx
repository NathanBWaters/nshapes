/**
 * How anything a player can unlock is named and drawn. The level preview,
 * results screen, unlock reveal and Bounty Board all describe rewards through
 * here, so a new kind of reward is described once.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon, { IconName } from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import type { CharacterName, Weapon } from '@/types';
import type { AdventureSave, RewardDef } from '../types';
import type { Unlock } from '../progress';
import { getFighter } from '../data/fighters';
import { getArcana } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { getWeaponEvolution } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { getLevel } from '../data/levels';
import { getMechanic } from '../data/mechanics';
import { isFighterTrial, unlockablesOf, type Unlockable } from '../data/rewards';
import { DARK } from './ui';

export interface UnlockableDisplay {
  kind: Unlockable['kind'] | 'path' | 'summit' | 'weapon_slot';
  /** Its name on the unlock reveal */
  name: string;
  /** Its label in a reward row once earned */
  revealed: string;
  /** Shown in a star's reward row while it is still a secret */
  secret: string;
  /** Shown on an unclaimed bounty */
  bountySecret: string;
  icon: IconName;
  headline: string;
  tease: string;
  badge: string | null;
  accent: string;
  /** Drawn as a living fighter instead of the icon */
  fighter?: CharacterName;
  /** Drawn as a weapon relic instead of the icon */
  weapon?: Weapon;
  /** For per-weapon evolutions: the recipient Armory weapon */
  evolutionWeapon?: Weapon;
  /** For weapon_slot unlocks: the new belt slot count (4 or 5) */
  slotNumber?: 4 | 5;
}

export const describeUnlockable = (u: Unlockable): UnlockableDisplay => {
  switch (u.kind) {
    case 'feature': {
      const f = CAMPAIGN_FEATURES[u.id];
      return {
        kind: u.kind, name: f.name, revealed: f.name, secret: f.secret, bountySecret: f.secret,
        icon: getMechanic(f.mechanic).icon, headline: f.headline, tease: f.tease, badge: f.badge, accent: f.accent ?? DARK.gold,
      };
    }
    case 'fighter':
      return {
        kind: u.kind, name: u.id, revealed: u.id, secret: 'A new fighter', bountySecret: 'A new fighter',
        icon: getFighter(u.id).icon, headline: 'New fighter unlocked!', tease: 'Someone wants to join your team.',
        badge: 'FIGHTER', accent: DARK.gold, fighter: u.id,
      };
    case 'weapon': {
      const w = getArmoryWeapon(u.id);
      return {
        kind: u.kind, name: w?.name ?? '?', revealed: w?.name ?? '?', secret: 'A new weapon', bountySecret: w?.name ?? 'Armory Weapon',
        icon: w?.icon ?? 'lorc/gems', headline: 'New weapon unlocked!', tease: 'Something new for your Armory.',
        badge: w ? 'WEAPON' : null,
        accent: DARK.gold, weapon: w,
      };
    }
    case 'arcana': {
      const a = getArcana(u.id);
      const name = `Arcana ${a.numeral}: ${a.name}`;
      return {
        kind: u.kind, name, revealed: name, secret: 'A new Arcana', bountySecret: name,
        icon: a.icon, headline: 'New Arcana unlocked!', tease: 'A tarot wildcard that twists the rules of battle.',
        badge: 'ARCANA WILDCARD', accent: '#A855F7',
      };
    }
    case 'evolution': {
      const evo = getWeaponEvolution(u.id);
      const parentWeapon = evo ? getArmoryWeapon(evo.weaponId) : undefined;
      const name = evo?.name ?? 'Evolution';
      const sec = evo ? Math.round(evo.durationMs / 1000) : 18;
      return {
        kind: u.kind,
        name,
        revealed: parentWeapon ? `${name} (${parentWeapon.name})` : `Evolution: ${name}`,
        secret: 'A weapon evolution',
        bountySecret: parentWeapon ? `${parentWeapon.name} Evo: ${name}` : `Evo: ${name}`,
        icon: evo?.icon ?? 'lorc/crystal-shine',
        headline: 'New evolution unlocked!',
        tease: parentWeapon
          ? `A ${sec}s timed evolution awakens for ${parentWeapon.name}!`
          : 'A timed weapon evolution is ready to awaken!',
        badge: parentWeapon ? `${parentWeapon.name.toUpperCase()} EVOLUTION` : 'WEAPON EVOLUTION',
        accent: evo?.accent ?? '#7C3AED',
        evolutionWeapon: parentWeapon,
      };
    }
  }
};

/**
 * Everything a reward unlocks besides its coins. With the player's save, a
 * weapon they already own is shown as what it will be: a free level of it.
 */
export const describeRewardUnlocks = (reward: RewardDef, save?: AdventureSave): UnlockableDisplay[] =>
  unlockablesOf(reward).map(u => {
    const d = describeUnlockable(u);
    return u.kind === 'weapon' && save?.armory.includes(u.id)
      ? { ...d, secret: `${d.name} level-up`, bountySecret: `${d.name} level-up` }
      : d;
  });

/** What kind of side path a level is, in a word or two. */
export const pathKind = (levelId: string): string => {
  const level = getLevel(levelId);
  return level.rules.sandbox ? 'Practice' : isFighterTrial(level) ? 'Fighter trial' : 'Elite path';
};

const describePath = (levelId: string): UnlockableDisplay => {
  const level = getLevel(levelId);
  return {
    kind: 'path', name: level.name, revealed: `${pathKind(levelId)}: ${level.name}`, secret: 'A secret path', bountySecret: 'A secret path',
    icon: 'lorc/treasure-map', headline: 'You found a secret path!', tease: 'Something on the map was hiding from you.',
    badge: `${pathKind(levelId).toUpperCase()} · OFF ${level.branchOf}`, accent: level.rules.sandbox ? '#F5B800' : DARK.gold,
  };
};

const describeWeaponSlot = (slotNumber: 4 | 5): UnlockableDisplay => {
  const ord = slotNumber === 4 ? '4th' : '5th';
  return {
    kind: 'weapon_slot',
    slotNumber,
    name: `${ord} Weapon Slot`,
    revealed: `${ord} Weapon Slot`,
    secret: `${ord} Weapon Slot`,
    bountySecret: `${ord} Weapon Slot`,
    icon: 'lorc/belt-buckles',
    headline: `${ord} Weapon Slot Unlocked!`,
    tease: `Carry ${slotNumber} weapons into every fight — deeper synergies, more evolutions!`,
    badge: `BELT EXPANSION · ${slotNumber} SLOTS`,
    accent: DARK.gold,
  };
};

export const describeUnlock = (u: Unlock): UnlockableDisplay => {
  if (u.kind === 'path') return describePath(u.levelId);
  if (u.kind === 'weapon_slot') return describeWeaponSlot(u.slotNumber);
  if (u.kind === 'summit') {
    return {
      kind: 'summit',
      name: 'Starfall Summit',
      revealed: 'Starfall Summit',
      secret: 'New game mode',
      bountySecret: 'New game mode',
      icon: 'lorc/mountaintop',
      headline: 'Starfall Summit Unlocked!',
      tease: 'Starfall Summit Unlocked — climb where the star fell!',
      badge: 'ROGUELIKE MODE UNLOCKED',
      accent: '#16AA98',
    };
  }
  if (u.kind === 'weapon' && u.level !== undefined) {
    const d = describeUnlockable(u);
    return {
      ...d,
      revealed: `${d.name} Lv ${u.level}`,
      headline: `${d.name} is stronger!`,
      tease: 'A weapon you already own levels up.',
      badge: `LEVEL ${u.level}`,
    };
  }
  return describeUnlockable(
    u.kind === 'fighter' ? { kind: 'fighter', id: u.name } : u.kind === 'feature' ? { kind: 'feature', id: u.feature } : u
  );
};

/** The unlocked thing itself: a fighter, a weapon relic, an evolution+weapon badge, or its icon. */
export const UnlockableAvatar: React.FC<{
  display: UnlockableDisplay;
  size: number;
  fighterMood: 'idle' | 'victory';
  iconSize: number;
  iconColor: string;
  interactive?: boolean;
}> = ({ display, size, fighterMood, iconSize, iconColor, interactive }) => {
  if (display.fighter) {
    return <FighterAvatar character={display.fighter} size={size} mood={fighterMood} />;
  }
  if (display.weapon) {
    return <WeaponAvatar weapon={display.weapon} size={size} interactive={interactive} />;
  }
  if (display.evolutionWeapon) {
    return (
      <View style={sil.evoWrap}>
        <WeaponAvatar weapon={display.evolutionWeapon} size={size} interactive={interactive} />
        <View style={sil.evoDot}>
          <Icon name="lorc/crystal-shine" size={Math.max(9, Math.round(size * 0.44))} color={COLORS.actionYellow} />
        </View>
      </View>
    );
  }
  return <Icon name={display.icon} size={iconSize} color={iconColor} />;
};

/** A dark cut-out of an icon with a question mark — used wherever a reward is still secret. */
export const Silhouette: React.FC<{ icon: IconName; size?: number; light?: boolean }> = ({ icon, size = 28, light }) => (
  <View style={[sil.wrap, { width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75, backgroundColor: light ? '#E6DFD5' : DARK.stage }]}>
    <Icon name={icon} size={size} color={light ? '#3A3632' : '#0B0B0B'} />
    <Text style={[sil.q, { fontSize: size * 0.6, color: light ? COLORS.canvasWhite : DARK.gold }]}>?</Text>
  </View>
);

const sil = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  q: { position: 'absolute', fontWeight: '900' },
  evoWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  evoDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    backgroundColor: '#5B21B6',
    borderRadius: 999,
    padding: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
