/**
 * Starfall Spire — Golden Treasure Vault Node.
 *
 * Reuses `WeaponExplainer.tsx` for inspecting the Vault's weapon prize.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getArcana } from '@/adventure/data/arcana';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { Btn, CoinPill, Eyebrow, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import type { SpireRun, SpireTreasureState } from '../types';

interface Props {
  run: SpireRun;
  treasure: SpireTreasureState;
  onClaim: (choice: 'weapon' | 'arcana' | 'coins') => void;
  onLeave: () => void;
}

const SpireTreasure: React.FC<Props> = ({ run, treasure, onClaim, onLeave }) => {
  const w = getArmoryWeapon(treasure.weaponOffer.weaponId, {
    [treasure.weaponOffer.weaponId]: { level: treasure.weaponOffer.level, tuning: {} },
  });
  const arc = treasure.arcanaOffer ? getArcana(treasure.arcanaOffer) : null;
  const extraCoins = 60 + run.act * 20;

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
                <TouchableOpacity
                  testID="spire-treasure-weapon"
                  onPress={() => { band.cue('weaponGet'); onClaim('weapon'); }}
                  style={st.choice}
                  activeOpacity={0.85}
                >
                  <WeaponAvatar weapon={w} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.choiceTitle}>{w.name} (Lv {treasure.weaponOffer.level})</Text>
                    <Text style={st.choiceSub}>{w.shortDescription}</Text>
                  </View>
                </TouchableOpacity>
                <WeaponExplainer weapon={w} build={{ level: treasure.weaponOffer.level, tuning: {} }} />
              </>
            )}

            {arc && (
              <TouchableOpacity
                testID="spire-treasure-arcana"
                onPress={() => { band.cue('catalyst'); onClaim('arcana'); }}
                style={[st.choice, { borderColor: TONE.arcana, backgroundColor: TONE.arcanaPale }]}
                activeOpacity={0.85}
              >
                <Icon name={arc.icon} size={26} color={TONE.arcana} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.choiceTitle, { color: TONE.arcana }]}>Arcana {arc.numeral} · {arc.name}</Text>
                  <Text style={[st.choiceSub, { color: TONE.upside }]}>▲ {arc.upside}</Text>
                  <Text style={[st.choiceSub, { color: TONE.tradeoff }]}>▼ {arc.tradeoff}</Text>
                </View>
              </TouchableOpacity>
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
  root: { flex: 1, backgroundColor: '#1E1B2E' },
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
