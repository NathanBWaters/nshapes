/**
 * Starfall Summit — Golden Treasure Vault Node.
 *
 * Reuses `WeaponExplainer.tsx` and shared `WeaponOfferRow` / `ArcanaCard`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle } from 'react-native-svg';
import Icon from '@/components/Icon';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { EASE, MS, OVERLAP, PHASE, SPRING, SQUASH_TIER, STAGGER, STAYS, reducedMs } from '@/utils/motion';
import { getArmoryWeapon } from '@/adventure/data/armory';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { ArcanaCard, WeaponOfferRow, type OfferBadge } from '@/adventure/components/SharedCards';
import { Btn, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { clashesWithBelt, newEvolutionRecipesArmedBy } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireRun, SpireTreasureState } from '../types';
import SpireSwapPicker from './SpireSwapPicker';
import {
  SPIRE_MOTION_INSTANT,
  SpireCountUp,
  SpireCrossfadeSwap,
  SpireStaggerItem,
  SpireTactilePressable,
} from './SpireMotion';

interface Props {
  run: SpireRun;
  treasure: SpireTreasureState;
  onClaim: (choice: 'weapon' | 'arcana' | 'coins', replaceWeaponId?: string) => void;
  onLeave: () => void;
}

const SpireTreasure: React.FC<Props> = ({ run, treasure, onClaim, onLeave }) => {
  const reduced = useReducedMotion();
  const [swapping, setSwapping] = useState(false);
  const [doubledCoins, setDoubledCoins] = useState(false);

  // Chest reveal choreography: anticipation crouch → pop-open leap → playful spring settle + open-center gold ring
  const chestScaleX = useSharedValue(1);
  const chestScaleY = useSharedValue(1);
  const chestY = useSharedValue(0);
  const ringScale = useSharedValue(0.45);
  const ringOp = useSharedValue(0);

  const playChestPop = useCallback(() => {
    if (SPIRE_MOTION_INSTANT) return;
    if (reduced) {
      ringOp.value = withSequence(
        STAYS.reduceMotion,
        withTiming(0.6, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS }),
        withTiming(0, { duration: reducedMs(MS.quick), easing: EASE.exitSoft, ...STAYS })
      );
      return;
    }
    const sq = SQUASH_TIER.playful;
    chestScaleY.value = withSequence(
      withTiming(sq.squashY, { duration: PHASE.uiGatherMs, easing: EASE.anticipate }),
      withTiming(sq.stretchY, { duration: MS.feedback, easing: EASE.enter }),
      withSpring(1, SPRING.playful)
    );
    chestScaleX.value = withSequence(
      withTiming(1 / sq.squashY, { duration: PHASE.uiGatherMs, easing: EASE.anticipate }),
      withTiming(1 / sq.stretchY, { duration: MS.feedback, easing: EASE.enter }),
      withSpring(1, SPRING.playful)
    );
    chestY.value = withSequence(
      withTiming(4, { duration: PHASE.uiGatherMs, easing: EASE.anticipate }),
      withTiming(-10, { duration: MS.feedback, easing: EASE.enter }),
      withSpring(0, SPRING.playful)
    );
    ringScale.value = 0.45;
    ringScale.value = withDelay(
      PHASE.uiGatherMs,
      withTiming(1.85, { duration: MS.panel, easing: EASE.enter })
    );
    ringOp.value = withDelay(
      PHASE.uiGatherMs,
      withSequence(
        withTiming(0.9, { duration: MS.feedback, easing: EASE.ui }),
        withTiming(0, { duration: MS.move, easing: EASE.exitSoft })
      )
    );
  }, [reduced, chestScaleX, chestScaleY, chestY, ringScale, ringOp]);

  useEffect(() => {
    playChestPop();
    return () => {
      cancelAnimation(chestScaleX);
      cancelAnimation(chestScaleY);
      cancelAnimation(chestY);
      cancelAnimation(ringScale);
      cancelAnimation(ringOp);
    };
  }, [playChestPop, chestScaleX, chestScaleY, chestY, ringScale, ringOp]);

  const chestAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: chestY.value },
      { scaleX: chestScaleX.value },
      { scaleY: chestScaleY.value },
    ],
  }));
  const ringAnim = useAnimatedStyle(() => ({
    opacity: ringOp.value,
    transform: [{ scale: ringScale.value }],
  }));

  const w = getArmoryWeapon(treasure.weaponOffer.weaponId, {
    [treasure.weaponOffer.weaponId]: { level: treasure.weaponOffer.level, tuning: {} },
  });
  const heldLv = run.weaponLevels[treasure.weaponOffer.weaponId];
  const isUpgrade = heldLv !== undefined;
  const beltFull = run.weapons.length >= MAX_SUMMIT_WEAPONS;
  const needsSwap = beltFull && !isUpgrade;
  const newEvos = isUpgrade ? [] : newEvolutionRecipesArmedBy(run, treasure.weaponOffer.weaponId);
  const clashes = isUpgrade ? [] : clashesWithBelt(run.weapons, treasure.weaponOffer.weaponId);
  const badges: OfferBadge[] = [];
  if (isUpgrade) {
    badges.push({ icon: 'delapouite/upgrade', text: `LV ${heldLv} → ${treasure.weaponOffer.level}`, bg: '#D97706' });
  }
  if (newEvos.length > 0) {
    badges.push({
      icon: 'sbed/electric',
      text: newEvos.length > 1 ? `${newEvos[0].name} +${newEvos.length - 1}` : newEvos[0].name,
      bg: TONE.evoReady,
    });
  }
  if (clashes.length > 0) {
    badges.push({ icon: 'lorc/laser-warning', text: 'CLASH', bg: '#B91C1C' });
  }
  const availArcana =
    treasure.arcanaOffer && !run.arcana.includes(treasure.arcanaOffer)
      ? treasure.arcanaOffer
      : null;
  const extraCoins = 60 + run.act * 20;

  const handleWeaponAction = () => {
    if (needsSwap) {
      sfx('click');
      setSwapping(prev => !prev);
      return;
    }
    band.cue(isUpgrade ? 'levelUp' : 'weaponGet');
    onClaim('weapon');
  };

  return (
    <View style={st.root} testID="spire-treasure">
      <ScrollView contentContainerStyle={st.body}>
        <SpireStaggerItem index={0} count={1} distance={16} hero style={st.hero}>
          <View style={st.chestStage}>
            <Animated.View pointerEvents="none" style={[st.chestRing, ringAnim]}>
              <Svg width={72} height={72} viewBox="0 0 72 72">
                <Circle cx="36" cy="36" r="28" fill="none" stroke={INK} strokeWidth="5" />
                <Circle cx="36" cy="36" r="28" fill="none" stroke={COLORS.actionYellow} strokeWidth="2.5" />
              </Svg>
            </Animated.View>
            <Animated.View style={chestAnim} testID="spire-treasure-chest-icon">
              <Icon name="skoll/open-treasure-chest" size={48} color="#E0A800" />
            </Animated.View>
          </View>
          <SpireStaggerItem index={0} count={2} baseDelayMs={OVERLAP.secondaryMs} gapMs={STAGGER.card} distance={8} style={st.heroTextWrap}>
            <Eyebrow text="STARFALL VAULT" color={COLORS.actionYellow} />
            <Text style={st.title}>Golden Treasure Chest!</Text>
          </SpireStaggerItem>
          <SpireStaggerItem index={1} count={2} baseDelayMs={MS.feedback} gapMs={STAGGER.card} distance={8}>
            <View style={st.coinRow}>
              <Text style={st.sub}>{doubledCoins ? 'Total haul:' : 'Base haul:'}</Text>
              <View style={st.coinCountPill}>
                <Icon name="lorc/crown-coin" size={16} color={TONE.coinBright} />
                <SpireCountUp
                  target={doubledCoins ? treasure.coins + extraCoins : treasure.coins}
                  delayMs={MS.feedback}
                  ticks={8}
                  animateChanges={doubledCoins}
                  style={st.coinCountText}
                />
              </View>
            </View>
          </SpireStaggerItem>
        </SpireStaggerItem>

        {/* Stage choices container after chest pop-open so no hollow white card slab ever sits empty */}
        <SpireStaggerItem index={0} count={1} baseDelayMs={MS.feedback} distance={14}>
          <SpireCrossfadeSwap swapKey={treasure.claimed ? 'claimed' : 'choices'}>
            {treasure.claimed ? (
              <View style={st.card} testID="spire-treasure-claimed">
                <Text style={st.claimedTitle}>Vault Claimed!</Text>
                <Text style={st.claimedText}>{treasure.outcomeText}</Text>
                <Btn testID="spire-treasure-leave" label="Return to Map" icon="lorc/mountaintop" onPress={() => { sfx('confirm'); onLeave(); }} />
              </View>
            ) : (
              <View style={st.card}>
                <Text style={st.sec}>CHOOSE YOUR BONUS TREASURE</Text>

                {w && (
                  <SpireStaggerItem index={0} count={3} baseDelayMs={MS.feedback + OVERLAP.uiContentMs} gapMs={STAGGER.card} distance={10}>
                    <View style={{ gap: 10 }}>
                      <WeaponOfferRow
                        testID="spire-treasure-weapon"
                        weapon={w}
                        level={treasure.weaponOffer.level}
                        badges={badges.length > 0 ? badges : undefined}
                        focused
                        onPress={handleWeaponAction}
                        right={
                          <Btn
                            testID="spire-treasure-weapon-btn"
                            small
                            label={isUpgrade ? 'Upgrade' : needsSwap ? 'Swap' : 'Claim'}
                            onPress={handleWeaponAction}
                          />
                        }
                      />
                      {needsSwap && (
                        <SpireSwapPicker
                          visible={swapping}
                          run={run}
                          incomingWeaponId={treasure.weaponOffer.weaponId}
                          incomingLevel={treasure.weaponOffer.level}
                          testIDPrefix="spire-treasure-swap"
                          onConfirmSwap={dropId => {
                            band.cue('weaponGet');
                            setSwapping(false);
                            onClaim('weapon', dropId);
                          }}
                          onCancel={() => {
                            sfx('click');
                            setSwapping(false);
                          }}
                        />
                      )}
                      <WeaponExplainer weapon={w} build={{ level: treasure.weaponOffer.level, tuning: {} }} hidePowerNote />
                    </View>
                  </SpireStaggerItem>
                )}

                {availArcana && (
                  <SpireStaggerItem index={1} count={3} baseDelayMs={MS.feedback + OVERLAP.uiContentMs} gapMs={STAGGER.card} distance={10}>
                    <ArcanaCard
                      testID="spire-treasure-arcana"
                      arcanaId={availArcana}
                      prefix="Arcana"
                      onPress={() => { band.cue('catalyst'); onClaim('arcana'); }}
                    />
                  </SpireStaggerItem>
                )}

                <SpireStaggerItem index={2} count={3} baseDelayMs={MS.feedback + OVERLAP.uiContentMs} gapMs={STAGGER.card} distance={10}>
                  <SpireTactilePressable
                    testID="spire-treasure-coins"
                    onPress={() => {
                      band.cue('coinRoll', { amount: 14 });
                      setDoubledCoins(true);
                      playChestPop();
                      onClaim('coins');
                    }}
                    style={[st.choice, { borderColor: '#B45309', backgroundColor: '#FFFBEB' }]}
                  >
                    <Icon name="delapouite/coins-pile" size={26} color="#B45309" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.choiceTitle}>Double Gold Hoard (+{extraCoins}¢ extra)</Text>
                      <Text style={st.choiceSub}>Walk out with {treasure.coins + extraCoins}¢ total for the next Shop.</Text>
                    </View>
                  </SpireTactilePressable>
                </SpireStaggerItem>
              </View>
            )}
          </SpireCrossfadeSwap>
        </SpireStaggerItem>
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  hero: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 16, alignItems: 'center', gap: 6 },
  chestStage: { width: 72, height: 60, alignItems: 'center', justifyContent: 'center' },
  chestRing: { position: 'absolute', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  heroTextWrap: { alignItems: 'center', gap: 4 },
  title: { fontSize: 22, fontWeight: '900', color: INK, textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '800', color: TONE.spent },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  coinCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.canvasWhite,
    borderColor: INK,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 60,
  },
  coinCountText: { fontFamily: MONO_FONT, fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  sec: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 10 },
  choiceTitle: { fontSize: 14, fontWeight: '900', color: INK },
  choiceSub: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 16 },
  claimedTitle: { fontSize: 19, fontWeight: '900', color: INK, textAlign: 'center' },
  claimedText: { fontSize: 13, color: INK, textAlign: 'center', lineHeight: 19 },
});

export default SpireTreasure;
