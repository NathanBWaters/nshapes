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
import { CARD_LIGHT_COLORS, formatBackgroundName, formatColorName, formatShapeName } from '@/utils/cardVisuals';
import type { AttributeName, Background, Color, Shape } from '@/types';
import type { RunState } from '../types';
import type { Modifiers } from '../rules/types';
import { growthModifiers } from '../data/weaponGrowth';
import { modifiersOf } from '../engine/sources';
import { albumTraits } from '../engine/gear';

const INK = COLORS.slateCharcoal;
const CARD_COLORS: Record<string, string> = CARD_LIGHT_COLORS;

/** "blue", "circles", "2s", "striped": the wanted value in the words a player would use. */
export const wantedLabel = (attribute: AttributeName, value: string | number): string => {
  switch (attribute) {
    case 'number': return `${value}s`;
    case 'shape': return formatShapeName(value as Shape, true).toLowerCase();
    case 'color': return formatColorName(value as Color).toLowerCase();
    case 'background': return `${formatBackgroundName(value as Background).toLowerCase()} backs`;
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

const SHORT_ATTR: Record<AttributeName, string> = {
  shape: 'Shp',
  color: 'Col',
  number: 'Num',
  shading: 'Shd',
  background: 'Bg',
};

/** Whether any trick weapon has a chip to show right now. */
export const hasTrickGearChips = (m: Modifiers): boolean =>
  (m.bountyDamage ?? 0) > 0 ||
  (m.snowballStep ?? 0) > 0 ||
  (m.albumDamage ?? 0) > 0 ||
  (m.glassDamage ?? 0) > 0;

/** Whether any live gear tracker chip is active right now. */
export const hasGearChips = (m: Modifiers): boolean => hasTrickGearChips(m);

export const GearChips: React.FC<{
  run: RunState;
  mods: Modifiers;
  onInspectWeapon?: (weaponId: string) => void;
}> = ({ run, mods: m, onInspectWeapon }) => {
  const g = run.gear;
  const glassWindowMs = (m.glassWindowMs ?? 0) > 0
    ? (m.glassWindowMs ?? 0) + 1500 * Math.max(0, run.attributes.length - 3)
    : 0;
  const glassLeft = Math.max(0, Math.ceil((glassWindowMs - (run.elapsedMs - g.glassSinceMs)) / 1000));
  const pages = g.albumPages ?? albumTraits(run.attributes);
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
      {(m.bountyDamage ?? 0) > 0 && g.bounty && wrap(
        'bounty-poster',
        'run-bounty-chip',
        [st.chip, st.wanted],
        <>
          <Icon name="delapouite/wanted-reward" size={11} color={INK} />
          {g.bounty.attribute === 'color' && <View style={[st.dot, { backgroundColor: CARD_COLORS[String(g.bounty.value)] ?? INK }]} />}
          <Text style={st.text} numberOfLines={1}>
            {g.bounty.attribute === 'number'
              ? `#${g.bounty.value} · ${g.bounty.left}`
              : `${wantedLabel(g.bounty.attribute, g.bounty.value)} · ${g.bounty.left}`}
          </Text>
        </>,
        `Wanted: ${wantedLabel(g.bounty.attribute, g.bounty.value)}, ${g.bounty.left} left`
      )}
      {(m.snowballStep ?? 0) > 0 && wrap(
        'snowball',
        'run-snowball-chip',
        [st.chip, g.snowball > 0 && st.cold],
        <>
          <Icon name="lorc/snowman" size={11} color={INK} />
          <Text style={st.text} numberOfLines={1}>+{g.snowball * (m.snowballStep ?? 0)}/{Math.round(m.snowballMax ?? 0)}</Text>
        </>,
        `Snowball bonus +${g.snowball * (m.snowballStep ?? 0)} of ${Math.round(m.snowballMax ?? 0)}`
      )}
      {(m.albumDamage ?? 0) > 0 && wrap(
        'collectors-album',
        'run-album-chip',
        st.chip,
        <>
          <Icon name="delapouite/post-stamp" size={11} color={INK} />
          {pages.map(a => (
            <View key={a} style={[st.page, g.album.includes(a) && st.pageDone]}>
              <Text style={[st.pageText, g.album.includes(a) && st.pageTextDone]}>{SHORT_ATTR[a] ?? a}</Text>
            </View>
          ))}
        </>,
        `Collector's Album: ${g.album.length} of ${pages.length} pages filled`
      )}
      {(m.glassDamage ?? 0) > 0 && wrap(
        'glass-sword',
        'run-glass-chip',
        [st.chip, g.glassBroken ? st.broken : glassLeft <= 2 ? st.danger : st.glass],
        <>
          <Icon name="lorc/shard-sword" size={11} color={g.glassBroken ? '#9CA3AF' : INK} />
          <Text style={[st.text, g.glassBroken && st.brokenText]} numberOfLines={1}>
            {g.glassBroken
              ? ((g.glassReforgeStreak ?? 0) > 0 ? `Broken ${g.glassReforgeStreak}/3` : 'Broken')
              : `+${Math.round(m.glassDamage ?? 0)} · ${glassLeft}s`}
          </Text>
        </>,
        g.glassBroken
          ? `Glass Sword shattered${(g.glassReforgeStreak ?? 0) > 0 ? `, reforge ${g.glassReforgeStreak} of 3` : ''}`
          : `Glass Sword +${Math.round(m.glassDamage ?? 0)} damage, ${glassLeft} seconds left`
      )}
    </>
  );
};

const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 5.5, paddingVertical: 1 },
  text: { flexShrink: 1, fontSize: 9.5, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'] },
  wanted: { backgroundColor: '#FEF3C7' },
  cold: { backgroundColor: '#DBEAFE' },
  glass: { backgroundColor: '#E0F2FE' },
  danger: { backgroundColor: '#FECACA' },
  broken: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
  brokenText: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: INK },
  page: { borderRadius: 3, borderWidth: 1, borderColor: '#9CA3AF', borderStyle: 'dashed', paddingHorizontal: 3 },
  pageDone: { backgroundColor: '#BBF7D0', borderColor: INK, borderStyle: 'solid' },
  pageText: { fontSize: 8.5, fontWeight: '800', color: '#6B7280' },
  pageTextDone: { color: INK },
});
