/**
 * Starfall Spire — Full Merchant Shop.
 *
 * Reuses Adventure's `UPGRADES`, `WeaponExplainer.tsx`, and shared
 * `WeaponOfferRow` / `UpgradeOfferRow` / `WeaponChip` / `ArcanaCard` so
 * shopping shares every data spec and UI primitive with Adventure Mode.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getUpgrade } from '@/adventure/data/upgrades';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import {
  ArcanaCard,
  UpgradeOfferRow,
  WeaponChip,
  WeaponOfferRow,
  type OfferBadge,
} from '@/adventure/components/SharedCards';
import { Btn, CoinPill, Eyebrow, Heart, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { buildSpireWeaponBuilds, newEvolutionsArmedBy, spireHeldWeapons } from '../engine/bridge';
import type { SpireRun, SpireShopState } from '../types';

interface Props {
  run: SpireRun;
  shop: SpireShopState;
  onBuyWeapon: (index: number) => void;
  onBuyArcana: (index: number) => void;
  onBuyUpgrade: (index: number) => void;
  onBuyHeal: () => void;
  onForgeWeapon: (weaponId: string) => void;
  onReroll: () => void;
  onLeave: () => void;
}

const SpireShop: React.FC<Props> = ({
  run,
  shop,
  onBuyWeapon,
  onBuyArcana,
  onBuyUpgrade,
  onBuyHeal,
  onForgeWeapon,
  onReroll,
  onLeave,
}) => {
  const [inspectWeaponId, setInspectWeaponId] = useState<string | null>(shop.weapons[0]?.weaponId ?? null);
  const [pickingForge, setPickingForge] = useState(false);

  const inspectedOffer = shop.weapons.find(o => o.weaponId === inspectWeaponId);
  const inspectedWeapon = inspectedOffer
    ? getArmoryWeapon(inspectedOffer.weaponId, { [inspectedOffer.weaponId]: { level: inspectedOffer.level, tuning: {} } })
    : undefined;

  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);

  const priceBtn = (opts: { testID: string; disabled: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity
      testID={opts.testID}
      disabled={opts.disabled}
      onPress={opts.onPress}
      style={[st.buyBtn, opts.disabled && st.buyBtnDisabled]}
    >
      <Text style={st.buyBtnText}>{opts.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={st.root} testID="spire-shop">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.headerCard}>
          <View style={st.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow text="STARFALL BAZAAR" color={COLORS.actionYellow} />
              <Text style={st.title}>Merchant’s Tent</Text>
              <Text style={st.sub}>Gear bought here stays with you for the entire climb!</Text>
            </View>
            <CoinPill coins={run.coins} />
          </View>
        </PopIn>

        {/* Weapons Shelf */}
        <View style={st.card}>
          <View style={st.secHead}>
            <Text style={st.secTitle}>ARMORY WARES</Text>
            <TouchableOpacity
              testID="spire-shop-reroll"
              disabled={run.coins < shop.rerollCost}
              onPress={() => { band.cue('reelSpin'); onReroll(); }}
              style={[st.rerollBtn, run.coins < shop.rerollCost && { opacity: 0.4 }]}
            >
              <Icon name="lorc/cycle" size={13} color={INK} />
              <Text style={st.rerollText}>Reroll {shop.rerollCost}¢</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {shop.weapons.map((offer, i) => {
              const heldLv = run.weaponLevels[offer.weaponId];
              const isUpgrade = !offer.sold && heldLv !== undefined;
              const w = getArmoryWeapon(offer.weaponId, { [offer.weaponId]: { level: offer.level, tuning: {} } });
              if (!w) return null;
              const afford = !offer.sold && run.coins >= offer.price;
              const evos = offer.sold || isUpgrade ? [] : newEvolutionsArmedBy(run, offer.weaponId);
              const badges: OfferBadge[] = [];
              if (offer.onSale && !offer.sold) badges.push({ text: 'SALE', bg: '#DC2626' });
              if (isUpgrade) badges.push({ text: `⬆ LV ${heldLv} → ${offer.level}`, bg: '#D97706' });
              if (evos.length > 0) badges.push({ text: '⚡ EVO', bg: TONE.evoReady });
              return (
                <WeaponOfferRow
                  key={`${offer.weaponId}-${i}`}
                  weapon={w}
                  level={offer.level}
                  badges={badges}
                  focused={inspectWeaponId === offer.weaponId}
                  dimmed={offer.sold}
                  onPress={() => { sfx('click'); setInspectWeaponId(offer.weaponId); }}
                  right={priceBtn({
                    testID: `spire-shop-weapon-${i}`,
                    disabled: !afford,
                    label: offer.sold ? 'SOLD' : `${offer.price}¢`,
                    onPress: () => {
                      band.cue(isUpgrade ? 'levelUp' : 'register');
                      band.fire(w.id, 4);
                      onBuyWeapon(i);
                    },
                  })}
                />
              );
            })}
          </View>

          {inspectedWeapon && inspectedOffer && !inspectedOffer.sold && (
            <WeaponExplainer weapon={inspectedWeapon} build={{ level: inspectedOffer.level, tuning: {} }} hidePowerNote />
          )}
        </View>

        {/* Workshop Upgrades & Services */}
        <View style={st.card}>
          <Text style={st.secTitle}>RUN UPGRADES & SERVICES</Text>
          <View style={{ gap: 8 }}>
            {shop.upgrades.map((u, i) => {
              const def = getUpgrade(u.upgradeId);
              const afford = !u.sold && run.coins >= u.price;
              return (
                <UpgradeOfferRow
                  key={u.upgradeId}
                  icon={def.icon}
                  name={def.name}
                  description={def.description(1)}
                  dimmed={u.sold}
                  right={priceBtn({
                    testID: `spire-shop-upgrade-${i}`,
                    disabled: !afford,
                    label: u.sold ? 'SOLD' : `${u.price}¢`,
                    onPress: () => { band.cue('register'); onBuyUpgrade(i); },
                  })}
                />
              );
            })}

            {/* Restorative Heal */}
            <View style={[st.serviceRow, (shop.healed || run.hearts >= run.maxHearts) && { opacity: 0.5 }]}>
              <View style={st.serviceLeft}>
                <View style={[st.iconBox, { backgroundColor: '#FEF2F2' }]}><Heart size={20} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.itemName}>Trail Tonic (+{shop.healAmount} ♥)</Text>
                  <Text style={st.itemDesc}>
                    {run.hearts >= run.maxHearts ? 'Already at full Hearts.' : `Current: ${run.hearts}/${run.maxHearts} ♥`}
                  </Text>
                </View>
              </View>
              {priceBtn({
                testID: 'spire-shop-heal',
                disabled: shop.healed || run.hearts >= run.maxHearts || run.coins < shop.healCost,
                label: shop.healed ? 'USED' : `${shop.healCost}¢`,
                onPress: () => { band.cue('heal'); onBuyHeal(); },
              })}
            </View>

            {/* Weapon Forge Service */}
            <UpgradeOfferRow
              icon="lorc/anvil"
              name="Forge Weapon (+1 Level)"
              description="Permanently empower any held weapon for this run."
              dimmed={shop.forged || forgeable.length === 0}
              right={priceBtn({
                testID: 'spire-shop-forge-toggle',
                disabled: shop.forged || forgeable.length === 0 || run.coins < shop.forgeCost,
                label: shop.forged ? 'DONE' : `${shop.forgeCost}¢`,
                onPress: () => { sfx('click'); setPickingForge(p => !p); },
              })}
            />

            {pickingForge && !shop.forged && (
              <View style={st.forgePicker}>
                <Text style={st.secTitle}>PICK WEAPON TO UPGRADE (+1 LV)</Text>
                <View style={st.forgeGrid}>
                  {forgeable.map(w => {
                    const lv = builds[w.id]?.level ?? 1;
                    return (
                      <WeaponChip
                        key={w.id}
                        testID={`spire-shop-forge-${w.id}`}
                        weapon={w}
                        label={`${w.name} Lv ${lv} → ${lv + 1}`}
                        active
                        onPress={() => {
                          band.cue('levelUp');
                          onForgeWeapon(w.id);
                          setPickingForge(false);
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Arcana Shelf */}
        {shop.arcana.length > 0 && (
          <View style={st.card}>
            <Text style={st.secTitle}>TAROT ARCANA</Text>
            <View style={{ gap: 8 }}>
              {shop.arcana.map((offer, i) => {
                const afford = !offer.sold && run.coins >= offer.price;
                return (
                  <ArcanaCard
                    key={offer.arcanaId}
                    arcanaId={offer.arcanaId}
                    dimmed={offer.sold}
                    right={priceBtn({
                      testID: `spire-shop-arcana-${i}`,
                      disabled: !afford,
                      label: offer.sold ? 'SOLD' : `${offer.price}¢`,
                      onPress: () => { band.cue('catalyst'); onBuyArcana(i); },
                    })}
                  />
                );
              })}
            </View>
          </View>
        )}

        <Btn testID="spire-shop-leave" label="Leave Shop & Continue" icon="lorc/mountaintop" onPress={() => { sfx('confirm'); onLeave(); }} />
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  body: { padding: 14, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  headerCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: INK, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 21, fontWeight: '900', color: INK, marginTop: 2 },
  sub: { fontSize: 12, color: TONE.spent },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 10 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  secTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  rerollBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4 },
  rerollText: { fontSize: 11, fontWeight: '800', color: INK },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderColor: '#D6CFC4', padding: 8 },
  serviceLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 42, height: 42, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  itemName: { flexShrink: 1, fontSize: 13.5, fontWeight: '900', color: INK },
  itemDesc: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 16 },
  buyBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7, minWidth: 58, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: '#E5E0D8', opacity: 0.55 },
  buyBtnText: { fontSize: 12, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  forgePicker: { backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, borderColor: '#D97706', padding: 10, gap: 8 },
  forgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

export default SpireShop;
