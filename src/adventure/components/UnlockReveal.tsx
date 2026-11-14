/**
 * Unlock reveal — every new fighter or weapon gets its own full-screen moment:
 * a silhouette on a field of light, a tap to reveal, then a card explaining
 * exactly how the new thing works and a button to start using it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { band, sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, UnlockableFeature } from '../types';
import { charmSlots, equippedArcanaOf, equippedCharms, weaponBuilds, type Unlock } from '../progress';
import { getFighter } from '../data/fighters';
import { getPassive } from '../data/passives';
import { getArcana } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { CAMPAIGN_FEATURES } from '../data/features';
import { LEVELS, getLevel } from '../data/levels';
import { levelFoe } from '../data/foes';
import { isFighterTrial } from '../data/rewards';
import { MECHANICS, getMechanic } from '../data/mechanics';
import { DARK, INK } from './ui';
import { describeUnlock } from './rewards';
import { evolutionsMechanicId } from '../lessons';

const GOLD = DARK.gold;
const TEXT = DARK.text;
const MUTED = DARK.muted;

/** Weapon text was written for score-based modes. In Adventure a point is a point of damage. */
const adventureText = (t: string) => t.replace(/\+(\d+) points?/g, '+$1 damage');

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
  /** Go to the screen a newly unlocked feature lives on (offered on the last reveal only) */
  onOpenFeature?: (feature: UnlockableFeature) => void;
  /** Go and look at a secret path on the map (offered on the last reveal only) */
  onShowPath?: (levelId: string) => void;
  onDone: () => void;
}

const UnlockReveal: React.FC<Props> = ({ unlocks, save, onUseFighter, onEquipCharm, onEquipArcana, onOpenFeature, onShowPath, onDone }) => {
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

  const display = describeUnlock(u);
  const { icon, accent } = display;
  const fighter = u.kind === 'fighter' ? getFighter(u.name) : null;
  const w = u.kind === 'weapon' ? getArmoryWeapon(u.id, weaponBuilds(save)) : null;
  const arcana = u.kind === 'arcana' ? getArcana(u.id) : null;
  const evo = u.kind === 'evolution' ? EVOLUTION_RECIPES.find(r => r.id === u.id) ?? null : null;
  const feature = u.kind === 'feature' ? CAMPAIGN_FEATURES[u.feature] : null;
  const path = u.kind === 'path' ? getLevel(u.levelId) : null;
  const last = i + 1 >= unlocks.length;
  // Offered only when it is the final reveal, so the remaining ones are not skipped
  const openFeature = feature?.open && last && onOpenFeature ? feature.open : null;
  // A fighter with a trial still to play learns its passives there, so the reveal stays short
  const trial = fighter && !save.seenMechanics.includes(fighter.signature)
    ? LEVELS.find(l => l.branchOf && l.introduces === fighter.signature) ?? null
    : null;
  const evoId = evolutionsMechanicId();
  const evoMechanic = evo && evoId ? MECHANICS[evoId] : null;

  const reveal = () => {
    // A weapon is introduced by its own voice, a recipe by its fanfare
    if (u.kind === 'weapon') band.audition(u.id);
    else if (u.kind === 'evolution') band.auditionEvolution(u.id);
    else sfx('unlock');
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

  const charmEquipped = u.kind === 'weapon' && equippedCharms(save).includes(u.id);
  const charmsFull = equippedCharms(save).length >= charmSlots(save);
  const arcanaEquipped = u.kind === 'arcana' && equippedArcanaOf(save).includes(u.id);
  const sourceLabel = path ? 'Secret' : u.star === 0 ? 'Bounty reward' : `${'★'.repeat(u.star)} reward`;
  return (
    <Modal visible transparent animationType="fade">
      <View testID="unlock-modal" style={st.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} pointerEvents="none" />
        <ScrollView contentContainerStyle={st.scroll} bounces={false}>
          <Text style={st.eyebrow}>{sourceLabel}{unlocks.length > 1 ? `  ·  ${i + 1} of ${unlocks.length}` : ''}</Text>
          <Text style={st.headline}>{display.headline}</Text>

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
              ) : revealed && w ? (
                <WeaponAvatar
                  testID="unlock-revealed-weapon"
                  weapon={w}
                  size={108}
                  interactive
                />
              ) : revealed && path ? (
                <EnemyAvatar testID="unlock-revealed-path" enemy={levelFoe(path)} size={108} mood="idle" reaction={{ type: 'entrance', id: i + 1 }} interactive />
              ) : (
                <Icon name={icon} size={92} color={revealed ? INK : '#050505'} />
              )}
              {!revealed && <Text style={st.heroQ}>?</Text>}
            </Animated.View>
          </View>

          {!revealed ? (
            <>
              <Text style={st.tease}>{display.tease}</Text>
              <TouchableOpacity testID="unlock-reveal" onPress={reveal} style={st.cta} activeOpacity={0.85}>
                <Text style={st.ctaText}>Reveal</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={[{ alignSelf: 'stretch', gap: 12, alignItems: 'center' }, detailStyle]}>
              <Text style={st.name}>{display.name}</Text>
              {display.badge && <Text style={[st.rarity, { color: accent }]}>{display.badge}</Text>}

              <View style={st.card}>
                <Text style={st.cardTitle}>{path ? 'What is it?' : 'How it works'}</Text>
                {path && (
                  <>
                    <Text style={st.rowBody}>
                      {path.rules.sandbox
                        ? getMechanic(path.introduces).body[0]
                        : isFighterTrial(path)
                          ? `A side level built around one fighter: ${getMechanic(path.introduces).title}. It is optional and has its own stars and rewards.`
                          : `An optional fight against ${levelFoe(path).name}: tougher than the main path, with its own stars and better loot.`}
                    </Text>
                    {path.rules.sandbox && <Text style={st.rowBody}>{getMechanic(path.introduces).body[2]}</Text>}
                    <Text style={st.note}>It was not on the map until now. Secret paths only show up once you earn them.</Text>
                  </>
                )}
                {fighter && (trial ? (
                  <>
                    <Text style={st.rowBody}>
                      Plays by two passives: {fighter.passives.map(id => getPassive(id).name).join(' & ')}.
                    </Text>
                    <Text style={st.note}>Their trial, {trial.id} {trial.name}, now hangs off the map: it teaches both passives.</Text>
                  </>
                ) : (
                  <>
                    {fighter.passives.map(id => {
                      const p = getPassive(id);
                      return (
                        <View key={id} style={st.row}>
                          <View style={st.rowIcon}><Icon name={p.icon} size={22} color={INK} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowTitle}>{p.name} <Text style={st.rowTag}>ALWAYS ON</Text></Text>
                            <Text style={st.rowBody}>{p.text}</Text>
                          </View>
                        </View>
                      );
                    })}
                    <Text style={st.note}>Spend stars in {fighter.name}'s skill tree at Camp to grow these passives.</Text>
                  </>
                ))}
                {w && (
                  <>
                    {u.kind === 'weapon' && u.level !== undefined && (
                      <Text style={[st.rowBody, { color: '#5EEAD4' }]}>
                        Level {u.level}: {w.shortDescription}
                      </Text>
                    )}
                    <Text style={st.rowBody}>{adventureText(w.description)}</Text>
                    {w.flavorText ? <Text style={st.note}>{adventureText(w.flavorText)}</Text> : null}
                    {u.kind === 'weapon' && u.firstWeapon && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>Your first charm</Text>
                        {(MECHANICS.charm?.body ?? []).map((p, k) => <Text key={k} style={st.rowBody}>{p}</Text>)}
                      </View>
                    )}
                  </>
                )}
                {evo && (
                  <>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>Armed by: {evo.familyText}</Text>
                    <Text style={st.rowBody}>For 30 seconds: {evo.activeText}</Text>
                    <Text style={st.note}>{evo.flavor}</Text>
                    {u.kind === 'evolution' && u.firstEvolution && evoMechanic && (
                      <View style={st.charmBox}>
                        <Text style={st.rowTitle}>How evolutions work</Text>
                        {evoMechanic.body.map((p, k) => <Text key={k} style={st.rowBody}>{p}</Text>)}
                      </View>
                    )}
                  </>
                )}
                {feature && getMechanic(feature.mechanic).body.map((p, k) => (
                  <Text key={k} style={st.rowBody}>{p}</Text>
                ))}
                {arcana && (
                  <>
                    <Text style={st.rowBody}>{arcana.tagline}</Text>
                    <Text style={[st.rowBody, { color: '#5EEAD4' }]}>▲ {arcana.upside}</Text>
                    <Text style={[st.rowBody, { color: '#FCD34D' }]}>▼ {arcana.tradeoff}</Text>
                    <Text style={st.note}>Equip or remove Arcana anytime at Camp or on the level preview sheet.</Text>
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
                charmEquipped || charmsFull ? (
                  <>
                    {!charmEquipped && <Text style={st.note}>Your charm slots are full. Swap charms on the level preview or at Camp.</Text>}
                    <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                      <Text style={st.ctaText}>{charmEquipped ? 'Equipped ✓  Continue' : 'Continue'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); onEquipCharm(w.id); advance(); }} style={st.cta} activeOpacity={0.85}>
                      <Text style={st.ctaText}>Equip as charm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Leave it in the Armory</Text>
                    </TouchableOpacity>
                  </>
                )
              )}
              {evo && (
                <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                  <Text style={st.ctaText}>{last ? 'Awesome!' : 'Continue'}</Text>
                </TouchableOpacity>
              )}
              {feature && (
                openFeature ? (
                  <>
                    <TouchableOpacity
                      testID="unlock-primary"
                      onPress={() => {
                        sfx('confirm');
                        onDone();
                        onOpenFeature?.(feature.id);
                      }}
                      style={st.cta}
                      activeOpacity={0.85}
                    >
                      <Text style={st.ctaText}>{openFeature.label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Stay on results</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>{last ? 'Awesome!' : 'Continue'}</Text>
                  </TouchableOpacity>
                )
              )}
              {path && (
                last && onShowPath ? (
                  <>
                    <TouchableOpacity
                      testID="unlock-primary"
                      onPress={() => { sfx('confirm'); onDone(); onShowPath(path.id); }}
                      style={st.cta}
                      activeOpacity={0.85}
                    >
                      <Text style={st.ctaText}>Show me on the map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="unlock-later" onPress={advance} style={st.secondary}>
                      <Text style={st.secondaryText}>Later</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity testID="unlock-primary" onPress={() => { sfx('confirm'); advance(); }} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>Continue</Text>
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
  card: { alignSelf: 'stretch', backgroundColor: DARK.panel, borderRadius: 12, borderWidth: 1, borderColor: DARK.goldEdge(0.3), padding: 14, gap: 12 },
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
