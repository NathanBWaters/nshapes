/**
 * Live trackers for the trick weapons (engine/gear.ts) in the fight HUD:
 * what is wanted, how big the Snowball is, which Album pages are filled, and
 * whether the Glass Sword is still in one piece. Weapons whose state is on the
 * cards themselves (Magnet's mark, twins, the wild card, fog) need no chip.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { AttributeName } from '@/types';
import type { RunState } from '../types';
import type { Modifiers } from '../rules/types';
import { modifiersOf } from '../engine/sources';
import { albumTraits } from '../engine/gear';

const INK = COLORS.slateCharcoal;
const CARD_COLORS: Record<string, string> = { red: '#EF4444', green: '#16A34A', purple: '#7C3AED' };

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
  modifiersOf({ skillNodes: run.skillNodes, weapons: run.weapons, activeEvolutions: run.activeEvolutions });

/** Whether any trick weapon has something to show right now. */
export const hasGearChips = (m: Modifiers): boolean =>
  (m.bountyDamage ?? 0) > 0 || (m.snowballStep ?? 0) > 0 || (m.albumDamage ?? 0) > 0 || (m.glassDamage ?? 0) > 0;

export const GearChips: React.FC<{ run: RunState; mods: Modifiers }> = ({ run, mods: m }) => {
  const g = run.gear;
  const glassLeft = Math.max(0, Math.ceil(((m.glassWindowMs ?? 0) - (run.elapsedMs - g.glassSinceMs)) / 1000));
  const pages = albumTraits(run.attributes);
  return (
    <>
      {(m.bountyDamage ?? 0) > 0 && g.bounty && (
        <View testID="run-bounty-chip" style={[st.chip, st.wanted]}>
          <Icon name="delapouite/wanted-reward" size={12} color={INK} />
          <Text style={st.text}>WANTED</Text>
          {g.bounty.attribute === 'color' && <View style={[st.dot, { backgroundColor: CARD_COLORS[String(g.bounty.value)] ?? INK }]} />}
          <Text style={st.text}>{wantedLabel(g.bounty.attribute, g.bounty.value)} · {g.bounty.left} left</Text>
        </View>
      )}
      {(m.snowballStep ?? 0) > 0 && (
        <View testID="run-snowball-chip" style={[st.chip, g.snowball > 0 && st.cold]}>
          <Icon name="lorc/snowman" size={12} color={INK} />
          <Text style={st.text}>+{g.snowball * (m.snowballStep ?? 0)} / {Math.round(m.snowballMax ?? 0)}</Text>
        </View>
      )}
      {(m.albumDamage ?? 0) > 0 && (
        <View testID="run-album-chip" style={st.chip}>
          <Icon name="delapouite/post-stamp" size={12} color={INK} />
          {pages.map(a => (
            <View key={a} style={[st.page, g.album.includes(a) && st.pageDone]}>
              <Text style={[st.pageText, g.album.includes(a) && st.pageTextDone]}>{a}</Text>
            </View>
          ))}
        </View>
      )}
      {(m.glassDamage ?? 0) > 0 && (
        <View testID="run-glass-chip" style={[st.chip, g.glassBroken ? st.broken : glassLeft <= 2 ? st.danger : st.glass]}>
          <Icon name="lorc/shard-sword" size={12} color={g.glassBroken ? '#9CA3AF' : INK} />
          <Text style={[st.text, g.glassBroken && st.brokenText]}>
            {g.glassBroken ? 'Shattered' : `+${Math.round(m.glassDamage ?? 0)} · ${glassLeft}s`}
          </Text>
        </View>
      )}
    </>
  );
};

const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontSize: 10, fontWeight: '800', color: INK },
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
