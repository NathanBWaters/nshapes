/**
 * Unlock reveal — every new fighter or weapon gets its own full-screen moment:
 * a silhouette on a field of light, a tap to reveal, then a card explaining
 * exactly how the new thing works and a button to start using it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation } from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS, getRarityColor } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId } from '../types';
import type { Unlock } from '../progress';
import { getFighter, getLoadout } from '../data/fighters';
import { abilityFor } from '../data/abilities';
import { getArcana } from '../data/arcana';
import { findEvolvedWeapon, getEvolutionRecipe } from '../data/evolutions';
import { MECHANICS } from '../data/mechanics';
import { INK } from './ui';

const GOLD = COLORS.actionYellow;
const TEXT = '#F1ECE4';
const MUTED = '#B9B1A5';

const weapon = (id: string) => WEAPONS.find(w => w.id === id) ?? findEvolvedWeapon(id);

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
  onEquipArcana?: (id: ArcanaId) => void;
  onOpenBounties?: () => void;
  onOpenWorkshop?: () => void;
  onDone: () => void;
}

const UnlockReveal: React.FC<Props> = ({ unlocks, save, onUseFighter, onEquipCharm, onEquipArcana, onOpenBounties, onOpenWorkshop, onDone }) => {
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

  const fighter = u.kind === 'fighter' ? getFighter(u.name) : null;
  const w = u.kind === 'weapon' ? weapon(u.id) : null;
  const arcana = u.kind === 'arcana' ? getArcana(u.id) : null;
  const evo = u.kind === 'evolution' ? getEvolutionRecipe(u.id) : null;
  const featureMech = u.kind === 'feature' ? (u.feature === 'coins' ? MECHANICS.coins : MECHANICS.workshop) : null;
  const isBountyBoard = u.kind === 'bounty_board';
  const icon: IconName =
    fighter?.icon ??
    w?.icon ??
    evo?.result.icon ??
    arcana?.icon ??
    featureMech?.icon ??
    (isBountyBoard ? 'lorc/trophy' : 'lorc/gems');
  const accent =
    fighter
      ? GOLD
      : evo
        ? getRarityColor('legendary')
        : arcana
          ? '#A855F7'
          : featureMech
            ? GOLD
            : isBountyBoard
              ? '#F59E0B'
              : w && w.rarity !== 'common'
                ? getRarityColor(w.rarity)
                : GOLD;
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

  const charmEquipped = u.kind === 'weapon' && save.charm === u.id;
  const arcanaEquipped = u.kind === 'arcana' && save.activeArcana === u.id;
  const sourceLabel = u.star === 0 ? 'Bounty reward' : `${'★'.repeat(u.star)} reward`;
  const headline =
    u.kind === 'fighter'
      ? 'New fighter unlocked!'
      : u.kind === 'weapon'
        ? 'New weapon unlocked!'
        : u.kind === 'evolution'
          ? 'New weapon combo unlocked!'
          : u.kind === 'arcana'
            ? 'New Arcana unlocked!'
            : u.kind === 'feature'
              ? u.feature === 'coins'
                ? 'Coin Drops unlocked!'
                : 'The Workshop unlocked!'
              : 'Bounty Board unlocked!';
  const tease =
    u.kind === 'fighter'
      ? 'Someone wants to join your team.'
      : u.kind === 'weapon'
        ? 'Something new for your Armory.'
        : u.kind === 'evolution'
          ? 'Two weapons can now fuse into a Legendary power!'
          : u.kind === 'arcana'
            ? 'A tarot wildcard that twists the rules of battle.'
            : u.kind === 'feature'
              ? u.feature === 'coins'
                ? 'Every fight can now drop shiny coins for Camp!'
                : 'Upgrade your unlocked mechanics and Armory weapons at Camp!'
              : 'Your feats across every fight now earn extra loot!';

  return (
    <Modal visible transparent animationType="fade">
      <View testID="unlock-modal" style={st.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} pointerEvents="none" />
        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <Text style={st.eyebrow}>{sourceLabel}{unlocks.length > 1 ? `  ·  ${i + 1} of ${unlocks.length}` : ''}</Text>
          <Text style={st.headline}>{headline}</Text>

          <View style={st.heroWrap}>
            <Rays color={accent} />
            <Animated.View style={[st.hero, { borderColor: accent, backgroundColor: revealed ? COLORS.canvasWhite : '#151413' }, heroStyle]}>
              {revealed && fighter ? (
                <FighterAvatar
                  testID="unlock-revealed-fighter"
                  character={fighter.name}
                  size={116}
                  mood="victory"
                  reaction={{ type: 'ecstatic', id: i + 1 }}
                  interactive
                />
              ) : revealed && (w || evo) ? (
                <WeaponAvatar
                  testID="unlock-revealed-weapon"
                  weapon={w ?? evo!.result}
                  size={108}
                  interactive
                />
              ) : (
                <Icon name={icon} size={92} color={revealed ? INK : '#050505'} />
              )}
              {!revealed && <Text style={st.heroQ}>?</Text>}
            </Animated.View>
          </View>

          {!revealed ? (
            <>
              <Text style={st.tease}>{tease}</Text>
              <TouchableOpacity testID="unlock-reveal" onPress={reveal} style={st.cta} activeOpacity={0.85}>
                <Text style={st.ctaText}>Reveal</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={[{ alignSelf: 'stretch', gap: 12, alignItems: 'center' }, detailStyle]}>
              <Text style={st.name}>
                {fighter?.name ??
                  w?.name ??
                  evo?.result.name ??
                  featureMech?.title ??
                  (arcana ? `Arcana ${arcana.numeral}: ${arcana.name}` : 'Cross-Run Bounties')}
              </Text>
              {w && <Text style={[st.rarity, { color: accent }]}>{w.rarity.toUpperCase()} WEAPON</Text>}
              {evo && <Text style={[st.rarity, { color: accent }]}>WEAPON COMBO RECIPE</Text>}
              {fighter && <Text style={[st.rarity, { color: accent }]}>FIGHTER</Text>}
              {arcana && <Text style={[st.rarity, { color: accent }]}>ARCANA WILDCARD</Text>}
              {featureMech && <Text style={[st.rarity, { color: accent }]}>NEW ABILITY UNLOCKED</Text>}
              {isBountyBoard && <Text style={[st.rarity, { color: accent }]}>NEW SYSTEM UNLOCKED</Text>}

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
                          <View style={st.rowIcon}><WeaponAvatar weapon={g} size={28} interactive /></View>
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
                {evo && (
                  <>
                    <Text style={st.rowBody}>{adventureText(evo.result.description)}</Text>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>Weapons: {evo.gearRequirementText}</Text>
                    <Text style={[st.rowBody, { color: '#FCD34D' }]}>Awaken: {evo.primeRequirementText} + match Catalyst card</Text>
                    <Text style={st.note}>Evolution Burst: {evo.burstText}</Text>
                    {u.kind === 'evolution' && u.firstEvolution && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>How Hidden Catalysts Work</Text>
                        {MECHANICS.weapon_evolutions.body.map((p, k) => <Text key={k} style={st.rowBody}>{p}</Text>)}
                      </View>
                    )}
                  </>
                )}
                {featureMech && (
                  <>
                    {featureMech.body.map((p, k) => (
                      <Text key={k} style={st.rowBody}>{p}</Text>
                    ))}
                  </>
                )}
                {arcana && (
                  <>
                    <Text style={st.rowBody}>{arcana.tagline}</Text>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>▲ {arcana.upside}</Text>
                    <Text style={[st.rowBody, { color: '#FCD34D' }]}>▼ {arcana.tradeoff}</Text>
                    <Text style={st.note}>Toggle your active Arcana anytime at Camp or on the level preview sheet.</Text>
                  </>
                )}
                {isBountyBoard && (
                  <>
                    {MECHANICS.bounty_board.body.map((p, k) => (
                      <Text key={k} style={st.rowBody}>{p}</Text>
                    ))}
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
              {evo && (
                <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                  <Text style={st.ctaText}>{i + 1 < unlocks.length ? 'Continue' : 'Awesome!'}</Text>
                </TouchableOpacity>
              )}
              {u.kind === 'feature' && (
                u.feature === 'workshop' && i + 1 >= unlocks.length && onOpenWorkshop ? (
                  <>
                    <TouchableOpacity
                      testID="unlock-primary"
                      onPress={() => {
                        sfx('confirm');
                        onDone();
                        onOpenWorkshop();
                      }}
                      style={st.cta}
                      activeOpacity={0.85}
                    >
                      <Text style={st.ctaText}>Open Workshop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Stay on results</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>{i + 1 < unlocks.length ? 'Continue' : 'Awesome!'}</Text>
                  </TouchableOpacity>
                )
              )}
              {arcana && (
                arcanaEquipped ? (
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>Equipped ✓  Continue</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      testID="unlock-primary"
                      onPress={() => { sfx('confirm'); onEquipArcana?.(arcana.id); advance(); }}
                      style={st.cta}
                      activeOpacity={0.85}
                    >
                      <Text style={st.ctaText}>Equip {arcana.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Keep current rules for now</Text>
                    </TouchableOpacity>
                  </>
                )
              )}
              {isBountyBoard && (
                <>
                  <TouchableOpacity
                    testID="unlock-primary"
                    onPress={() => {
                      sfx('confirm');
                      if (i + 1 >= unlocks.length && onOpenBounties) {
                        onDone();
                        onOpenBounties();
                      } else {
                        advance();
                      }
                    }}
                    style={st.cta}
                    activeOpacity={0.85}
                  >
                    <Text style={st.ctaText}>{i + 1 >= unlocks.length && onOpenBounties ? 'View Bounty Board' : 'Continue'}</Text>
                  </TouchableOpacity>
                  {i + 1 >= unlocks.length && onOpenBounties && (
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Stay on results</Text>
                    </TouchableOpacity>
                  )}
                </>
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
