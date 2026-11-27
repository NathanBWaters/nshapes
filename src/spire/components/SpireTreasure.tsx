/**
 * Starfall Summit — Golden Treasure Vault Node.
 *
 * Reuses `WeaponExplainer.tsx` and shared `WeaponOfferRow` / `ArcanaCard`.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon } from '@/adventure/data/armory';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { ArcanaCard, WeaponOfferRow, type OfferBadge } from '@/adventure/components/SharedCards';
import { Btn, CoinPill, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { clashesWithBelt, newEvolutionRecipesArmedBy } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireRun, SpireTreasureState } from '../types';
import SpireSwapPicker from './SpireSwapPicker';

interface Props {
  run: SpireRun;
  treasure: SpireTreasureState;
  onClaim: (choice: 'weapon' | 'arcana' | 'coins', replaceWeaponId?: string) => void;
  onLeave: () => void;
}

const SpireTreasure: React.FC<Props> = ({ run, treasure, onClaim, onLeave }) => {
  const [swapping, setSwapping] = useState(false);
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
        <PopIn style={st.hero}>
          <Icon name="skoll/open-treasure-chest" size={48} color="#E0A800" />
          <Eyebrow text="STARFALL VAULT" color={COLORS.actionYellow} />
          <Text style={st.title}>Golden Treasure Chest!</Text>
          <View style={st.coinRow}>
            <Text style={st.sub}>Base haul:</Text>
            <CoinPill coins={treasure.coins} />
          </View>
        </PopIn>

        {treasure.claimed ? (
          <PopIn style={st.card}>
            <Text style={st.claimedTitle}>Vault Claimed!</Text>
            <Text style={st.claimedText}>{treasure.outcomeText}</Text>
            <Btn testID="spire-treasure-leave" label="Return to Map" icon="lorc/mountaintop" onPress={() => { sfx('confirm'); onLeave(); }} />
          </PopIn>
        ) : (
          <View style={st.card}>
            <Text style={st.sec}>CHOOSE YOUR BONUS TREASURE</Text>

            {w && (
              <>
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
                {swapping && needsSwap && (
                  <SpireSwapPicker
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
              </>
            )}

            {availArcana && (
              <ArcanaCard
                testID="spire-treasure-arcana"
                arcanaId={availArcana}
                prefix="Arcana"
                onPress={() => { band.cue('catalyst'); onClaim('arcana'); }}
              />
            )}

            <TouchableOpacity
              testID="spire-treasure-coins"
              onPress={() => { band.cue('coinRoll', { amount: 14 }); onClaim('coins'); }}
              style={[st.choice, { borderColor: '#B45309', backgroundColor: '#FFFBEB' }]}
              activeOpacity={0.85}
            >
              <Icon name="delapouite/coins-pile" size={26} color="#B45309" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.choiceTitle}>Double Gold Hoard (+{extraCoins}¢ extra)</Text>
                <Text style={st.choiceSub}>Walk out with {treasure.coins + extraCoins}¢ total for the next Shop.</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 500, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  hero: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 16, alignItems: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '900', color: INK, textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '800', color: TONE.spent },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  sec: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, padding: 10 },
  choiceTitle: { fontSize: 14, fontWeight: '900', color: INK },
  choiceSub: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 16 },
  claimedTitle: { fontSize: 19, fontWeight: '900', color: INK, textAlign: 'center' },
  claimedText: { fontSize: 13, color: INK, textAlign: 'center', lineHeight: 19 },
});

export default SpireTreasure;
