/**
 * Live trackers for the trick weapons (engine/gear.ts) in the fight HUD:
 * what is wanted, how big the Snowball is, which Album pages are filled, and
 * whether the Glass Sword is still in one piece. Weapons whose state is on the
 * cards themselves (Magnet's mark, twins, the wild card, fog) need no chip.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { cardBgPatternMeta, cardColorCode, cardColorHex, cardColorLabel, useColorblind } from '@/utils/cardColors';
import { formatShapeName } from '@/utils/cardVisuals';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import type { AttributeName, Shape } from '@/types';
import type { RunState } from '../types';
import type { Modifiers } from '../rules/types';
import { growthModifiers } from '../data/weaponGrowth';
import { modifiersOf } from '../engine/sources';
import { albumTraits } from '../engine/gear';

const INK = COLORS.slateCharcoal;
/** "pink", "circles", "2s", "striped" (or Colorblind "orange (O)", "blue (B)", "pink (P)", "mist (M) backs"): the wanted value in player words. */
export const wantedLabel = (
  attribute: AttributeName,
  value: string | number,
  colorblind = false
): string => {
  switch (attribute) {
    case 'number': return `${value}s`;
    case 'shape': return formatShapeName(value as Shape, true).toLowerCase();
    case 'color': {
      const name = cardColorLabel(String(value), colorblind);
      return colorblind ? `${name} (${cardColorCode(String(value), true)})` : name;
    }
    case 'background': {
      const meta = cardBgPatternMeta(String(value), colorblind);
      return colorblind ? `${meta.word} (${meta.code}) backs` : `${meta.word} backs`;
    }
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

/** Readable trait icons & names for Collector's Album replacing opaque [Shp][Col][Num][Shd] ([UI-19]). */
const ALBUM_TRAIT_META: Record<AttributeName, { icon: IconName; label: string }> = {
  shape: { icon: 'lorc/diamond-hard', label: 'Shape' },
  color: { icon: 'lorc/crystal-shine', label: 'Color' },
  number: { icon: 'lorc/cycle', label: 'Number' },
  shading: { icon: 'lorc/stone-block', label: 'Shading' },
  background: { icon: 'lorc/field', label: 'Background' },
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
  /** [UI-15] Require long-press during active Parry wind-up or card selection on mobile portrait */
  guardPress?: boolean;
  /** [UI-15]/[UI-17] Keep hitSlop.bottom = 0 on portrait so chips never bleed into row-0 cards */
  noBottomBleed?: boolean;
  onInspectWeapon?: (weaponId: string) => void;
}> = ({ run, mods: m, guardPress = false, noBottomBleed = false, onInspectWeapon }) => {
  const colorblind = useColorblind();
  const textScale = useTextScale();
  const g = run.gear;
  const glassWindowMs = (m.glassWindowMs ?? 0) > 0
    ? (m.glassWindowMs ?? 0) + 1500 * Math.max(0, run.attributes.length - 3)
    : 0;
  const glassLeft = Math.max(0, Math.ceil((glassWindowMs - (run.elapsedMs - g.glassSinceMs)) / 1000));
  const pages = g.albumPages ?? albumTraits(run.attributes);
  const chipHitSlop = noBottomBleed
    ? { top: 20, bottom: 0, left: 6, right: 6 }
    : { top: 10, bottom: 10, left: 6, right: 6 };
  const scaledText = { fontSize: scaleText(11, textScale) };

  const wrap = (weaponId: string, testID: string, style: object, children: React.ReactNode, accessibilityLabel?: string) =>
    onInspectWeapon ? (
      <TouchableOpacity
        testID={testID}
        onPress={guardPress ? NOOP_CHIP_PRESS : () => onInspectWeapon(weaponId)}
        onLongPress={guardPress ? () => onInspectWeapon(weaponId) : undefined}
        delayLongPress={250}
        hitSlop={chipHitSlop}
        activeOpacity={guardPress ? 1 : 0.75}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </TouchableOpacity>
    ) : (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={style}>{children}</View>
    );
  const bountyText = g.bounty ? wantedLabel(g.bounty.attribute, g.bounty.value, colorblind) : '';
  const bountyColorHex = g.bounty?.attribute === 'color' ? cardColorHex(String(g.bounty.value), 'white', colorblind) : INK;
  const collectedNames = pages.filter(a => g.album.includes(a)).map(a => ALBUM_TRAIT_META[a]?.label ?? a);
  return (
    <>
      {(m.bountyDamage ?? 0) > 0 && g.bounty && wrap(
        'bounty-poster',
        'run-bounty-chip',
        [st.chip, st.wanted],
        <>
          <Icon name="delapouite/wanted-reward" size={12} color={INK} />
          {g.bounty.attribute === 'color' && (
            <View testID="run-bounty-color-dot" style={[st.dot, { backgroundColor: bountyColorHex }]} />
          )}
          <Text style={[st.text, scaledText]} numberOfLines={1}>
            {g.bounty.attribute === 'number'
              ? `#${g.bounty.value} · ${g.bounty.left}`
              : `${bountyText} · ${g.bounty.left}`}
          </Text>
        </>,
        `Wanted: ${bountyText}, ${g.bounty.left} left`
      )}
      {(m.snowballStep ?? 0) > 0 && wrap(
        'snowball',
        'run-snowball-chip',
        [st.chip, g.snowball > 0 && st.cold],
        <>
          <Icon name="lorc/snowman" size={12} color={INK} />
          <Text style={[st.text, scaledText]} numberOfLines={1}>+{g.snowball * (m.snowballStep ?? 0)}/{Math.round(m.snowballMax ?? 0)}</Text>
        </>,
        `Snowball bonus +${g.snowball * (m.snowballStep ?? 0)} of ${Math.round(m.snowballMax ?? 0)}`
      )}
      {(m.albumDamage ?? 0) > 0 && wrap(
        'collectors-album',
        'run-album-chip',
        st.chip,
        <>
          <Icon name="delapouite/post-stamp" size={12} color={INK} />
          {pages.map(a => {
            const meta = ALBUM_TRAIT_META[a];
            const done = g.album.includes(a);
            return (
              <View
                key={a}
                testID={`album-page-${a}`}
                accessibilityLabel={`${meta?.label ?? a}${done ? ' collected' : ''}`}
                style={[st.page, done && st.pageDone]}
              >
                <Icon name={meta?.icon ?? 'lorc/diamond-hard'} size={11} color={done ? INK : '#6B7280'} />
                {done && <Text style={st.pageCheck}>✓</Text>}
              </View>
            );
          })}
        </>,
        `Collector's Album: ${g.album.length} of ${pages.length} traits filled${collectedNames.length > 0 ? ` (${collectedNames.join(', ')})` : ''}`
      )}
      {(m.glassDamage ?? 0) > 0 && wrap(
        'glass-sword',
        'run-glass-chip',
        [st.chip, g.glassBroken ? st.broken : glassLeft <= 2 ? st.danger : st.glass],
        <>
          <Icon name="lorc/shard-sword" size={12} color={g.glassBroken ? '#6B7280' : INK} />
          <Text style={[st.text, scaledText, g.glassBroken && st.brokenText]} numberOfLines={1}>
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

const NOOP_CHIP_PRESS = () => {};

const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3.5, minHeight: 22, maxWidth: '100%', backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6.5, paddingVertical: 1.5 },
  text: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'] },
  wanted: { backgroundColor: '#FEF3C7' },
  cold: { backgroundColor: '#DBEAFE' },
  glass: { backgroundColor: '#E0F2FE' },
  danger: { backgroundColor: '#FECACA' },
  broken: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
  brokenText: { color: '#6B7280', textDecorationLine: 'line-through' },
  dot: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1, borderColor: INK },
  page: { flexDirection: 'row', alignItems: 'center', gap: 1, borderRadius: 4, borderWidth: 1, borderColor: '#9CA3AF', borderStyle: 'dashed', paddingHorizontal: 3, paddingVertical: 1 },
  pageDone: { backgroundColor: '#BBF7D0', borderColor: INK, borderStyle: 'solid' },
  pageCheck: { fontSize: 11, lineHeight: 12, fontWeight: '900', color: INK },
});
