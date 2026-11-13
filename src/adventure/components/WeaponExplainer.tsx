/**
 * One weapon, explained. The same card everywhere a weapon needs explaining:
 * under the charms before a fight, and in the replay after one (where it
 * also says what the weapon did).
 *
 * Closed, it is the weapon's picture, name, what kind of weapon it is and
 * what it does in full sentences at a readable size. Tap it to open "more":
 * what to look for on a card, how to play it, its numbers and its sound.
 *
 * Everything comes from the weapon itself (`description`, its stat lines) and
 * from its row in data/weaponGuide.ts, so a new weapon needs no work here.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { band } from '@/audio';
import { INSTRUMENT_NAMES } from '@/audio/instruments';
import { weaponVoice } from '@/audio/voices';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { armoryBaseWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_KINDS, weaponGuide } from '../data/weaponGuide';
import { WEAPON_ROLES, weaponRole } from '../data/weaponRoles';
import { BASE_BUILD, formatStat, weaponStatLines, type WeaponBuild } from '../data/weaponStats';
import { INK } from './ui';

interface Props {
  weapon: Weapon;
  /** Level and tuning, for the numbers (defaults to level 1, untuned) */
  build?: WeaponBuild;
  /** A small label on the right of the name: "Equipped", "Preview"… */
  badge?: string;
  /** After a fight: what it did, in words, and its share of the damage (0..1) for the bar */
  result?: { text: string; share?: number };
  /** Start with "more" open */
  defaultOpen?: boolean;
  testID?: string;
}

const roleLabel = (id: string) => WEAPON_ROLES.find(r => r.id === weaponRole(id))?.label ?? '';

const WeaponExplainer: React.FC<Props> = ({ weapon, build = BASE_BUILD, badge, result, defaultOpen = false, testID }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [taps, setTaps] = useState(0);
  const guide = weaponGuide(weapon.id);
  const kind = WEAPON_KINDS[guide.kind];
  const base = armoryBaseWeapon(weapon.id);
  const stats = base ? weaponStatLines(base, build) : [];
  const voice = weaponVoice(weapon.id);

  return (
    <View style={st.card} testID={testID ?? `weapon-explainer-${weapon.id}`}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${weapon.name}: ${open ? 'hide' : 'show'} more`}
        testID={`weapon-explainer-toggle-${weapon.id}`}
      >
        <View style={st.head}>
          <WeaponAvatar weapon={weapon} size={44} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>{weapon.name}{weaponLevelSuffix(build.level)}</Text>
              {badge && <Text style={st.badge}>{badge}</Text>}
            </View>
            <View style={st.tags}>
              <View style={[st.kind, { backgroundColor: kind.color }]}><Text style={st.kindText}>{kind.label.toUpperCase()}</Text></View>
              <Text style={st.role}>{roleLabel(weapon.id)}</Text>
            </View>
          </View>
          <Text style={st.caret}>{open ? '▲' : '▼'}</Text>
        </View>
        <Text style={st.what} testID={`weapon-explainer-what-${weapon.id}`}>{weapon.description}</Text>
        {result && (
          <View style={st.result} testID={`weapon-explainer-result-${weapon.id}`}>
            <Text style={st.resultLabel}>THIS FIGHT</Text>
            <Text style={st.resultText}>{result.text}</Text>
            {result.share !== undefined && result.share > 0 && (
              <View style={st.track}><View style={[st.bar, { width: `${Math.max(3, Math.min(100, result.share * 100))}%` }]} /></View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {open && (
        <View style={st.more} testID={`weapon-explainer-more-${weapon.id}`}>
          <Row icon="lorc/crystal-shine" title={kind.label} color={kind.color}>{kind.blurb}</Row>
          {guide.look && (
            <View style={st.row}>
              <View style={[st.mark, { borderColor: guide.look.color ?? INK }]}>
                <Icon name={guide.look.icon ?? 'lorc/magnifying-glass'} size={16} color={guide.look.color ?? INK} />
              </View>
              <Text style={st.rowText}><Text style={st.rowTitle}>Look for: </Text>{guide.look.text}</Text>
            </View>
          )}
          {!!guide.tip && <Row icon="lorc/light-bulb" title="How to play it" color="#B45309">{guide.tip}</Row>}
          {stats.length > 0 && (
            <View style={st.numbers}>
              {stats.map(line => (
                <View key={line.key} style={st.number}>
                  <Text style={st.numberValue}>{formatStat(line.unit, line.value)}</Text>
                  <Text style={st.numberLabel}>{line.label}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            onPress={() => { setTaps(t => t + 1); band.audition(weapon.id); }}
            style={st.sound}
            accessibilityRole="button"
            accessibilityLabel={`Hear ${weapon.name}`}
            testID={`weapon-explainer-sound-${weapon.id}`}
          >
            <Icon name="delapouite/sound-on" size={16} color={INK} />
            <Text style={st.rowText}>
              <Text style={st.rowTitle}>{taps > 0 ? 'Playing: ' : 'Hear it: '}</Text>
              {INSTRUMENT_NAMES[voice.inst]}. {voice.why}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const Row: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; title: string; color: string; children: React.ReactNode }> = ({ icon, title, color, children }) => (
  <View style={st.row}>
    <View style={[st.mark, { borderColor: color }]}><Icon name={icon} size={16} color={color} /></View>
    <Text style={st.rowText}><Text style={st.rowTitle}>{title}: </Text>{children}</Text>
  </View>
);

const st = StyleSheet.create({
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderColor: INK, borderBottomWidth: 4, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '900', color: INK },
  badge: { fontSize: 10, fontWeight: '800', color: INK, backgroundColor: COLORS.actionYellow, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  kindText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: COLORS.canvasWhite },
  role: { fontSize: 11, fontWeight: '600', color: INK, opacity: 0.65 },
  caret: { fontSize: 12, color: INK, opacity: 0.6, paddingHorizontal: 4 },
  what: { fontSize: 15, lineHeight: 21, color: INK, marginTop: 8 },
  result: { marginTop: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, gap: 3 },
  resultLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.6 },
  resultText: { fontSize: 14, fontWeight: '700', color: INK },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E6E0D7', overflow: 'hidden', marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#eb6834' },
  more: { gap: 10, borderTopWidth: 1, borderTopColor: '#E6E0D7', paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvasWhite },
  rowText: { flex: 1, fontSize: 14, lineHeight: 20, color: INK },
  rowTitle: { fontWeight: '900' },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  number: { backgroundColor: COLORS.paperBeige, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 92 },
  numberValue: { fontSize: 16, fontWeight: '900', color: INK },
  numberLabel: { fontSize: 11, color: INK, opacity: 0.7 },
  sound: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
});

export default WeaponExplainer;
