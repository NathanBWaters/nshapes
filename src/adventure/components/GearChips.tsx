/**
 * Live trackers for the trick weapons (engine/gear.ts) in the fight HUD:
 * what is wanted, how big the Snowball is, which Album pages are filled, and
 * whether the Glass Sword is still in one piece. Weapons whose state is on the
 * cards themselves (Magnet's mark, twins, the wild card, fog) need no chip.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { AttributeName } from '@/types';
import type { RunState } from '../types';
import type { Modifiers } from '../rules/types';
import { growthModifiers } from '../data/weaponGrowth';
import { activeRoleBonuses, weaponRole, type ActiveRoleBonus, type WeaponRole } from '../data/weaponRoles';
import { modifiersOf } from '../engine/sources';
import { albumTraits } from '../engine/gear';

const INK = COLORS.slateCharcoal;
const CARD_COLORS: Record<string, string> = { red: '#EF4444', green: '#16A34A', purple: '#7C3AED' };

const SHORT_ROLE_NAME: Record<WeaponRole, string> = {
  damage: 'Damage',
  tricks: 'Tricks',
  gambles: 'Gambles',
  board: 'Board',
  survival: 'Survival',
  insight: 'Insight',
  tempo: 'Tempo',
  chains: 'Chains',
};

/** Compact mobile-safe pill text for an active 2/4/6 Brotato Role Set Bonus. */
export const compactRoleBonusLabel = (rb: ActiveRoleBonus): string => {
  const name = SHORT_ROLE_NAME[rb.role] ?? rb.label;
  const m = rb.modifiers;
  let effect = rb.summary;
  if (rb.role === 'damage' && m.setDamage) {
    effect = m.rainbowMultiplierBonus ? `+${m.setDamage} & +${m.rainbowMultiplierBonus}×` : `+${m.setDamage}`;
  } else if (rb.role === 'tricks' && m.setDamage) {
    effect = `+${m.setDamage}`;
  } else if (rb.role === 'gambles' && m.gambleBonusPct) {
    effect = `+${m.gambleBonusPct}%`;
  } else if (rb.role === 'board' && m.startingBoardCards) {
    effect = `+${m.startingBoardCards} ${m.startingBoardCards === 1 ? 'card' : 'cards'}`;
  } else if (rb.role === 'survival' && m.maxHearts) {
    effect = `+${m.maxHearts}♥`;
  } else if (rb.role === 'insight' && m.startingHints) {
    effect = `+${m.startingHints} ${m.startingHints === 1 ? 'hint' : 'hints'}`;
  } else if (rb.role === 'tempo' && m.evolutionDurationMs) {
    effect = `+${Math.round(m.evolutionDurationMs / 1000)}s evo`;
  } else if (rb.role === 'chains' && m.startingLinks) {
    effect = `+${m.startingLinks} ${m.startingLinks === 1 ? 'link' : 'links'}`;
  }
  return `${rb.tier}× ${name} ${effect}`;
};

/** "purple", "ovals", "2s", "striped": the wanted value in the words a player would use. */
export const wantedLabel = (attribute: AttributeName, value: string | number): string => {
  switch (attribute) {
    case 'number': return `${value}s`;
    case 'shape': return `${value}s`;
    case 'background': return `${value} backs`;
    default: return String(value);
  }
};

export const gearModifiers = (run: RunState): Modifiers =>
  modifiersOf({
    skillNodes: run.skillNodes,
    weapons: run.weapons,
    activeEvolutions: run.activeEvolutions,
    growth: growthModifiers(run.growth ?? {}),
  });

/** Whether any trick weapon or Role Set Bonus has a chip to show right now. */
export const hasGearChips = (m: Modifiers, weapons?: readonly (string | { id: string })[]): boolean =>
  (m.bountyDamage ?? 0) > 0 ||
  (m.snowballStep ?? 0) > 0 ||
  (m.albumDamage ?? 0) > 0 ||
  (m.glassDamage ?? 0) > 0 ||
  (weapons ? activeRoleBonuses(weapons).length > 0 : false);

export const GearChips: React.FC<{ run: RunState; mods: Modifiers; onInspectWeapon?: (weaponId: string) => void }> = ({ run, mods: m, onInspectWeapon }) => {
  const g = run.gear;
  const glassWindowMs = (m.glassWindowMs ?? 0) > 0
    ? (m.glassWindowMs ?? 0) + 1500 * Math.max(0, run.attributes.length - 3)
    : 0;
  const glassLeft = Math.max(0, Math.ceil((glassWindowMs - (run.elapsedMs - g.glassSinceMs)) / 1000));
  const pages = g.albumPages ?? albumTraits(run.attributes);
  const roleBonuses = activeRoleBonuses(run.weapons);
  const wrap = (weaponId: string, testID: string, style: object, children: React.ReactNode, accessibilityLabel?: string) =>
    onInspectWeapon ? (
      <TouchableOpacity
        testID={testID}
        onPress={() => onInspectWeapon(weaponId)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </TouchableOpacity>
    ) : (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={style}>{children}</View>
    );
  return (
    <>
      {roleBonuses.map(rb => {
        const repId = run.weapons.find(w => weaponRole(w.id) === rb.role)?.id ?? run.weapons[0]?.id ?? '';
        const pillText = compactRoleBonusLabel(rb);
        return (
          <React.Fragment key={`role-${rb.role}`}>
            {wrap(
              repId,
              `run-role-bonus-${rb.role}`,
              [st.chip, st.roleBonus],
              <>
                <Icon name="delapouite/star-formation" size={11} color="#92400E" />
                <Text style={[st.text, st.roleBonusText]} numberOfLines={1}>{pillText}</Text>
              </>,
              `${rb.tier} ${rb.label} Role Set Bonus: ${rb.summary}`
            )}
          </React.Fragment>
        );
      })}
      {(m.bountyDamage ?? 0) > 0 && g.bounty && wrap(
        'bounty-poster',
        'run-bounty-chip',
        [st.chip, st.wanted],
        <>
          <Icon name="delapouite/wanted-reward" size={12} color={INK} />
          <Text style={st.text}>WANTED</Text>
          {g.bounty.attribute === 'color' && <View style={[st.dot, { backgroundColor: CARD_COLORS[String(g.bounty.value)] ?? INK }]} />}
          <Text style={st.text}>{wantedLabel(g.bounty.attribute, g.bounty.value)} · {g.bounty.left} left</Text>
        </>
      )}
      {(m.snowballStep ?? 0) > 0 && wrap(
        'snowball',
        'run-snowball-chip',
        [st.chip, g.snowball > 0 && st.cold],
        <>
          <Icon name="lorc/snowman" size={12} color={INK} />
          <Text style={st.text}>+{g.snowball * (m.snowballStep ?? 0)} / {Math.round(m.snowballMax ?? 0)}</Text>
        </>
      )}
      {(m.albumDamage ?? 0) > 0 && wrap(
        'collectors-album',
        'run-album-chip',
        st.chip,
        <>
          <Icon name="delapouite/post-stamp" size={12} color={INK} />
          {pages.map(a => (
            <View key={a} style={[st.page, g.album.includes(a) && st.pageDone]}>
              <Text style={[st.pageText, g.album.includes(a) && st.pageTextDone]}>{a}</Text>
            </View>
          ))}
        </>
      )}
      {(m.glassDamage ?? 0) > 0 && wrap(
        'glass-sword',
        'run-glass-chip',
        [st.chip, g.glassBroken ? st.broken : glassLeft <= 2 ? st.danger : st.glass],
        <>
          <Icon name="lorc/shard-sword" size={12} color={g.glassBroken ? '#9CA3AF' : INK} />
          <Text style={[st.text, g.glassBroken && st.brokenText]}>
            {g.glassBroken
              ? ((g.glassReforgeStreak ?? 0) > 0 ? `Shattered · ${g.glassReforgeStreak}/3` : 'Shattered')
              : `+${Math.round(m.glassDamage ?? 0)} · ${glassLeft}s`}
          </Text>
        </>
      )}
    </>
  );
};

const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 },
  text: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: INK },
  roleBonus: { backgroundColor: '#FEF3C7', borderColor: '#B45309' },
  roleBonusText: { color: '#78350F', fontWeight: '900' },
  wanted: { backgroundColor: '#FEF3C7' },
  cold: { backgroundColor: '#DBEAFE' },
  glass: { backgroundColor: '#E0F2FE' },
  danger: { backgroundColor: '#FECACA' },
  broken: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
  brokenText: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: INK },
  page: { borderRadius: 3, borderWidth: 1, borderColor: '#9CA3AF', borderStyle: 'dashed', paddingHorizontal: 4 },
  pageDone: { backgroundColor: '#BBF7D0', borderColor: INK, borderStyle: 'solid' },
  pageText: { fontSize: 9, fontWeight: '700', color: '#6B7280' },
  pageTextDone: { color: INK },
});
