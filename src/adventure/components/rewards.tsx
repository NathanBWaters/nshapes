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
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { getMechanic } from '../data/mechanics';
import { unlockablesOf, type Unlockable } from '../data/rewards';
import { DARK } from './ui';

export interface UnlockableDisplay {
  kind: Unlockable['kind'];
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
        kind: u.kind, name: w?.name ?? '?', revealed: w?.name ?? '?', secret: 'A new weapon', bountySecret: 'Armory Weapon',
        icon: w?.icon ?? 'lorc/gems', headline: 'New weapon unlocked!', tease: 'Something new for your Armory.',
        badge: w ? 'WEAPON' : null,
        accent: DARK.gold, weapon: w,
      };
    }
    case 'arcana': {
      const a = getArcana(u.id);
      const name = `Arcana ${a.numeral}: ${a.name}`;
      return {
        kind: u.kind, name, revealed: name, secret: 'A new Arcana', bountySecret: 'Arcana Wildcard',
        icon: a.icon, headline: 'New Arcana unlocked!', tease: 'A tarot wildcard that twists the rules of battle.',
        badge: 'ARCANA WILDCARD', accent: '#A855F7',
      };
    }
    case 'evolution': {
      const r = EVOLUTION_RECIPES.find(x => x.id === u.id);
      const name = r?.name ?? 'Evolution';
      return {
        kind: u.kind, name, revealed: `Evolution: ${name}`, secret: 'An evolution', bountySecret: 'An evolution',
        icon: r?.icon ?? 'lorc/crystal-shine', headline: 'New evolution unlocked!',
        tease: 'Two weapon families can now fuse into a 20-second power trip!',
        badge: 'EVOLUTION RECIPE', accent: '#FFD700',
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

export const describeUnlock = (u: Unlock): UnlockableDisplay => {
  if (u.kind === 'weapon' && u.level !== undefined) {
    const d = describeUnlockable(u);
    return {
      ...d,
      revealed: `${d.name} Lv ${u.level}`,
      headline: `${d.name} is stronger!`,
      tease: 'A weapon you already own levels up.',
      badge: `LEVEL ${u.level}${u.refund ? ` · +${u.refund}¢ REFUNDED` : ''}`,
    };
  }
  return describeUnlockable(
    u.kind === 'fighter' ? { kind: 'fighter', id: u.name } : u.kind === 'feature' ? { kind: 'feature', id: u.feature } : u
  );
};

/** The unlocked thing itself: a fighter, a weapon relic, or its icon. */
export const UnlockableAvatar: React.FC<{
  display: UnlockableDisplay;
  size: number;
  fighterMood: 'idle' | 'victory';
  iconSize: number;
  iconColor: string;
  interactive?: boolean;
}> = ({ display, size, fighterMood, iconSize, iconColor, interactive }) =>
  display.fighter ? (
    <FighterAvatar character={display.fighter} size={size} mood={fighterMood} />
  ) : display.weapon ? (
    <WeaponAvatar weapon={display.weapon} size={size} interactive={interactive} />
  ) : (
    <Icon name={display.icon} size={iconSize} color={iconColor} />
  );

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
});
