/**
 * Camp — between fights. Four tabs:
 *   Fighters: each fighter's two passives and their star-bought Skill Tree
 *   Workshop: coin upgrades (Charm Belt, Tarot Deck, Evolution Lab, mechanics, weapons)
 *   Armory:   weapons unlocked so far (equip them into your charm slots)
 *   Arcana:   tarot wildcards that bend the rules (equip into Arcana slots)
 * Every purchase is refundable at 100%.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import type { FighterReactionEvent, FighterReactionType } from '@/utils/fighterAnimations';
import { COLORS, getRarityColor } from '@/utils/colors';
import type { CharacterName, Weapon } from '@/types';
import { sfx } from '@/audio';
import type { AdventureSave, UpgradeDef } from '../types';
import { FIGHTERS } from '../data/fighters';
import { getPassive } from '../data/passives';
import { MAX_WEAPON_UPGRADE_TIER, describeWeaponUpgradeBonus } from '../data/upgrades';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { unlockHint } from '../data/rewards';
import {
  arcanaSlots,
  branchSpent,
  buyUpgrade,
  buyWeaponUpgrade,
  canBuyUpgrade,
  canUpgradeWeapon,
  charmSlots,
  equippedArcanaOf,
  equippedCharms,
  getUnlockedUpgrades,
  refundAllCamp,
  refundUpgrade,
  refundWeaponUpgrade,
  refundableCoins,
  toggleArcana,
  toggleCharm,
  upgradeCost,
  upgradeSpentCoins,
  upgradeTier,
  weaponUpgradeCost,
  weaponUpgradeSpentCoins,
  weaponUpgradeTier,
} from '../progress';
import SkillTree, { StarPool } from './SkillTree';
import { Btn, CoinPill, INK, PopIn, TONE } from './ui';

export type CampTab = 'fighters' | 'workshop' | 'armory' | 'arcana';

interface Props {
  save: AdventureSave;
  onChange: (save: AdventureSave) => void;
  onClose: () => void;
  initialTab?: CampTab;
}

/** The player's Armory, in the order it was won. */
const armoryWeapons = (save: AdventureSave): Weapon[] =>
  save.armory.map(id => getArmoryWeapon(id)).filter((w): w is Weapon => !!w);

/** Workshop items that change the loadout itself, listed first. */
const LOADOUT_UPGRADES = ['charm_belt', 'tarot_deck', 'evolution_lab'];

const Camp: React.FC<Props> = ({ save, onChange, onClose, initialTab = 'fighters' }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CampTab>(initialTab);
  const [treeFighter, setTreeFighter] = useState<CharacterName | null>(null);
  const [reactions, setReactions] = useState<Partial<Record<CharacterName, FighterReactionEvent>>>({});
  const [armoryTapCounts, setArmoryTapCounts] = useState<Record<string, number>>({});
  const [slotsFullNote, setSlotsFullNote] = useState<'charms' | null>(null);
  const reactionSeq = useRef(0);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const fireFighterReaction = (name: CharacterName, type: FighterReactionType) => {
    reactionSeq.current += 1;
    setReactions(prev => ({ ...prev, [name]: { type, id: reactionSeq.current } }));
  };

  const totalRefundable = refundableCoins(save);
  const charms = equippedCharms(save);
  const slots = charmSlots(save);
  const arcana = equippedArcanaOf(save);
  const unlockedUpgrades = getUnlockedUpgrades(save);
  const loadoutUpgrades = unlockedUpgrades.filter(u => LOADOUT_UPGRADES.includes(u.id));
  const mechanicUpgrades = unlockedUpgrades.filter(u => !LOADOUT_UPGRADES.includes(u.id));

  const renderUpgrade = (u: UpgradeDef) => {
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
            {tier > 0 && cost !== null && <Text style={st.nextTier}>Next: {u.description(tier + 1)}</Text>}
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
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => { sfx('back'); onClose(); }} style={st.back} accessibilityLabel="Back to map">
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name="lorc/campfire" size={24} color={COLORS.impactOrange} />
        <Text style={st.title}>CAMP</Text>
        <View style={{ flex: 1 }} />
        <StarPool save={save} testID="camp-stars" />
        <CoinPill coins={save.coins} />
      </View>
      <View style={st.tabs}>
        {(['fighters', 'workshop', 'armory', 'arcana'] as CampTab[]).map(t => (
          <TouchableOpacity
            key={t}
            testID={`camp-tab-${t}`}
            onPress={() => { sfx('click'); setTab(t); setTreeFighter(null); setSlotsFullNote(null); }}
            style={[st.tab, tab === t && st.tabOn]}
          >
            <Text style={[st.tabText, tab === t && { color: INK }]} numberOfLines={1}>
              {t === 'workshop' && !save.workshopUnlocked ? '🔒 WORKSHOP' : t.toUpperCase()}
              {t === 'arcana' && arcana.length > 0 ? ' •' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {totalRefundable > 0 && tab === 'workshop' && save.workshopUnlocked && (
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
        {tab === 'fighters' && treeFighter && (
          <SkillTree save={save} fighter={treeFighter} onChange={onChange} onBack={() => setTreeFighter(null)} />
        )}

        {tab === 'fighters' && !treeFighter && (
          <>
            <Text style={st.blurb}>Every fighter plays by two passives. Spend stars in their skill trees to bend those rules. Refunds are free.</Text>
            {FIGHTERS.map(f => {
              const unlocked = save.unlockedFighters.includes(f.name);
              const selected = save.selectedFighter === f.name;
              const spent = branchSpent(save, f.name, 0) + branchSpent(save, f.name, 1);
              return (
                <View
                  key={f.name}
                  testID={`camp-fighter-${f.name}`}
                  style={[st.fighter, !unlocked && { opacity: 0.55 }, selected && { borderColor: COLORS.deepOnyx, backgroundColor: TONE.selected }]}
                >
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
                      <Text style={st.fighterBlurb}>
                        {unlocked ? f.blurb : `A fighter you have not met yet. ${unlockHint({ kind: 'fighter', id: f.name }) ?? 'Keep winning stars.'}`}
                      </Text>
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
                      <View style={st.passives}>
                        {f.passives.map(id => {
                          const p = getPassive(id);
                          return (
                            <View key={id} style={st.passive} testID={`camp-passive-${id}`}>
                              <Icon name={p.icon} size={18} color={INK} />
                              <View style={{ flex: 1 }}>
                                <Text style={st.passiveName}>{p.name}</Text>
                                <Text style={st.passiveText}>{p.text}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        testID={`camp-open-tree-${f.name}`}
                        onPress={() => { sfx('confirm'); fireFighterReaction(f.name, 'powerup'); setTreeFighter(f.name); }}
                        style={st.treeBtn}
                        activeOpacity={0.85}
                      >
                        <Icon name="lorc/tree-branch" size={16} color={INK} />
                        <Text style={st.treeBtnText}>Skill tree</Text>
                        <Text style={st.treeBtnSub}>{spent > 0 ? `${spent}★ spent` : 'nothing bought yet'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === 'workshop' && (
          !save.workshopUnlocked ? (
            <View testID="camp-workshop-locked" style={st.lockedWorkshop}>
              <View style={st.portrait}><Icon name="lorc/padlock" size={30} color={INK} /></View>
              <Text style={st.fighterName}>Workshop Locked</Text>
              <Text style={[st.fighterBlurb, { textAlign: 'center' }]}>
                {unlockHint({ kind: 'feature', id: 'workshop' })} to unlock the ability to upgrade your unlocked mechanics and Armory weapons!
              </Text>
            </View>
          ) : (
            <>
              <Text style={st.blurb}>
                Upgrade your loadout, any mechanic you have met, and your Armory weapons. Refundable at 100% value anytime.
              </Text>

              {loadoutUpgrades.length > 0 && (
                <>
                  <Text style={st.sectionLabel}>LOADOUT</Text>
                  <Text style={st.slotLine}>Charm slots {slots}/6 · Arcana slots {arcanaSlots(save)}/3</Text>
                  {loadoutUpgrades.map(renderUpgrade)}
                </>
              )}

              <Text style={st.sectionLabel}>MECHANIC UPGRADES</Text>
              {mechanicUpgrades.length === 0 ? (
                <Text style={st.blurb}>Play further in the campaign to unlock mechanics to upgrade.</Text>
              ) : (
                mechanicUpgrades.map(renderUpgrade)
              )}

              <Text style={st.sectionLabel}>WEAPON UPGRADES</Text>
              {save.armory.length === 0 ? (
                <Text style={st.blurb}>Unlock weapons in your Armory to enhance them here.</Text>
              ) : (
                armoryWeapons(save).map(w => {
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
            <Text style={st.blurb}>
              Tap a weapon to equip or remove it. Your charms are your whole weapon loadout. They also show up in level-up picks and shops.
            </Text>
            <View style={st.slotRow} testID="camp-charm-slots">
              {Array.from({ length: slots }).map((_, i) => {
                const w = charms[i] ? getArmoryWeapon(charms[i], save.weaponUpgrades) : undefined;
                return (
                  <View key={i} style={[st.slot, w && { borderColor: getRarityColor(w.rarity), backgroundColor: COLORS.canvasWhite }]}>
                    {w ? <WeaponAvatar weapon={w} size={26} /> : <Text style={st.slotEmpty}>+</Text>}
                  </View>
                );
              })}
              <Text style={st.slotCount}>{charms.length}/{slots}</Text>
            </View>
            {slotsFullNote === 'charms' && (
              <Text testID="camp-charms-full" style={st.fullNote}>All {slots} charm slots are full. Tap an equipped charm to take it off{slots < 6 ? ', or add a slot with the Charm Belt in the Workshop' : ''}.</Text>
            )}
            {save.armory.length === 0 && <Text style={st.blurb}>Nothing here yet. Some stars unlock a weapon.</Text>}
            <View style={st.armory}>
              {armoryWeapons(save).map(w => {
                const equipped = charms.includes(w.id);
                const wTier = weaponUpgradeTier(save, w.id);
                return (
                  <TouchableOpacity
                    key={w.id}
                    testID={`camp-armory-${w.id}`}
                    onPress={() => {
                      setArmoryTapCounts(prev => ({ ...prev, [w.id]: (prev[w.id] ?? 0) + 1 }));
                      if (!equipped && charms.length >= slots) {
                        sfx('back');
                        setSlotsFullNote('charms');
                        return;
                      }
                      sfx('confirm');
                      setSlotsFullNote(null);
                      onChange(toggleCharm(save, w.id));
                    }}
                    activeOpacity={0.85}
                    accessibilityState={{ selected: equipped }}
                    style={[st.armoryItem, { borderColor: equipped ? COLORS.actionYellow : getRarityColor(w.rarity) }, equipped && { backgroundColor: TONE.selected }]}
                  >
                    <WeaponAvatar weapon={w} size={36} triggerKey={armoryTapCounts[w.id]} />
                    <Text style={st.armoryName} numberOfLines={1}>{w.name}{wTier > 0 ? ` +${wTier}` : ''}</Text>
                    <Text style={[st.armoryRarity, { color: getRarityColor(w.rarity) === COLORS.rarityCommon ? TONE.spent : getRarityColor(w.rarity) }]}>{equipped ? 'equipped' : w.rarity}</Text>
                    <Text style={st.armoryDesc} numberOfLines={2}>{getArmoryWeapon(w.id, save.weaponUpgrades)?.shortDescription}</Text>
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
              Equip up to {arcanaSlots(save)} Arcana to twist the rules of a fight ({arcana.length}/{arcanaSlots(save)} equipped). Tap an equipped Arcana again to take it off.
            </Text>
            {ARCANA.map(a => {
              const unlocked = save.unlockedArcana.includes(a.id);
              const equipped = arcana.includes(a.id);
              return (
                <TouchableOpacity
                  key={a.id}
                  testID={`camp-arcana-${a.id}`}
                  disabled={!unlocked}
                  onPress={() => {
                    sfx('confirm');
                    onChange(toggleArcana(save, a.id));
                  }}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: equipped, disabled: !unlocked }}
                  style={[
                    st.arcanaCard,
                    !unlocked && { opacity: 0.6, backgroundColor: '#EFEAE2' },
                    equipped && { borderColor: COLORS.actionYellow, backgroundColor: TONE.selected },
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
                      <Text style={st.fighterBlurb}>Unlock: {unlockHint({ kind: 'arcana', id: a.id })}</Text>
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

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK },
  back: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 18 },
  tabs: { flexDirection: 'row', gap: 6, padding: 10 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 2, borderColor: '#6B5A49', alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  tabText: { fontWeight: '900', color: TONE.onDusk, letterSpacing: 1.5, fontSize: 12 },
  body: { padding: 12, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  blurb: { color: TONE.onDusk, fontSize: 13, textAlign: 'center', marginVertical: 4 },
  fighter: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12, gap: 8 },
  fighterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  fighterName: { fontWeight: '900', fontSize: 16, color: INK },
  fighterBlurb: { fontSize: 12, color: INK, opacity: 0.8 },
  usingTag: { backgroundColor: INK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  usingText: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  passives: { gap: 6 },
  passive: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8 },
  passiveName: { fontWeight: '900', fontSize: 13, color: INK },
  passiveText: { fontSize: 12, color: INK, opacity: 0.85 },
  treeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.actionYellow, borderRadius: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: INK, paddingHorizontal: 10, paddingVertical: 8 },
  treeBtnText: { fontWeight: '900', fontSize: 13, color: INK, letterSpacing: 1, textTransform: 'uppercase' },
  treeBtnSub: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700', color: INK, opacity: 0.75 },
  maxed: { fontWeight: '900', color: COLORS.logicTeal, letterSpacing: 1, fontSize: 12 },
  nextTier: { fontSize: 11, color: TONE.upside, fontWeight: '700' },
  slotLine: { color: TONE.onDusk, fontSize: 12, fontWeight: '700' },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  slot: { width: 40, height: 40, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#6B5A49', alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { color: '#6B5A49', fontWeight: '900', fontSize: 18 },
  slotCount: { color: TONE.onDusk, fontWeight: '900', marginLeft: 4 },
  fullNote: { color: COLORS.actionYellow, fontSize: 12, fontWeight: '700', textAlign: 'center' },
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
  refundBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: TONE.coinPale, maxWidth: 536, alignSelf: 'center', width: '94%' },
  refundBannerTitle: { fontWeight: '900', fontSize: 13, color: INK },
  refundBannerSub: { fontSize: 11, color: INK, opacity: 0.8 },
  refundAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 6 },
  refundAllText: { fontWeight: '900', fontSize: 12, color: INK },
  refundChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.canvasWhite, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 4 },
  refundChipText: { fontSize: 11, fontWeight: '800', color: INK },
  arcanaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 12 },
  arcanaTarot: { width: 56, height: 74, borderRadius: 8, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arcanaNumeral: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK },
  arcanaUpside: { fontSize: 12, fontWeight: '800', color: TONE.upside },
  arcanaTradeoff: { fontSize: 12, fontWeight: '700', color: TONE.tradeoff },
});

export default Camp;
