/**
 * Unlock reveal — every new fighter or weapon gets its own full-screen moment:
 * a silhouette on a field of light, a tap to reveal, then a card explaining
 * exactly how the new thing works and a button to start using it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation } from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { COLORS, getRarityColor } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave } from '../types';
import type { Unlock } from '../progress';
import { getFighter, getLoadout } from '../data/fighters';
import { abilityFor } from '../data/abilities';
import { MECHANICS } from '../data/mechanics';
import { INK } from './ui';

const GOLD = COLORS.actionYellow;
const TEXT = '#F1ECE4';
const MUTED = '#B9B1A5';

const weapon = (id: string) => WEAPONS.find(w => w.id === id);

/** Weapon text was written for score-based modes. In Adventure a point is a point of damage. */
export const adventureText = (t: string) => t.replace(/\+(\d+) points?/g, '+$1 damage');

/** A dark cut-out of an icon with a question mark — used wherever a reward is still secret. */
export const Silhouette: React.FC<{ icon: IconName; size?: number; light?: boolean }> = ({ icon, size = 28, light }) => (
  <View style={[sil.wrap, { width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75, backgroundColor: light ? '#E6DFD5' : '#2A2826' }]}>
    <Icon name={icon} size={size} color={light ? '#3A3632' : '#0B0B0B'} />
    <Text style={[sil.q, { fontSize: size * 0.6, color: light ? COLORS.canvasWhite : GOLD }]}>?</Text>
  </View>
);

const sil = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  q: { position: 'absolute', fontWeight: '900' },
});

const Rays: React.FC<{ color: string }> = ({ color }) => {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <Animated.View style={[st.rays, style]} pointerEvents="none">
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={[st.ray, { backgroundColor: color, transform: [{ rotate: `${i * 15}deg` }] }]} />
      ))}
    </Animated.View>
  );
};

interface Props {
  unlocks: Unlock[];
  save: AdventureSave;
  onUseFighter: (name: CharacterName) => void;
  onEquipCharm: (id: string) => void;
  onDone: () => void;
}

const UnlockReveal: React.FC<Props> = ({ unlocks, save, onUseFighter, onEquipCharm, onDone }) => {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const flash = useSharedValue(0);
  const scale = useSharedValue(1);
  const detail = useSharedValue(0);

  useEffect(() => {
    setI(0);
    setRevealed(false);
  }, [unlocks]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detail.value, transform: [{ translateY: (1 - detail.value) * 12 }] }));

  const u = unlocks[i];
  if (!u) return null;

  const isFighter = u.kind === 'fighter';
  const fighter = isFighter ? getFighter(u.name) : null;
  const w = !isFighter ? weapon(u.id) : null;
  const icon: IconName = fighter?.icon ?? w?.icon ?? 'lorc/gems';
  const accent = isFighter ? GOLD : w && w.rarity !== 'common' ? getRarityColor(w.rarity) : GOLD;
  const ability = fighter ? abilityFor(fighter.name) : null;
  const signature = fighter ? MECHANICS[fighter.signature] : null;

  const reveal = () => {
    sfx('unlock');
    setRevealed(true);
    flash.value = withSequence(withTiming(0.9, { duration: 70 }), withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }));
    scale.value = withSequence(withTiming(1.12, { duration: 140, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }));
    detail.value = 0;
    detail.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  };

  const advance = () => {
    if (i + 1 < unlocks.length) {
      setRevealed(false);
      setI(i + 1);
    } else onDone();
  };

  const charmEquipped = !isFighter && save.charm === u.id;

  return (
    <Modal visible transparent animationType="fade">
      <View style={st.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} pointerEvents="none" />
        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <Text style={st.eyebrow}>{'★'.repeat(u.star)} reward{unlocks.length > 1 ? `  ·  ${i + 1} of ${unlocks.length}` : ''}</Text>
          <Text style={st.headline}>{isFighter ? 'New fighter unlocked!' : 'New weapon unlocked!'}</Text>

          <View style={st.heroWrap}>
            <Rays color={accent} />
            <Animated.View style={[st.hero, { borderColor: accent, backgroundColor: revealed ? COLORS.canvasWhite : '#151413' }, heroStyle]}>
              <Icon name={icon} size={92} color={revealed ? INK : '#050505'} />
              {!revealed && <Text style={st.heroQ}>?</Text>}
            </Animated.View>
          </View>

          {!revealed ? (
            <>
              <Text style={st.tease}>{isFighter ? 'Someone wants to join your team.' : 'Something new for your Armory.'}</Text>
              <TouchableOpacity testID="unlock-reveal" onPress={reveal} style={st.cta} activeOpacity={0.85}>
                <Text style={st.ctaText}>Reveal</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={[{ alignSelf: 'stretch', gap: 12, alignItems: 'center' }, detailStyle]}>
              <Text style={st.name}>{fighter?.name ?? w?.name}</Text>
              {w && <Text style={[st.rarity, { color: accent }]}>{w.rarity.toUpperCase()} WEAPON</Text>}
              {fighter && <Text style={[st.rarity, { color: accent }]}>FIGHTER</Text>}

              <View style={st.card}>
                <Text style={st.cardTitle}>How it works</Text>
                {fighter && ability && (
                  <>
                    <View style={st.row}>
                      <View style={st.rowIcon}><Icon name={ability.icon} size={22} color={INK} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.rowTitle}>{ability.name} <Text style={st.rowTag}>{ability.kind === 'active' ? 'TAP TO USE' : 'ALWAYS ON'}</Text></Text>
                        <Text style={st.rowBody}>{ability.short}</Text>
                      </View>
                    </View>
                    {getLoadout(fighter.name, 1).map((id, k) => {
                      const g = weapon(id);
                      return g ? (
                        <View key={k} style={st.row}>
                          <View style={st.rowIcon}>{g.icon && <Icon name={g.icon} size={22} color={INK} />}</View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowTitle}>{g.name} <Text style={st.rowTag}>STARTING GEAR</Text></Text>
                            <Text style={st.rowBody}>{adventureText(g.description)}</Text>
                          </View>
                        </View>
                      ) : null;
                    })}
                    {signature && <Text style={st.note}>{signature.tagline}</Text>}
                  </>
                )}
                {w && (
                  <>
                    <Text style={st.rowBody}>{adventureText(w.description)}</Text>
                    {w.flavorText ? <Text style={st.note}>{adventureText(w.flavorText)}</Text> : null}
                    {u.kind === 'weapon' && u.firstWeapon && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>Your first charm</Text>
                        {MECHANICS.charm.body.map((p, k) => <Text key={k} style={st.rowBody}>{p}</Text>)}
                      </View>
                    )}
                  </>
                )}
              </View>

              {fighter && (
                <>
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); onUseFighter(fighter.name); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>Fight as {fighter.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={advance} style={st.secondary}>
                    <Text style={st.secondaryText}>Keep {save.selectedFighter} for now</Text>
                  </TouchableOpacity>
                </>
              )}
              {w && (
                charmEquipped ? (
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>Equipped ✓  Continue</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); onEquipCharm(w.id); advance(); }} style={st.cta} activeOpacity={0.85}>
                      <Text style={st.ctaText}>Equip as charm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Keep my current charm</Text>
                    </TouchableOpacity>
                  </>
                )
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,8,8,0.94)' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12, maxWidth: 460, width: '100%', alignSelf: 'center' },
  eyebrow: { color: GOLD, fontWeight: '800', letterSpacing: 2.5, fontSize: 12, textTransform: 'uppercase' },
  headline: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 28, textAlign: 'center' },
  heroWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  rays: { position: 'absolute', width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 5, height: 240, opacity: 0.16, borderRadius: 3 },
  hero: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  heroQ: { position: 'absolute', color: GOLD, fontSize: 64, fontWeight: '900' },
  tease: { color: MUTED, fontSize: 16, textAlign: 'center' },
  name: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 30, textAlign: 'center' },
  rarity: { fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  card: { alignSelf: 'stretch', backgroundColor: '#1C1B19', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,222,0,0.3)', padding: 14, gap: 12 },
  cardTitle: { color: GOLD, fontWeight: '800', letterSpacing: 2, fontSize: 11, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 16 },
  rowTag: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rowBody: { color: TEXT, fontSize: 15, lineHeight: 21 },
  note: { color: MUTED, fontSize: 13, fontStyle: 'italic' },
  charmBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10, gap: 6 },
  cta: { alignSelf: 'stretch', backgroundColor: GOLD, borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  secondary: { paddingVertical: 8 },
  secondaryText: { color: MUTED, fontWeight: '700', textDecorationLine: 'underline' },
});

export default UnlockReveal;
