/** Field Guide — every mechanic you've met, in the order the map teaches them. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { AdventureSave, MechanicDef } from '../types';
import { LEVELS } from '../data/levels';
import { FIGHTERS } from '../data/fighters';
import { MECHANICS } from '../data/mechanics';
import MechanicIntro from './MechanicIntro';
import { INK } from './ui';

interface Props {
  save: AdventureSave;
  onClose: () => void;
}

const FieldGuide: React.FC<Props> = ({ save, onClose }) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<MechanicDef | null>(null);
  const entries: Array<{ m: MechanicDef; where: string; known: boolean }> = [
    ...LEVELS.map(l => ({ m: MECHANICS[l.introduces], where: l.id, known: save.seenMechanics.includes(l.introduces) || (save.stars[l.id] ?? 0) > 0 })),
    ...FIGHTERS.map(f => ({ m: MECHANICS[f.signature], where: 'Fighter', known: save.unlockedFighters.includes(f.name) })),
  ];
  const known = entries.filter(e => e.known).length;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={onClose} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name="lorc/open-book" size={22} color={INK} />
        <Text style={st.title}>FIELD GUIDE</Text>
        <View style={{ flex: 1 }} />
        <Text style={st.count}>{known}/{entries.length}</Text>
      </View>
      <ScrollView contentContainerStyle={[st.grid, { paddingBottom: insets.bottom + 24 }]}>
        {entries.map(({ m, where, known: k }) => (
          <TouchableOpacity key={m.id} disabled={!k} onPress={() => setOpen(m)} style={[st.entry, !k && st.entryLocked]} activeOpacity={0.85}>
            <View style={st.icon}><Icon name={k ? m.icon : 'lorc/uncertainty'} size={28} color={k ? INK : '#A69F95'} /></View>
            <Text style={st.name} numberOfLines={2}>{k ? m.title : '???'}</Text>
            <Text style={st.where}>{where}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <MechanicIntro mechanic={open} onClose={() => setOpen(null)} cta="Close" />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 16 },
  count: { fontWeight: '900', color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, justifyContent: 'center', maxWidth: 620, alignSelf: 'center' },
  entry: { width: 104, alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 8 },
  entryLocked: { borderColor: '#CFC8BD', backgroundColor: '#EFEAE2' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '800', color: INK, textAlign: 'center' },
  where: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.6 },
});

export default FieldGuide;
