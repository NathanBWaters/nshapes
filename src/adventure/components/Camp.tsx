/**
 * Camp — spend (and freely refund!) coins. Four tabs:
 *   Fighters: level each fighter 1→10 (upgrades their starting gear)
 *   Workshop: expensive permanent upgrades
 *   Armory:   weapons unlocked so far (equip one as your Charm)
 *   Arcana:   toggleable kiss-curse tarot wildcards
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import type { FighterReactionEvent, FighterReactionType } from '@/utils/fighterAnimations';
import { COLORS, getRarityColor } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { sfx } from '@/audio';
import type { CharacterName } from '@/types';
import type { AdventureSave } from '../types';
import { FIGHTERS, MAX_FIGHTER_LEVEL, getLevelUpCost, getLoadout } from '../data/fighters';
import { MAX_WEAPON_UPGRADE_TIER, applyWeaponUpgradeTier, describeWeaponUpgradeBonus, getUnlockedUpgrades } from '../data/upgrades';
import { ARCANA } from '../data/arcana';
import { MECHANICS } from '../data/mechanics';
import {
  buyUpgrade,
  buyWeaponUpgrade,
  canBuyUpgrade,
  canLevelFighter,
  canUpgradeWeapon,
  equipArcana,
  equipCharm,
  fighterLevel,
  fighterSpentCoins,
  levelFighter,
  refundAllCamp,
  refundFighter,
  refundUpgrade,
  refundWeaponUpgrade,
  refundableCoins,
  upgradeCost,
  upgradeSpentCoins,
  upgradeTier,
  weaponUpgradeCost,
  weaponUpgradeSpentCoins,
  weaponUpgradeTier,
} from '../progress';
import { Btn, CoinPill, INK, PopIn } from './ui';

export type CampTab = 'fighters' | 'workshop' | 'armory' | 'arcana';

interface Props {
  save: AdventureSave;
  onChange: (save: AdventureSave) => void;
  onClose: () => void;
  initialTab?: CampTab;
}

const weapon = (id: string) => WEAPONS.find(w => w.id === id);

const Camp: React.FC<Props> = ({ save, onChange, onClose, initialTab = 'fighters' }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CampTab>(initialTab);
  const [reactions, setReactions] = useState<Partial<Record<CharacterName, FighterReactionEvent>>>({});
  const [armoryTapCounts, setArmoryTapCounts] = useState<Record<string, number>>({});
  const reactionSeq = useRef(0);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const fireFighterReaction = (name: CharacterName, type: FighterReactionType) => {
    reactionSeq.current += 1;
    setReactions(prev => ({ ...prev, [name]: { type, id: reactionSeq.current } }));
  };

  const totalRefundable = refundableCoins(save);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => { sfx('back'); onClose(); }} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name="lorc/campfire" size={24} color={COLORS.impactOrange} />
        <Text style={st.title}>CAMP</Text>
        <View style={{ flex: 1 }} />
        <CoinPill coins={save.coins} />
      </View>
      <View style={st.tabs}>
        {(['fighters', 'workshop', 'armory', 'arcana'] as CampTab[]).map(t => (
          <TouchableOpacity
            key={t}
            testID={`camp-tab-${t}`}
            onPress={() => { sfx('click'); setTab(t); }}
            style={[st.tab, tab === t && st.tabOn]}
          >
            <Text style={[st.tabText, tab === t && { color: INK }]} numberOfLines={1}>
              {t === 'workshop' && !save.workshopUnlocked ? '🔒 WORKSHOP' : t.toUpperCase()}
              {t === 'arcana' && save.activeArcana ? ' •' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {totalRefundable > 0 && (tab === 'fighters' || (tab === 'workshop' && save.workshopUnlocked)) && (
        <View style={st.refundBanner}>
          <View style={{ flex: 1 }}>
            <Text style={st.refundBannerTitle}>100% Free Respec</Text>
            <Text style={st.refundBannerSub}>Experiment freely — get every spent coin back anytime.</Text>
          </View>
          <TouchableOpacity
            testID="camp-refund-all"
            onPress={() => { sfx('coin'); onChange(refundAllCamp(save)); }}
            style={st.refundAllBtn}
            activeOpacity={0.85}
          >
            <Icon name="lorc/recycle" size={15} color={INK} />
            <Text style={st.refundAllText}>Refund All (+{totalRefundable}¢)</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}>
        {tab === 'fighters' && FIGHTERS.map(f => {
          const unlocked = save.unlockedFighters.includes(f.name);
          const lvl = fighterLevel(save, f.name);
          const spent = fighterSpentCoins(save, f.name);
          const cost = getLevelUpCost(lvl);
          const now = getLoadout(f.name, lvl);
          const next = lvl < MAX_FIGHTER_LEVEL ? getLoadout(f.name, lvl + 1) : null;
          const nextPerk = lvl < MAX_FIGHTER_LEVEL ? f.perkText[lvl] : null;
          const gearChanges = next ? next.filter((id, i) => now[i] !== id) : [];
          const sig = MECHANICS[f.signature];
          const selected = save.selectedFighter === f.name;
          return (
            <View key={f.name} style={[st.fighter, !unlocked && { opacity: 0.55 }, selected && { borderColor: COLORS.deepOnyx, backgroundColor: '#FFFBE0' }]}>
              <View style={st.fighterHead}>
                {unlocked ? (
                  <FighterAvatar
                    testID={`camp-fighter-avatar-${f.name}`}
                    character={f.name}
                    size={50}
                    mood={selected ? 'anticipation' : 'idle'}
                    reaction={reactions[f.name] ?? null}
                    framed
                    interactive
                  />
                ) : (
                  <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={st.fighterName}>{unlocked ? f.name : '???'}</Text>
                  <Text style={st.fighterBlurb}>{unlocked ? f.blurb : 'A fighter you have not met yet. Keep winning stars.'}</Text>
                  {unlocked && <LevelPips level={lvl} />}
                </View>
                {unlocked && !selected && (
                  <Btn
                    small
                    variant="secondary"
                    label="Use"
                    onPress={() => {
                      sfx('confirm');
                      fireFighterReaction(f.name, 'joy');
                      onChange({ ...save, selectedFighter: f.name });
                    }}
                  />
                )}
                {selected && <View style={st.usingTag}><Text style={st.usingText}>USING</Text></View>}
              </View>
              {unlocked && (
                <>
                  <View style={st.gearRow}>
                    {now.map((id, i) => {
                      const w = weapon(id);
                      const wTier = weaponUpgradeTier(save, id);
                      return (
                        <View key={i} style={[st.gear, { borderColor: w ? getRarityColor(w.rarity) : INK }]}>
                          {w && <WeaponAvatar weapon={w} size={20} interactive />}
                          <Text style={st.gearText} numberOfLines={1}>
                            {w?.name ?? id}{wTier > 0 ? ` +${wTier}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {sig && <Text style={st.sigText}><Text style={{ fontWeight: '900' }}>Signature: </Text>{sig.tagline}</Text>}
                  <View style={st.levelUpRow}>
                    {cost !== null ? (
                      <>
                        <Text style={st.nextText} numberOfLines={2}>
                          Lv {lvl + 1}: {[...gearChanges.map(id => {
                            const w = weapon(id);
                            return w ? `${w.name} (${w.rarity})` : id;
                          }), nextPerk].filter(Boolean).join(' · ') || 'Stronger gear'}
                        </Text>
                        {spent > 0 && (
                          <TouchableOpacity
                            testID={`camp-refund-fighter-${f.name}`}
                            onPress={() => { sfx('coin'); onChange(refundFighter(save, f.name)); }}
                            style={st.refundChip}
                            activeOpacity={0.85}
                          >
                            <Icon name="lorc/recycle" size={13} color={INK} />
                            <Text style={st.refundChipText}>+{spent}¢</Text>
                          </TouchableOpacity>
                        )}
                        <Btn
                          small
                          label={`${cost}¢`}
                          icon="lorc/crown-coin"
                          disabled={!canLevelFighter(save, f.name)}
                          onPress={() => {
                            sfx('levelup');
                            fireFighterReaction(f.name, 'powerup');
                            onChange(levelFighter(save, f.name));
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={[st.maxed, { flex: 1 }]}>MAX LEVEL</Text>
                        {spent > 0 && (
                          <TouchableOpacity
                            testID={`camp-refund-fighter-${f.name}`}
                            onPress={() => { sfx('coin'); onChange(refundFighter(save, f.name)); }}
                            style={st.refundChip}
                            activeOpacity={0.85}
                          >
                            <Icon name="lorc/recycle" size={13} color={INK} />
                            <Text style={st.refundChipText}>Reset (+{spent}¢)</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}

        {tab === 'workshop' && (
          !save.workshopUnlocked ? (
            <View testID="camp-workshop-locked" style={st.lockedWorkshop}>
              <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
              <Text style={st.fighterName}>Workshop Locked</Text>
              <Text style={[st.fighterBlurb, { textAlign: 'center' }]}>
                Earn ★ on 1-4 Power Up to unlock the ability to upgrade your unlocked mechanics and Armory weapons!
              </Text>
            </View>
          ) : (
            <>
              <Text style={st.blurb}>
                Upgrade any mechanic or Armory weapon you have unlocked. Refundable at 100% value anytime.
              </Text>

              <Text style={st.sectionLabel}>MECHANIC UPGRADES</Text>
              {getUnlockedUpgrades(save).length === 0 ? (
                <Text style={st.blurb}>Play further in the campaign to unlock mechanics to upgrade.</Text>
              ) : (
                getUnlockedUpgrades(save).map(u => {
                  const tier = upgradeTier(save, u.id);
                  const cost = upgradeCost(save, u.id);
                  const spent = upgradeSpentCoins(save, u.id);
                  return (
                    <PopIn key={u.id} style={st.upgrade}>
                      <View testID={`camp-upgrade-${u.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={st.portrait}><Icon name={u.icon} size={30} color={INK} /></View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={st.fighterName}>{u.name}</Text>
                          <Text style={st.fighterBlurb}>{tier > 0 ? `Now: ${u.description(tier)}` : u.description(1)}</Text>
                          <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
                            {u.costs.map((_, i) => <View key={i} style={[st.tierPip, i < tier && st.tierPipOn]} />)}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {cost !== null ? (
                            <Btn
                              small
                              testID={`camp-buy-upgrade-${u.id}`}
                              label={`${cost}¢`}
                              icon="lorc/crown-coin"
                              disabled={!canBuyUpgrade(save, u.id)}
                              onPress={() => { sfx('unlock'); onChange(buyUpgrade(save, u.id)); }}
                            />
                          ) : (
                            <Text style={st.maxed}>MAX</Text>
                          )}
                          {spent > 0 && (
                            <TouchableOpacity
                              testID={`camp-refund-upgrade-${u.id}`}
                              onPress={() => { sfx('coin'); onChange(refundUpgrade(save, u.id)); }}
                              style={st.refundChip}
                              activeOpacity={0.85}
                            >
                              <Icon name="lorc/recycle" size={12} color={INK} />
                              <Text style={st.refundChipText}>+{spent}¢</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </PopIn>
                  );
                })
              )}

              <Text style={st.sectionLabel}>WEAPON UPGRADES</Text>
              {save.armory.length === 0 ? (
                <Text style={st.blurb}>Unlock weapons in your Armory to enhance them here.</Text>
              ) : (
                WEAPONS.filter(w => save.armory.includes(w.id)).map(w => {
                  const tier = weaponUpgradeTier(save, w.id);
                  const cost = weaponUpgradeCost(save, w.id);
                  const spent = weaponUpgradeSpentCoins(save, w.id);
                  return (
                    <PopIn key={w.id} style={st.upgrade}>
                      <View testID={`camp-weapon-upgrade-${w.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[st.portrait, { borderColor: getRarityColor(w.rarity) }]}>
                          <WeaponAvatar weapon={w} size={34} interactive />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={st.fighterName}>
                            {w.name}{tier > 0 ? ` +${tier}` : ''}
                          </Text>
                          <Text style={st.fighterBlurb}>
                            {tier > 0
                              ? `Now: ${describeWeaponUpgradeBonus(w, tier)}`
                              : `Next: ${describeWeaponUpgradeBonus(w, 1)}`}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
                            {Array.from({ length: MAX_WEAPON_UPGRADE_TIER }).map((_, i) => (
                              <View key={i} style={[st.tierPip, i < tier && st.tierPipOn]} />
                            ))}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {cost !== null ? (
                            <Btn
                              small
                              testID={`camp-buy-weapon-${w.id}`}
                              label={`${cost}¢`}
                              icon="lorc/crown-coin"
                              disabled={!canUpgradeWeapon(save, w.id)}
                              onPress={() => { sfx('unlock'); onChange(buyWeaponUpgrade(save, w.id)); }}
                            />
                          ) : (
                            <Text style={st.maxed}>MAX</Text>
                          )}
                          {spent > 0 && (
                            <TouchableOpacity
                              testID={`camp-refund-weapon-${w.id}`}
                              onPress={() => { sfx('coin'); onChange(refundWeaponUpgrade(save, w.id)); }}
                              style={st.refundChip}
                              activeOpacity={0.85}
                            >
                              <Icon name="lorc/recycle" size={12} color={INK} />
                              <Text style={st.refundChipText}>+{spent}¢</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </PopIn>
                  );
                })
              )}
            </>
          )
        )}

        {tab === 'armory' && (
          <>
            <Text style={st.blurb}>Weapons you've unlocked. Tap one to equip it as your charm. They also show up in level-up picks and shops.</Text>
            {save.armory.length === 0 && <Text style={st.blurb}>Nothing here yet. Some stars unlock a weapon.</Text>}
            <View style={st.armory}>
              {WEAPONS.filter(w => save.armory.includes(w.id)).map(w => {
                const equipped = save.charm === w.id;
                const wTier = weaponUpgradeTier(save, w.id);
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => {
                      sfx('confirm');
                      setArmoryTapCounts(prev => ({ ...prev, [w.id]: (prev[w.id] ?? 0) + 1 }));
                      onChange(equipCharm(save, w.id));
                    }}
                    activeOpacity={0.85}
                    style={[st.armoryItem, { borderColor: equipped ? COLORS.actionYellow : getRarityColor(w.rarity) }, equipped && { backgroundColor: '#FFFBE0' }]}
                  >
                    <WeaponAvatar weapon={w} size={36} triggerKey={armoryTapCounts[w.id]} />
                    <Text style={st.armoryName} numberOfLines={1}>{w.name}{wTier > 0 ? ` +${wTier}` : ''}</Text>
                    <Text style={[st.armoryRarity, { color: getRarityColor(w.rarity) === COLORS.rarityCommon ? '#8E877D' : getRarityColor(w.rarity) }]}>{equipped ? 'equipped' : w.rarity}</Text>
                    <Text style={st.armoryDesc} numberOfLines={2}>{applyWeaponUpgradeTier(w, wTier).shortDescription}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={st.blurb}>More weapons are out there…</Text>
          </>
        )}

        {tab === 'arcana' && (
          <>
            <Text style={st.blurb}>
              Equip up to ONE Arcana tarot wildcard to twist the rules of a fight. Tap an equipped Arcana again to return to standard rules.
            </Text>
            {ARCANA.map(a => {
              const unlocked = save.unlockedArcana.includes(a.id);
              const equipped = save.activeArcana === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  testID={`camp-arcana-${a.id}`}
                  disabled={!unlocked}
                  onPress={() => {
                    sfx('confirm');
                    onChange(equipArcana(save, equipped ? null : a.id));
                  }}
                  activeOpacity={0.85}
                  style={[
                    st.arcanaCard,
                    !unlocked && { opacity: 0.6, backgroundColor: '#EFEAE2' },
                    equipped && { borderColor: COLORS.actionYellow, backgroundColor: '#FFFBE0' },
                  ]}
                >
                  <View style={[st.arcanaTarot, equipped && { backgroundColor: COLORS.actionYellow }]}>
                    <Text style={st.arcanaNumeral}>{a.numeral}</Text>
                    <Icon name={unlocked ? a.icon : 'lorc/padlock'} size={26} color={INK} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <Text style={st.fighterName}>{unlocked ? a.name : `Arcana ${a.numeral}: ???`}</Text>
                      {equipped && <View style={st.usingTag}><Text style={st.usingText}>ACTIVE</Text></View>}
                    </View>
                    {unlocked ? (
                      <>
                        <Text style={st.fighterBlurb}>{a.tagline}</Text>
                        <Text style={st.arcanaUpside}>▲ {a.upside}</Text>
                        <Text style={st.arcanaTradeoff}>▼ {a.tradeoff}</Text>
                      </>
                    ) : (
                      <Text style={st.fighterBlurb}>Unlock: {a.unlockHint}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const LevelPips: React.FC<{ level: number }> = ({ level }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
    <Text style={st.lvText}>LV {level}</Text>
    {Array.from({ length: MAX_FIGHTER_LEVEL }).map((_, i) => <View key={i} style={[st.lvPip, i < level && st.lvPipOn]} />)}
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 18 },
  tabs: { flexDirection: 'row', gap: 6, padding: 10 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 2, borderColor: '#6B5A49', alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  tabText: { fontWeight: '900', color: '#E9DCCB', letterSpacing: 1.5, fontSize: 12 },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  blurb: { color: '#E9DCCB', fontSize: 13, textAlign: 'center', marginVertical: 4 },
  fighter: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  fighterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  fighterName: { fontWeight: '900', fontSize: 16, color: INK },
  fighterBlurb: { fontSize: 12, color: INK, opacity: 0.8 },
  usingTag: { backgroundColor: INK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  usingText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gear: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 170 },
  gearText: { fontSize: 11, fontWeight: '800', color: INK },
  sigText: { fontSize: 12, color: INK },
  levelUpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  nextText: { flex: 1, fontSize: 12, fontWeight: '700', color: INK },
  maxed: { fontWeight: '900', color: COLORS.logicTeal, letterSpacing: 1, fontSize: 12 },
  lvText: { fontSize: 10, fontWeight: '900', color: INK, marginRight: 4 },
  lvPip: { width: 10, height: 6, borderRadius: 2, backgroundColor: '#E2DBD0' },
  lvPipOn: { backgroundColor: COLORS.actionYellow, borderWidth: 1, borderColor: INK },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  lockedWorkshop: { alignItems: 'center', gap: 8, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 20, marginTop: 8 },
  sectionLabel: { color: COLORS.actionYellow, fontWeight: '900', fontSize: 11, letterSpacing: 2, marginTop: 8, marginBottom: 2 },
  tierPip: { width: 18, height: 6, borderRadius: 2, backgroundColor: '#E2DBD0' },
  tierPipOn: { backgroundColor: COLORS.logicTeal },
  armory: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  armoryItem: { width: 120, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2.5, padding: 8, alignItems: 'center', gap: 2 },
  armoryName: { fontWeight: '900', fontSize: 12, color: INK },
  armoryRarity: { fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  armoryDesc: { fontSize: 10, color: INK, textAlign: 'center', opacity: 0.8 },
  refundBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: '#FFF6C2', maxWidth: 536, alignSelf: 'center', width: '94%' },
  refundBannerTitle: { fontWeight: '900', fontSize: 13, color: INK },
  refundBannerSub: { fontSize: 11, color: INK, opacity: 0.8 },
  refundAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 6 },
  refundAllText: { fontWeight: '900', fontSize: 12, color: INK },
  refundChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 4 },
  refundChipText: { fontSize: 11, fontWeight: '800', color: INK },
  arcanaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  arcanaTarot: { width: 56, height: 74, borderRadius: 8, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arcanaNumeral: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK },
  arcanaUpside: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  arcanaTradeoff: { fontSize: 12, fontWeight: '700', color: '#B45309' },
});

export default Camp;
