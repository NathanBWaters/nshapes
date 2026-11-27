/**
 * Starfall Summit — Campfire Node (Rest / Forge Weapon / Meditate for a real Fighter Skill Tree Node).
 *
 * Reuses `WeaponExplainer.tsx` and shared `WeaponOfferRow` / `SkillNodeRow`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle } from 'react-native-svg';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import type { FighterAvatarReactionEvent } from '@/components/fighters/FighterAvatar';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, OVERLAP, SCALE, SPRING, STAGGER } from '@/utils/motion';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { beltSynergyAttrSet } from '@/adventure/ui/synergyMeta';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { SkillNodeRow, WeaponOfferRow } from '@/adventure/components/SharedCards';
import { Btn, DARK, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireEquippedEvolutions, spireHeldWeapons } from '../engine/bridge';
import type { SpireCampfireState, SpireRun } from '../types';
import SpireBeltBar from './SpireBeltBar';
import {
  SPIRE_MOTION_INSTANT,
  SpireCrossfadeSwap,
  SpireStaggerItem,
  SpireTactilePressable,
} from './SpireMotion';

interface Props {
  run: SpireRun;
  campfire: SpireCampfireState;
  onRest: () => void;
  onForge: (weaponId: string) => void;
  onMeditate: (nodeId: string) => void;
  onReorderWeapon?: (fromIndex: number, toIndex: number) => void;
  onSelectEvolution?: (weaponId: string, evoId: string) => void;
  onLeave: () => void;
}

const SpireCampfire: React.FC<Props> = ({
  run,
  campfire,
  onRest,
  onForge,
  onMeditate,
  onReorderWeapon,
  onSelectEvolution,
  onLeave,
}) => {
  const reduced = useReducedMotion();
  const [subMode, setSubMode] = useState<'main' | 'forge' | 'meditate'>('main');
  const [focusedForgeId, setFocusedForgeId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<FighterAvatarReactionEvent | null>(null);
  const [actedMood, setActedMood] = useState<'idle' | 'victory'>('idle');
  const reactionSeqRef = useRef(0);

  // Warm hearth flare + ember shockwave ring when the player rests/forges/meditates
  const fireScale = useSharedValue(1);
  const ringScale = useSharedValue(0.5);
  const ringOp = useSharedValue(0);
  useEffect(
    () => () => {
      cancelAnimation(fireScale);
      cancelAnimation(ringScale);
      cancelAnimation(ringOp);
    },
    [fireScale, ringScale, ringOp]
  );

  const pulseFire = () => {
    if (reduced || SPIRE_MOTION_INSTANT) return;
    fireScale.value = withSequence(
      withTiming(SCALE.reward, { duration: MS.feedback, easing: EASE.popSoft }),
      withSpring(1, SPRING.playful)
    );
    ringScale.value = 0.5;
    ringScale.value = withTiming(1.75, { duration: MS.panel, easing: EASE.enter });
    ringOp.value = withSequence(
      withTiming(0.85, { duration: MS.feedback, easing: EASE.ui }),
      withTiming(0, { duration: MS.move, easing: EASE.exitSoft })
    );
  };

  const fireAnim = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));
  const ringAnim = useAnimatedStyle(() => ({
    opacity: ringOp.value,
    transform: [{ scale: ringScale.value }],
  }));

  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);
  const equippedEvos = spireEquippedEvolutions(run);
  const labTier = run.upgrades?.evolution_lab ?? 0;
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);
  const availSkills = campfire.skillOptions.filter(id => !run.skillNodes.includes(id));
  const focusedWeapon = forgeable.find(w => w.id === focusedForgeId) ?? forgeable[0] ?? null;

  const swapKey = campfire.resolved ? 'resolved' : subMode;

  return (
    <View style={st.root} testID="spire-campfire">
      <ScrollView contentContainerStyle={st.body}>
        <SpireStaggerItem index={0} count={1} distance={14} hero style={st.heroCard}>
          <View style={st.heroRow}>
            <FighterAvatar
              character={run.fighter}
              size={56}
              health={run.hearts}
              maxHealth={run.maxHearts}
              mood={campfire.resolved ? 'victory' : actedMood}
              reaction={reaction}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Eyebrow text="CAMPFIRE" color="#FED7AA" />
              <Text style={st.title}>Crackling Embers</Text>
              <Text style={st.sub}>Take one action before ascending the Summit.</Text>
            </View>
            <View style={st.fireStage}>
              <Animated.View pointerEvents="none" style={[st.fireRing, ringAnim]}>
                <Svg width={56} height={56} viewBox="0 0 56 56">
                  <Circle cx="28" cy="28" r="22" fill="none" stroke="#F97316" strokeWidth="3.5" />
                  <Circle cx="28" cy="28" r="18" fill="none" stroke={COLORS.actionYellow} strokeWidth="2" />
                </Svg>
              </Animated.View>
              <Animated.View style={fireAnim}>
                <Icon name="lorc/campfire" size={38} color="#F97316" />
              </Animated.View>
            </View>
          </View>
        </SpireStaggerItem>

        <SpireCrossfadeSwap swapKey={swapKey} style={st.actionStage}>
          {campfire.resolved ? (
            <View style={st.outcomeCard} testID="spire-campfire-outcome">
              <View style={st.outcomeBadge}>
                <Icon name="lorc/campfire" size={26} color="#EA580C" />
              </View>
              <Text style={st.outcomeTitle}>Ready to Climb!</Text>
              <Text style={st.outcomeText}>{campfire.outcomeText}</Text>
              <Btn testID="spire-campfire-leave" label="Return to Map" icon="lorc/mountaintop" onPress={() => { sfx('confirm'); onLeave(); }} />
            </View>
          ) : subMode === 'main' ? (
            <View style={st.options}>
              <SpireStaggerItem index={0} count={3} baseDelayMs={OVERLAP.secondaryMs} gapMs={STAGGER.item}>
                <SpireTactilePressable
                  testID="spire-campfire-rest"
                  onPress={() => {
                    band.cue('heal');
                    setActedMood('victory');
                    setReaction({ type: 'heal', id: ++reactionSeqRef.current });
                    pulseFire();
                    onRest();
                  }}
                  style={[st.optCard, { borderColor: '#DC2626' }]}
                >
                  <View style={[st.optIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Icon name="lorc/shining-heart" size={26} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.optTitle}>Rest</Text>
                    <Text style={st.optDesc}>
                      Heal +{campfire.healAmount} ♥ ({Math.min(run.maxHearts, run.hearts + campfire.healAmount)}/{run.maxHearts} Hearts).
                    </Text>
                  </View>
                </SpireTactilePressable>
              </SpireStaggerItem>

              <SpireStaggerItem index={1} count={3} baseDelayMs={OVERLAP.secondaryMs} gapMs={STAGGER.item}>
                <SpireTactilePressable
                  testID="spire-campfire-forge-open"
                  disabled={forgeable.length === 0}
                  onPress={() => { sfx('click'); setSubMode('forge'); }}
                  style={[st.optCard, { borderColor: '#D97706' }, forgeable.length === 0 && { opacity: 0.45 }]}
                >
                  <View style={[st.optIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="lorc/anvil" size={26} color="#B45309" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.optTitle}>Forge</Text>
                    <Text style={st.optDesc}>Upgrade any held weapon by +1 Level for the rest of this run.</Text>
                  </View>
                </SpireTactilePressable>
              </SpireStaggerItem>

              <SpireStaggerItem index={2} count={3} baseDelayMs={OVERLAP.secondaryMs} gapMs={STAGGER.item}>
                <SpireTactilePressable
                  testID="spire-campfire-meditate-open"
                  disabled={availSkills.length === 0}
                  onPress={() => { sfx('click'); setSubMode('meditate'); }}
                  style={[st.optCard, { borderColor: TONE.upside }, availSkills.length === 0 && { opacity: 0.45 }]}
                >
                  <View style={[st.optIcon, { backgroundColor: '#CCFBF1' }]}>
                    <Icon name="lorc/meditation" size={26} color={TONE.upside} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.optTitle}>Meditate</Text>
                    <Text style={st.optDesc}>Unlock 1 of 3 real {run.fighter} Skill Tree nodes for this climb!</Text>
                  </View>
                </SpireTactilePressable>
              </SpireStaggerItem>
            </View>
          ) : subMode === 'forge' ? (
            <View style={st.subCard}>
              <Text style={st.secTitle}>CHOOSE A WEAPON TO FORGE (+1 LEVEL)</Text>
              <View style={{ gap: 8 }}>
                {forgeable.map((w, i) => {
                  const lv = builds[w.id]?.level ?? 1;
                  return (
                    <SpireStaggerItem key={w.id} index={i} count={forgeable.length} gapMs={STAGGER.card} distance={8}>
                      <WeaponOfferRow
                        weapon={w}
                        level={lv}
                        subtitle={`Level ${lv} → Level ${lv + 1}`}
                        focused={focusedWeapon?.id === w.id}
                        onPress={() => setFocusedForgeId(w.id)}
                        right={
                          <Btn
                            testID={`spire-campfire-forge-${w.id}`}
                            small
                            label="Forge"
                            onPress={() => {
                              band.cue('levelUp');
                              setActedMood('victory');
                              setReaction({ type: 'powerup', id: ++reactionSeqRef.current });
                              pulseFire();
                              onForge(w.id);
                            }}
                          />
                        }
                      />
                    </SpireStaggerItem>
                  );
                })}
              </View>
              {focusedWeapon && (
                <WeaponExplainer
                  weapon={focusedWeapon}
                  build={builds[focusedWeapon.id]}
                  evolutionMode="preview"
                  allEvolutionsUnlocked
                  equippedEvolutionId={equippedEvos[focusedWeapon.id]}
                  beltSynergyIds={beltSynergyAttrSet(run.weapons, focusedWeapon.id)}
                  evolutionLabTier={labTier}
                />
              )}
              <Btn small variant="secondary" label="Back" onPress={() => setSubMode('main')} />
            </View>
          ) : (
            <View style={st.subCard}>
              <Text style={st.secTitle}>CHOOSE A {run.fighter.toUpperCase()} SKILL NODE</Text>
              <View style={{ gap: 8 }}>
                {availSkills.map((id, i) => (
                  <SpireStaggerItem key={id} index={i} count={availSkills.length} gapMs={STAGGER.card} distance={8}>
                    <SkillNodeRow
                      testID={`spire-campfire-skill-${i}`}
                      nodeId={id}
                      onPress={() => {
                        band.cue('levelUp');
                        setActedMood('victory');
                        setReaction({ type: 'relief', id: ++reactionSeqRef.current });
                        pulseFire();
                        onMeditate(id);
                      }}
                    />
                  </SpireStaggerItem>
                ))}
              </View>
              <Btn small variant="secondary" label="Back" onPress={() => setSubMode('main')} />
            </View>
          )}
        </SpireCrossfadeSwap>

        {/* Quick belt inspection & reordering while resting by the campfire */}
        {subMode === 'main' && (
          <SpireBeltBar
            run={run}
            onReorder={onReorderWeapon}
            onSelectEvolution={onSelectEvolution}
            title="INSPECT & REORDER BELT"
            compact
            testIDPrefix="spire-campfire-belt"
          />
        )}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  heroCard: { backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 2.5, borderColor: '#F97316', padding: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fireStage: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  fireRing: { position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  actionStage: { minHeight: 274 },
  title: { fontSize: 20, fontWeight: '900', color: DARK.text },
  sub: { fontSize: 12, color: DARK.muted },
  options: { gap: 10 },
  optCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 3, borderBottomWidth: 6, padding: 12 },
  optIcon: { width: 48, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 17, fontWeight: '900', color: INK },
  optDesc: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 17 },
  outcomeCard: { minHeight: 274, justifyContent: 'center', backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 18, gap: 12 },
  outcomeBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFEDD5', borderWidth: 2, borderColor: '#EA580C', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  outcomeTitle: { fontSize: 20, fontWeight: '900', color: INK, textAlign: 'center' },
  outcomeText: { fontSize: 14, color: INK, textAlign: 'center', lineHeight: 20 },
  subCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  secTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
});

export default SpireCampfire;
