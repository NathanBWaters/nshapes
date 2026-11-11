/**
 * "NEW MECHANIC" card — shown before a level that teaches something new,
 * when a fighter unlocks, and from the Field Guide.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { Card as CardType } from '@/types';
import type { MechanicDef, MechanicDemo } from '../types';
import { Btn, Eyebrow, INK, PopIn } from './ui';

const KIND_LABEL: Record<MechanicDef['kind'], string> = {
  rule: 'New Rule',
  feature: 'New Ability',
  threat: 'New Threat',
  fighter: 'New Fighter',
};

const KIND_COLOR: Record<MechanicDef['kind'], string> = {
  rule: COLORS.actionYellow,
  feature: '#9BE3D8',
  threat: '#FFC2BD',
  fighter: '#C9DAFF',
};

export const DemoView: React.FC<{ demo: MechanicDemo }> = ({ demo }) => {
  if (demo.type === 'icons') {
    return (
      <View style={st.iconsRow}>
        {demo.items.map((it, i) => (
          <PopIn key={i} delay={120 + i * 120} style={st.iconItem}>
            <View style={st.iconCircle}>
              <Icon name={it.icon} size={30} color={it.color ?? INK} />
            </View>
            <Text style={st.iconLabel}>{it.label}</Text>
          </PopIn>
        ))}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={st.cardsRow}>
        {demo.cards.map((c, i) => {
          const card: CardType = {
            id: `demo-${i}`,
            shape: c.shape,
            color: c.color,
            number: c.number,
            shading: c.shading,
            background: c.background,
            selected: false,
            ...(c.modifiers ?? {}),
            fireStartTime: c.modifiers?.onFire ? Date.now() + 10_000_000 : undefined,
          };
          return (
            <PopIn key={i} delay={100 + i * 140} style={st.cardSlot}>
              <Card card={card} onClick={() => {}} disabled isPaused />
            </PopIn>
          );
        })}
      </View>
      <View style={[st.verdict, { backgroundColor: demo.valid ? '#D4F4EE' : '#FFE1DE' }]}>
        <Icon name={demo.valid ? 'lorc/checked-shield' : 'lorc/cross-mark'} size={16} color={demo.valid ? COLORS.logicTeal : COLORS.impactRed} />
        <Text style={st.verdictText}>{demo.caption}</Text>
      </View>
    </View>
  );
};

interface Props {
  mechanic: MechanicDef | null;
  onClose: () => void;
  cta?: string;
  eyebrowOverride?: string;
}

const MechanicIntro: React.FC<Props> = ({ mechanic, onClose, cta = "Got it!", eyebrowOverride }) => {
  if (!mechanic) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <PopIn style={st.sheet}>
          <ScrollView contentContainerStyle={{ gap: 14 }} bounces={false}>
            <View style={st.header}>
              <View style={[st.bigIcon, { backgroundColor: KIND_COLOR[mechanic.kind] }]}>
                <Icon name={mechanic.icon} size={40} color={INK} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Eyebrow text={eyebrowOverride ?? KIND_LABEL[mechanic.kind]} color={KIND_COLOR[mechanic.kind]} />
                <Text style={st.title}>{mechanic.title}</Text>
                <Text style={st.tagline}>{mechanic.tagline}</Text>
              </View>
            </View>
            {mechanic.demo && <DemoView demo={mechanic.demo} />}
            <View style={{ gap: 6 }}>
              {mechanic.body.map((p, i) => (
                <Text key={i} style={st.body}>{p}</Text>
              ))}
            </View>
            <Btn testID="mechanic-intro-ok" label={cta} onPress={onClose} />
          </ScrollView>
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 18 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  bigIcon: { width: 68, height: 68, borderRadius: 12, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: INK },
  tagline: { fontSize: 14, fontWeight: '600', color: INK, opacity: 0.8 },
  body: { fontSize: 15, lineHeight: 21, color: INK },
  cardsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cardSlot: { width: 78, height: 104 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1.5, borderColor: INK, maxWidth: 360 },
  verdictText: { fontSize: 13, fontWeight: '700', color: INK, flexShrink: 1 },
  iconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  iconItem: { alignItems: 'center', gap: 4, width: 84 },
  iconCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 12, fontWeight: '800', color: INK, textAlign: 'center' },
});

export default MechanicIntro;
