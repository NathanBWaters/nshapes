/**
 * Starfall Spire — Full Merchant Shop.
 *
 * Brings back rich roguelike shopping (Weapons w/ Sale tags & Evolution synergy
 * badges, Arcana wildcards, Workshop-style Run Upgrades, Heart Restorative,
 * Weapon Level Forging, and Stock Rerolls) while reusing `WeaponExplainer.tsx`!
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import { getArmoryWeapon, weaponLevelSuffix } from '@/adventure/data/armory';
import { getArcana } from '@/adventure/data/arcana';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
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
              const w = getArmoryWeapon(offer.weaponId, { [offer.weaponId]: { level: offer.level, tuning: {} } });
              if (!w) return null;
              const afford = !offer.sold && run.coins >= offer.price;
              const evos = offer.sold ? [] : newEvolutionsArmedBy(run, offer.weaponId);
              const focused = inspectWeaponId === offer.weaponId;
              return (
                <View key={`${offer.weaponId}-${i}`} style={[st.row, focused && st.rowFocused, offer.sold && { opacity: 0.45 }]}>
                  <TouchableOpacity onPress={() => { sfx('click'); setInspectWeaponId(offer.weaponId); }} style={st.rowLeft}>
                    <View style={st.iconBox}><WeaponAvatar weapon={w} size={30} /></View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={st.tagRow}>
                        <Text style={st.itemName} numberOfLines={1}>
                          {w.name}{weaponLevelSuffix(offer.level)}
                        </Text>
                        {offer.onSale && !offer.sold && (
                          <View style={st.saleTag}><Text style={st.saleText}>SALE</Text></View>
                        )}
                        {evos.length > 0 && (
                          <View style={st.evoTag}><Text style={st.evoText}>⚡ EVO</Text></View>
                        )}
                      </View>
                      <Text style={st.itemDesc} numberOfLines={2}>{w.shortDescription}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`spire-shop-weapon-${i}`}
                    disabled={!afford}
                    onPress={() => {
                      band.cue('register');
                      band.fire(w.id, 4);
                      onBuyWeapon(i);
                    }}
                    style={[st.buyBtn, !afford && st.buyBtnDisabled]}
                  >
                    <Text style={st.buyBtnText}>{offer.sold ? 'SOLD' : `${offer.price}¢`}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {inspectedWeapon && inspectedOffer && !inspectedOffer.sold && (
            <WeaponExplainer weapon={inspectedWeapon} build={{ level: inspectedOffer.level, tuning: {} }} />
          )}
        </View>

        {/* Workshop Upgrades & Services */}
        <View style={st.card}>
          <Text style={st.secTitle}>RUN UPGRADES & SERVICES</Text>
          <View style={{ gap: 8 }}>
            {shop.upgrades.map((u, i) => {
              const afford = !u.sold && run.coins >= u.price;
              return (
                <View key={u.kind} style={[st.row, u.sold && { opacity: 0.45 }]}>
                  <View style={st.rowLeft}>
                    <View style={st.iconBox}><Icon name={u.icon} size={22} color={INK} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.itemName}>{u.name}</Text>
                      <Text style={st.itemDesc}>{u.description}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID={`spire-shop-upgrade-${i}`}
                    disabled={!afford}
                    onPress={() => { band.cue('register'); onBuyUpgrade(i); }}
                    style={[st.buyBtn, !afford && st.buyBtnDisabled]}
                  >
                    <Text style={st.buyBtnText}>{u.sold ? 'SOLD' : `${u.price}¢`}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Restorative Heal */}
            <View style={[st.row, (shop.healed || run.hearts >= run.maxHearts) && { opacity: 0.5 }]}>
              <View style={st.rowLeft}>
                <View style={[st.iconBox, { backgroundColor: '#FEF2F2' }]}><Heart size={20} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.itemName}>Trail Tonic (+{shop.healAmount} ♥)</Text>
                  <Text style={st.itemDesc}>
                    {run.hearts >= run.maxHearts ? 'Already at full Hearts.' : `Current: ${run.hearts}/${run.maxHearts} ♥`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                testID="spire-shop-heal"
                disabled={shop.healed || run.hearts >= run.maxHearts || run.coins < shop.healCost}
                onPress={() => { band.cue('heal'); onBuyHeal(); }}
                style={[st.buyBtn, (shop.healed || run.hearts >= run.maxHearts || run.coins < shop.healCost) && st.buyBtnDisabled]}
              >
                <Text style={st.buyBtnText}>{shop.healed ? 'USED' : `${shop.healCost}¢`}</Text>
              </TouchableOpacity>
            </View>

            {/* Weapon Forge Service */}
            <View style={[st.row, (shop.forged || forgeable.length === 0) && { opacity: 0.5 }]}>
              <View style={st.rowLeft}>
                <View style={[st.iconBox, { backgroundColor: '#FFFBEB' }]}><Icon name="lorc/anvil" size={22} color="#B45309" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.itemName}>Forge Weapon (+1 Level)</Text>
                  <Text style={st.itemDesc}>Permanently empower any held weapon for this run.</Text>
                </View>
              </View>
              <TouchableOpacity
                testID="spire-shop-forge-toggle"
                disabled={shop.forged || forgeable.length === 0 || run.coins < shop.forgeCost}
                onPress={() => { sfx('click'); setPickingForge(p => !p); }}
                style={[st.buyBtn, (shop.forged || forgeable.length === 0 || run.coins < shop.forgeCost) && st.buyBtnDisabled]}
              >
                <Text style={st.buyBtnText}>{shop.forged ? 'DONE' : `${shop.forgeCost}¢`}</Text>
              </TouchableOpacity>
            </View>

            {pickingForge && !shop.forged && (
              <View style={st.forgePicker}>
                <Text style={st.secTitle}>PICK WEAPON TO UPGRADE (+1 LV)</Text>
                <View style={st.forgeGrid}>
                  {forgeable.map(w => (
                    <TouchableOpacity
                      key={w.id}
                      testID={`spire-shop-forge-${w.id}`}
                      onPress={() => {
                        band.cue('levelUp');
                        onForgeWeapon(w.id);
                        setPickingForge(false);
                      }}
                      style={st.forgeChip}
                    >
                      <WeaponAvatar weapon={w} size={22} />
                      <Text style={st.forgeChipText} numberOfLines={1}>
                        {w.name} Lv {builds[w.id]?.level ?? 1} → {(builds[w.id]?.level ?? 1) + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                const a = getArcana(offer.arcanaId);
                const afford = !offer.sold && run.coins >= offer.price;
                return (
                  <View key={offer.arcanaId} style={[st.row, { borderColor: TONE.arcana, backgroundColor: TONE.arcanaPale }, offer.sold && { opacity: 0.45 }]}>
                    <View style={st.rowLeft}>
                      <View style={[st.iconBox, { borderColor: TONE.arcana }]}><Icon name={a.icon} size={22} color={TONE.arcana} /></View>
                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <Text style={[st.itemName, { color: TONE.arcana }]}>{a.numeral} · {a.name}</Text>
                        <Text style={[st.itemDesc, { color: TONE.upside, fontWeight: '700' }]}>▲ {a.upside}</Text>
                        <Text style={[st.itemDesc, { color: TONE.tradeoff }]}>▼ {a.tradeoff}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      testID={`spire-shop-arcana-${i}`}
                      disabled={!afford}
                      onPress={() => { band.cue('catalyst'); onBuyArcana(i); }}
                      style={[st.buyBtn, !afford && st.buyBtnDisabled]}
                    >
                      <Text style={st.buyBtnText}>{offer.sold ? 'SOLD' : `${offer.price}¢`}</Text>
                    </TouchableOpacity>
                  </View>
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
  root: { flex: 1, backgroundColor: '#1E1B2E' },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderColor: '#D6CFC4', padding: 8 },
  rowFocused: { borderColor: INK, backgroundColor: TONE.selected },
  rowLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 40, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  itemName: { flexShrink: 1, fontSize: 13, fontWeight: '900', color: INK },
  itemDesc: { fontSize: 11, color: INK, opacity: 0.85, lineHeight: 15 },
  saleTag: { backgroundColor: '#DC2626', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  saleText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  evoTag: { backgroundColor: TONE.arcana, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  evoText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  buyBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, paddingHorizontal: 10, paddingVertical: 7, minWidth: 58, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: '#E5E0D8', opacity: 0.55 },
  buyBtnText: { fontSize: 12, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  forgePicker: { backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, borderColor: '#D97706', padding: 10, gap: 8 },
  forgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  forgeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 6, maxWidth: '100%' },
  forgeChipText: { flexShrink: 1, fontSize: 11, fontWeight: '900', color: INK },
});

export default SpireShop;
