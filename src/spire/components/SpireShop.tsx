/**
 * Starfall Summit — Full Merchant Shop.
 *
 * Reuses Adventure's `UPGRADES`, `WeaponExplainer.tsx`, and shared
 * `WeaponOfferRow` / `UpgradeOfferRow` / `WeaponChip` / `ArcanaCard` so
 * shopping shares every data spec and UI primitive with Adventure Mode.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { ArcanaId } from '@/adventure/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getUpgrade } from '@/adventure/data/upgrades';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import {
  ArcanaCard,
  ArmedEvolutionRow,
  UpgradeOfferRow,
  WeaponChip,
  WeaponOfferRow,
  type OfferBadge,
} from '@/adventure/components/SharedCards';
import { Btn, CoinPill, Eyebrow, Heart, INK, PopIn, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import {
  buildSpireWeaponBuilds,
  clashesWithBelt,
  newEvolutionRecipesArmedBy,
  spireHeldWeapons,
} from '../engine/bridge';
import {
  ARCANA_PURGE_COST,
  countShopLocks,
  MAX_SHOP_LOCKS,
  MAX_SUMMIT_WEAPONS,
  maxSpireUpgradeTier,
} from '../engine/runState';
import type { SpireRun, SpireShopState } from '../types';
import SpireBeltBar from './SpireBeltBar';
import SpireSwapPicker from './SpireSwapPicker';

interface Props {
  run: SpireRun;
  shop: SpireShopState;
  onBuyWeapon: (index: number, replaceWeaponId?: string) => void;
  onBuyArcana: (index: number) => void;
  onBuyUpgrade: (index: number) => void;
  onBuyHeal: () => void;
  onForgeWeapon: (weaponId: string) => void;
  onReroll: () => void;
  onToggleLock?: (kind: 'weapon' | 'arcana' | 'upgrade', index: number) => void;
  onSellWeapon?: (weaponId: string) => void;
  onPurgeArcana?: (arcanaId: ArcanaId) => void;
  onReorderWeapon?: (fromIndex: number, toIndex: number) => void;
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
  onToggleLock,
  onSellWeapon,
  onPurgeArcana,
  onReorderWeapon,
  onLeave,
}) => {
  const [inspectWeaponId, setInspectWeaponId] = useState<string | null>(shop.weapons[0]?.weaponId ?? null);
  const [pickingForge, setPickingForge] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const beltFull = run.weapons.length >= MAX_SUMMIT_WEAPONS;

  const inspectedOffer = shop.weapons.find(o => o.weaponId === inspectWeaponId);
  const inspectedWeapon = inspectedOffer
    ? getArmoryWeapon(inspectedOffer.weaponId, { [inspectedOffer.weaponId]: { level: inspectedOffer.level, tuning: {} } })
    : undefined;

  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);
  const forgeable = held.filter(w => (run.weaponLevels[w.id] ?? 1) < MAX_WEAPON_LEVEL);
  const lockedCount = countShopLocks(shop);

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

  const lockBtn = (opts: {
    testID: string;
    locked?: boolean;
    sold?: boolean;
    onPress: () => void;
  }) => {
    if (!onToggleLock || opts.sold) return null;
    const atCap = !opts.locked && lockedCount >= MAX_SHOP_LOCKS;
    return (
      <TouchableOpacity
        testID={opts.testID}
        disabled={atCap}
        onPress={() => {
          sfx('click');
          opts.onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={opts.locked ? 'Unlock item' : 'Lock item for next shop'}
        style={[st.lockBtn, opts.locked && st.lockBtnActive, atCap && st.buyBtnDisabled]}
      >
        <Icon name="lorc/padlock" size={14} color={opts.locked ? COLORS.canvasWhite : INK} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={st.root} testID="spire-shop">
      <ScrollView contentContainerStyle={st.body}>
        <PopIn style={st.headerCard}>
          <View style={st.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow text="STARFALL BAZAAR" color={COLORS.actionYellow} />
              <Text style={st.title}>Merchant’s Tent</Text>
              <Text style={st.sub}>
                Lock up to {MAX_SHOP_LOCKS} wares to carry across rerolls &amp; your next Shop!
              </Text>
            </View>
            <CoinPill coins={run.coins} />
          </View>
          {lockedCount > 0 && (
            <View style={st.lockSummary} testID="spire-shop-lock-count">
              <Icon name="lorc/padlock" size={12} color="#1D4ED8" />
              <Text style={st.lockSummaryText}>
                Locked {lockedCount}/{MAX_SHOP_LOCKS} — held across rerolls &amp; next Merchant visit
              </Text>
            </View>
          )}
        </PopIn>

        {/* Weapons Shelf */}
        <View style={st.card}>
          <View style={st.secHead}>
            <View style={st.secTitleRow}>
              <Text style={st.secTitle}>ARMORY WARES</Text>
              {beltFull && (
                <View style={st.fullPill} testID="spire-shop-belt-full">
                  <Text style={st.fullPillText}>
                    {`BELT ${run.weapons.length}/${MAX_SUMMIT_WEAPONS}`}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              testID="spire-shop-reroll"
              disabled={run.coins < shop.rerollCost}
              onPress={() => { band.cue('reelSpin'); setSwapIdx(null); onReroll(); }}
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
              const needsSwap = !offer.sold && beltFull && !isUpgrade;
              const w = getArmoryWeapon(offer.weaponId, { [offer.weaponId]: { level: offer.level, tuning: {} } });
              if (!w) return null;
              const afford = !offer.sold && run.coins >= offer.price;
              const evos = offer.sold || isUpgrade ? [] : newEvolutionRecipesArmedBy(run, offer.weaponId);
              const clashes = offer.sold || isUpgrade ? [] : clashesWithBelt(run.weapons, offer.weaponId);
              const badges: OfferBadge[] = [];
              if (offer.locked && !offer.sold) badges.push({ text: 'LOCKED', bg: '#2563EB' });
              if (offer.onSale && !offer.sold) badges.push({ text: 'SALE', bg: '#DC2626' });
              if (isUpgrade) badges.push({ text: `⬆ LV ${heldLv} → ${offer.level}`, bg: '#D97706' });
              if (evos.length > 0) {
                badges.push({
                  text: evos.length > 1 ? `⚡ ${evos[0].name} +${evos.length - 1}` : `⚡ ${evos[0].name}`,
                  bg: TONE.evoReady,
                });
              }
              if (clashes.length > 0) badges.push({ text: '⚠ CLASH', bg: '#B91C1C' });
              const btnLabel = offer.sold
                ? 'SOLD'
                : needsSwap
                  ? `Swap ${offer.price}¢`
                  : isUpgrade
                    ? `⬆ ${offer.price}¢`
                    : `${offer.price}¢`;
              return (
                <View key={`${offer.weaponId}-${i}`} style={{ gap: 5 }}>
                  <WeaponOfferRow
                    weapon={w}
                    level={offer.level}
                    badges={badges}
                    focused={inspectWeaponId === offer.weaponId}
                    dimmed={offer.sold}
                    onPress={() => { sfx('click'); setInspectWeaponId(offer.weaponId); }}
                    right={
                      <View style={st.offerActions}>
                        {lockBtn({
                          testID: `spire-shop-lock-weapon-${i}`,
                          locked: offer.locked,
                          sold: offer.sold,
                          onPress: () => onToggleLock?.('weapon', i),
                        })}
                        {priceBtn({
                          testID: `spire-shop-weapon-${i}`,
                          disabled: !afford,
                          label: btnLabel,
                          onPress: () => {
                            if (needsSwap) {
                              sfx('click');
                              setInspectWeaponId(offer.weaponId);
                              setSwapIdx(prev => (prev === i ? null : i));
                              return;
                            }
                            band.cue(isUpgrade ? 'levelUp' : 'register');
                            band.fire(w.id, 4);
                            setSwapIdx(null);
                            onBuyWeapon(i);
                          },
                        })}
                      </View>
                    }
                  />
                  {swapIdx === i && needsSwap && afford && (
                    <SpireSwapPicker
                      run={run}
                      incomingWeaponId={offer.weaponId}
                      incomingLevel={offer.level}
                      price={offer.price}
                      testIDPrefix="spire-shop-swap"
                      onConfirmSwap={dropId => {
                        band.cue('register');
                        band.fire(w.id, 4);
                        setSwapIdx(null);
                        onBuyWeapon(i, dropId);
                      }}
                      onCancel={() => {
                        sfx('click');
                        setSwapIdx(null);
                      }}
                    />
                  )}
                  {evos.length > 0 && (
                    <View style={st.evoCallouts} testID={`spire-shop-evo-${i}`}>
                      {evos.slice(0, 2).map(r => (
                        <ArmedEvolutionRow key={r.id} recipe={r} showFamily />
                      ))}
                    </View>
                  )}
                  {clashes.length > 0 && (
                    <View style={st.clashBox} testID={`spire-shop-clash-${i}`}>
                      {clashes.map(c => (
                        <Text key={c.partnerId} style={st.clashText}>
                          ⚠ Clash with {c.partnerName}: {c.reason}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
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
              const cur = run.upgrades?.[u.upgradeId] ?? 0;
              const max = maxSpireUpgradeTier(u.upgradeId);
              const maxed = cur >= max;
              const nextTier = Math.min(max, cur + 1);
              const afford = !u.sold && !maxed && run.coins >= u.price;
              const tierLabel = u.sold
                ? `${def.name} (Tier ${Math.min(cur, max)}/${max})`
                : `${def.name} (Tier ${nextTier}/${max}${u.locked ? ' · Locked' : ''})`;
              const desc = u.sold
                ? cur >= max
                  ? `MAXED · ${def.description(max)}`
                  : `Owned · ${def.description(cur)}`
                : cur > 0
                  ? `${def.description(1)} → ${def.description(nextTier)}`
                  : def.description(1);
              return (
                <UpgradeOfferRow
                  key={u.upgradeId}
                  icon={def.icon}
                  name={tierLabel}
                  description={desc}
                  dimmed={u.sold || maxed}
                  right={
                    <View style={st.offerActions}>
                      {lockBtn({
                        testID: `spire-shop-lock-upgrade-${i}`,
                        locked: u.locked,
                        sold: u.sold || maxed,
                        onPress: () => onToggleLock?.('upgrade', i),
                      })}
                      {priceBtn({
                        testID: `spire-shop-upgrade-${i}`,
                        disabled: !afford,
                        label: u.sold ? 'SOLD' : maxed ? 'MAX' : `${u.price}¢`,
                        onPress: () => { band.cue('register'); onBuyUpgrade(i); },
                      })}
                    </View>
                  }
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
                    badgeText={offer.locked && !offer.sold ? 'LOCKED' : undefined}
                    dimmed={offer.sold}
                    right={
                      <View style={st.offerActions}>
                        {lockBtn({
                          testID: `spire-shop-lock-arcana-${i}`,
                          locked: offer.locked,
                          sold: offer.sold,
                          onPress: () => onToggleLock?.('arcana', i),
                        })}
                        {priceBtn({
                          testID: `spire-shop-arcana-${i}`,
                          disabled: !afford,
                          label: offer.sold ? 'SOLD' : `${offer.price}¢`,
                          onPress: () => { band.cue('catalyst'); onBuyArcana(i); },
                        })}
                      </View>
                    }
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Held Belt: Reorder & Sell (50% refund) */}
        {(onSellWeapon || onReorderWeapon) && (
          <SpireBeltBar
            run={run}
            onReorder={onReorderWeapon}
            onSell={
              onSellWeapon
                ? wId => {
                    setSwapIdx(null);
                    onSellWeapon(wId);
                  }
                : undefined
            }
            title={onSellWeapon ? 'MY BELT · REORDER OR SELL (50%)' : 'MY BELT · REORDER'}
            testIDPrefix="spire-shop-belt"
          />
        )}

        {/* Purge unwanted Arcana */}
        {onPurgeArcana && run.arcana.length > 0 && (
          <View style={st.card} testID="spire-shop-purge-section">
            <Text style={st.secTitle}>PURGE EQUIPPED ARCANA ({ARCANA_PURGE_COST}¢)</Text>
            <View style={{ gap: 8 }}>
              {run.arcana.map(id => {
                const canAfford = run.coins >= ARCANA_PURGE_COST;
                return (
                  <ArcanaCard
                    key={id}
                    arcanaId={id}
                    right={
                      <TouchableOpacity
                        testID={`spire-shop-purge-arcana-${id}`}
                        disabled={!canAfford}
                        onPress={() => {
                          sfx('click');
                          onPurgeArcana(id);
                        }}
                        style={[st.purgeBtn, !canAfford && st.buyBtnDisabled]}
                      >
                        <Text style={st.purgeBtnText}>Purge {ARCANA_PURGE_COST}¢</Text>
                      </TouchableOpacity>
                    }
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
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flexShrink: 1, minWidth: 0 },
  secTitle: { flexShrink: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: TONE.spent },
  fullPill: { backgroundColor: '#FEF3C7', borderRadius: 4, borderWidth: 1, borderColor: '#D97706', paddingHorizontal: 5, paddingVertical: 1 },
  fullPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#92400E' },
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
  offerActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  lockBtnActive: { backgroundColor: '#2563EB', borderColor: '#1E3A8A' },
  lockSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1.5, borderColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 5 },
  lockSummaryText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  evoCallouts: { gap: 4, paddingLeft: 4 },
  clashBox: { backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1.5, borderColor: '#B91C1C', paddingHorizontal: 9, paddingVertical: 6, gap: 2 },
  clashText: { fontSize: 11.5, fontWeight: '800', color: '#991B1B', lineHeight: 16 },
  purgeBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: '#991B1B', paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  purgeBtnText: { fontSize: 11, fontWeight: '900', color: '#991B1B', fontVariant: ['tabular-nums'] },
  forgePicker: { backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, borderColor: '#D97706', padding: 10, gap: 8 },
  forgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

export default SpireShop;
