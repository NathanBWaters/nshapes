/**
 * Camp — between fights. It opens on a menu of its sections; each section's
 * back button returns to the menu:
 *   Fighters: each fighter's two passives and their star-bought Skill Tree
 *   Armory:   weapons unlocked so far (equip them into your charm slots)
 *   Arcana:   tarot wildcards that bend the rules (equip into Arcana slots)
 *   Workshop: coin upgrades (Charm Belt, Tarot Deck, Evolution Lab, mechanics, weapon tuning)
 *   Bounties: cross-run milestones (BountyBoard.tsx)
 *   History:  every battle fought, with its damage per minute (BattleHistory.tsx)
 * The menu also holds the sound and effects switches.
 * Every purchase is refundable at 100%.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import type { FighterReactionEvent, FighterReactionType } from '@/utils/fighterAnimations';
import { COLORS } from '@/utils/colors';
import type { CharacterName, Weapon } from '@/types';
import { band, sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AdventureSave, UpgradeDef } from '../types';
import { BOUNTIES } from '../data/bounties';
import { summarize, type BattleRecord } from '../history';
import { FIGHTERS } from '../data/fighters';
import { getPassive } from '../data/passives';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, TUNING_MULTIPLIERS, formatStat, weaponStatLines } from '../data/weaponStats';
import { ARCANA } from '../data/arcana';
import { charmWeapons, getArmoryWeapon, weaponLevelSuffix } from '../data/armory';
import { WEAPON_ROLES, weaponRole } from '../data/weaponRoles';
import { unlockHint } from '../data/rewards';
import {
  arcanaSlots,
  availableStars,
  fighterStarsSpent,
  buyTuning,
  buyUpgrade,
  canBuyUpgrade,
  canTune,
  charmSlots,
  equippedArcanaOf,
  equippedCharms,
  getUnlockedUpgrades,
  hasUnspentStars,
  refundAllCamp,
  refundTuning,
  refundUpgrade,
  refundableCoins,
  toggleArcana,
  toggleCharm,
  upgradeCost,
  upgradeSpentCoins,
  upgradeTier,
  tuningCost,
  tuningSpent,
  weaponBuild,
  weaponBuilds,
  weaponLevel,
  weaponLevelsInWorld,
} from '../progress';
import SkillTree, { StarPool } from './SkillTree';
import BattleHistory from './BattleHistory';
import BountyBoard from './BountyBoard';
import { Btn, CoinPill, INK, PopIn, TONE } from './ui';

export type CampTab = 'fighters' | 'armory' | 'arcana' | 'workshop' | 'bounties' | 'history';

/** The sections of Camp, in menu order. */
const SECTIONS: { id: CampTab; title: string; icon: IconName }[] = [
  { id: 'fighters', title: 'Fighters', icon: 'lorc/tree-branch' },
  { id: 'armory', title: 'Armory', icon: 'lorc/gems' },
  { id: 'arcana', title: 'Arcana', icon: 'lorc/crystal-wand' },
  { id: 'workshop', title: 'Workshop', icon: 'lorc/gear-hammer' },
  { id: 'bounties', title: 'Bounties', icon: 'lorc/trophy' },
  { id: 'history', title: 'History', icon: 'delapouite/scroll-quill' },
];

/** How one section reads on the menu. */
interface SectionStatus {
  sub: string;
  /** Not open yet: `sub` says how to open it */
  locked?: boolean;
  /** Something here wants attention */
  badge?: boolean;
}

interface Props {
  save: AdventureSave;
  /** Every battle fought, oldest first */
  history?: readonly BattleRecord[];
  onChange: (save: AdventureSave) => void;
  onClose: () => void;
  /** Open straight on this section (its back button still leads to the menu) */
  initialTab?: CampTab;
}

const NO_BATTLES: readonly BattleRecord[] = [];

/** The player's Armory, in the order it was won. */
const armoryWeapons = (save: AdventureSave): Weapon[] =>
  save.armory.map(id => getArmoryWeapon(id)).filter((w): w is Weapon => !!w);

/** Workshop items that change the loadout itself, listed first. */
const LOADOUT_UPGRADES = ['charm_belt', 'tarot_deck', 'evolution_lab'];

const Camp: React.FC<Props> = ({ save, history = NO_BATTLES, onChange, onClose, initialTab }) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  /** The open section; null is the menu */
  const [tab, setTab] = useState<CampTab | null>(initialTab ?? null);
  const [treeFighter, setTreeFighter] = useState<CharacterName | null>(null);
  const [reactions, setReactions] = useState<Partial<Record<CharacterName, FighterReactionEvent>>>({});
  const [armoryTapCounts, setArmoryTapCounts] = useState<Record<string, number>>({});
  const [slotsFullNote, setSlotsFullNote] = useState<'charms' | null>(null);
  const reactionSeq = useRef(0);

  useEffect(() => {
    setTab(initialTab ?? null);
  }, [initialTab]);

  const open = (next: CampTab | null) => {
    setTab(next);
    setTreeFighter(null);
    setSlotsFullNote(null);
  };

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

  const battles = summarize(history);
  const statusOf = (id: CampTab): SectionStatus => {
    switch (id) {
      case 'fighters':
        return { sub: `${save.selectedFighter} · ${availableStars(save, save.selectedFighter)}★ to spend on skills`, badge: hasUnspentStars(save) };
      case 'armory':
        return { sub: save.armory.length === 0 ? 'No weapons yet. Some stars unlock one.' : `${charms.length}/${slots} charms equipped · ${save.armory.length} weapons` };
      case 'arcana':
        return { sub: save.unlockedArcana.length === 0 ? 'None found yet' : `${arcana.length}/${arcanaSlots(save)} equipped · ${save.unlockedArcana.length} found` };
      case 'workshop':
        return save.workshopUnlocked
          ? { sub: totalRefundable > 0 ? `Upgrades and weapon tuning · ${totalRefundable}¢ invested` : 'Upgrades and weapon tuning' }
          : { sub: `${unlockHint({ kind: 'feature', id: 'workshop' }, save) ?? 'Keep playing'} to open`, locked: true };
      case 'bounties':
        return save.bountiesUnlocked
          ? {
              sub: `${save.completedBounties.length}/${BOUNTIES.length} claimed`,
              badge: BOUNTIES.some(b => !save.completedBounties.includes(b.id) && b.progress(save) / b.target >= 0.75),
            }
          : { sub: `${unlockHint({ kind: 'feature', id: 'bounties' }, save) ?? 'Keep playing'} to open`, locked: true };
      case 'history':
        return { sub: battles.battles === 0 ? 'No battles yet' : `${battles.battles} ${battles.battles === 1 ? 'battle' : 'battles'} · best ${battles.bestDpm.toLocaleString()} damage / min` };
    }
  };

  // Bounties bring their own screen; its back button returns to the menu
  if (tab === 'bounties') return <BountyBoard save={save} onClose={() => open(null)} backLabel="Back to camp" />;

  const section = SECTIONS.find(x => x.id === tab);
  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.top}>
        <TouchableOpacity
          onPress={() => { sfx('back'); if (tab) open(null); else onClose(); }}
          style={st.back}
          accessibilityLabel={tab ? 'Back to camp' : 'Back to map'}
        >
          <Icon name="lorc/return-arrow" size={20} color={INK} />
        </TouchableOpacity>
        <Icon name={section?.icon ?? 'lorc/campfire'} size={24} color={section ? INK : COLORS.impactOrange} />
        <Text style={st.title} numberOfLines={1}>{(section?.title ?? 'Camp').toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        {/* Only what this page spends: stars on fighters, coins everywhere else */}
        {tab === 'fighters' ? <StarPool save={save} testID="camp-stars" /> : <CoinPill coins={save.coins} />}
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
        {tab === null && (
          <>
            {SECTIONS.map(x => {
              const status = statusOf(x.id);
              return (
                <TouchableOpacity
                  key={x.id}
                  testID={`camp-tab-${x.id}`}
                  disabled={status.locked}
                  onPress={() => { sfx('click'); open(x.id); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.title}: ${status.sub}`}
                  accessibilityState={{ disabled: !!status.locked }}
                  style={[st.menuRow, status.locked && st.menuRowLocked]}
                >
                  <View style={st.menuIcon}>
                    <Icon name={status.locked ? 'lorc/padlock' : x.icon} size={28} color={INK} />
                    {status.badge && <View style={st.menuBadge} testID={`camp-badge-${x.id}`} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.menuTitle}>{x.title}</Text>
                    <Text style={st.menuSub} numberOfLines={2}>{status.sub}</Text>
                  </View>
                  {!status.locked && <Text style={st.menuChevron}>›</Text>}
                </TouchableOpacity>
              );
            })}

            <Text style={st.sectionLabel}>SETTINGS</Text>
            <View style={st.settings}>
              <Btn
                testID="camp-toggle-sound"
                small
                variant="secondary"
                icon="delapouite/sound-on"
                label={save.musicOn ? 'Sound: on' : 'Sound: off'}
                onPress={() => onChange({ ...save, musicOn: !save.musicOn })}
                style={{ flex: 1 }}
              />
              {/* A device that asks for reduced motion keeps effects off */}
              {!reducedMotion && (
                <Btn
                  testID="camp-toggle-effects"
                  small
                  variant="secondary"
                  icon="lorc/bright-explosion"
                  label={save.effectsOn ? 'Effects: on' : 'Effects: off'}
                  onPress={() => { sfx('click'); onChange({ ...save, effectsOn: !save.effectsOn }); }}
                  style={{ flex: 1 }}
                />
              )}
            </View>
            {!reducedMotion && (
              <Text style={st.blurb}>
                {save.effectsOn ? 'Effects on: the fight clock waits while they play.' : 'Effects off: numbers only, and the clock never waits.'}
              </Text>
            )}
          </>
        )}

        {tab === 'history' && <BattleHistory history={history} />}

        {tab === 'fighters' && treeFighter && (
          <SkillTree save={save} fighter={treeFighter} onChange={onChange} onBack={() => setTreeFighter(null)} />
        )}

        {tab === 'fighters' && !treeFighter && (
          <>
            <Text style={st.blurb}>Every fighter plays by two passives. Spend stars in their skill trees to bend those rules. Every fighter can spend every star you have earned, so grow them all at once. Refunds are free.</Text>
            {FIGHTERS.map(f => {
              const unlocked = save.unlockedFighters.includes(f.name);
              const selected = save.selectedFighter === f.name;
              const spent = fighterStarsSpent(save, f.name);
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
                        {unlocked ? f.blurb : `A fighter you have not met yet. ${unlockHint({ kind: 'fighter', id: f.name }, save) ?? 'Keep winning stars.'}`}
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
                        <Text style={st.treeBtnSub}>{`${availableStars(save, f.name)}★ left`}{spent > 0 ? ` · ${spent}★ spent` : ''}</Text>
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
                {unlockHint({ kind: 'feature', id: 'workshop' }, save)} to unlock the ability to upgrade your unlocked mechanics and tune your Armory weapons!
              </Text>
            </View>
          ) : (
            <>
              <Text style={st.blurb}>
                Upgrade your loadout, any mechanic you have met, and tune your Armory weapons. Refundable at 100% value anytime.
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

              <Text style={st.sectionLabel}>WEAPON TUNING</Text>
              <Text style={st.blurb}>
                Weapons level up when you find them again in the world (repeat star and bounty rewards): every number gets a flat boost. Tuning multiplies one number on top.
              </Text>
              {save.armory.length === 0 ? (
                <Text style={st.blurb}>Unlock weapons in your Armory to tune them here.</Text>
              ) : (
                armoryWeapons(save).map(base => {
                  const build = weaponBuild(save, base.id);
                  const w = getArmoryWeapon(base.id, { [base.id]: build }) ?? base;
                  const level = weaponLevel(save, base.id);
                  const inWorld = weaponLevelsInWorld(base.id);
                  const spent = tuningSpent(save, base.id);
                  return (
                    <PopIn key={base.id} style={[st.upgrade, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <View testID={`camp-weapon-upgrade-${base.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={st.portrait}>
                          <WeaponAvatar weapon={w} size={34} interactive />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={st.fighterName}>{w.name} · Lv {level}</Text>
                          <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={`Level ${level} of ${MAX_WEAPON_LEVEL}`}>
                            {Array.from({ length: MAX_WEAPON_LEVEL }).map((_, i) => (
                              <View key={i} style={[st.tierPip, i < level && st.tierPipOn, i >= inWorld && st.tierPipAbsent]} />
                            ))}
                          </View>
                          <Text style={st.fighterBlurb}>
                            {level < inWorld
                              ? `${inWorld - level} more ${inWorld - level === 1 ? 'copy' : 'copies'} to find in the world`
                              : 'Every copy in the world found'}
                          </Text>
                        </View>
                        {spent > 0 && (
                          <TouchableOpacity
                            testID={`camp-refund-weapon-${base.id}`}
                            onPress={() => { sfx('coin'); onChange(refundTuning(save, base.id)); }}
                            style={st.refundChip}
                            activeOpacity={0.85}
                          >
                            <Icon name="lorc/recycle" size={12} color={INK} />
                            <Text style={st.refundChipText}>+{spent}¢</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {weaponStatLines(base, build).map(line => {
                        const cost = tuningCost(save, base.id, line.key);
                        return (
                          <View key={line.key} style={st.tuneRow} testID={`camp-tune-row-${base.id}-${line.key}`}>
                            <View style={{ flex: 1 }}>
                              <Text style={st.tuneLabel}>{line.label}</Text>
                              <Text style={st.tuneValue}>
                                {formatStat(line.unit, line.value)}
                                {line.tier > 0 ? <Text style={st.tuneMath}>  ({formatStat(line.unit, line.levelled)} ×{line.multiplier})</Text> : null}
                              </Text>
                            </View>
                            {line.tunable ? (
                              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {Array.from({ length: MAX_TUNING_TIER }).map((_, i) => (
                                    <View key={i} style={[st.tunePip, i < line.tier && st.tierPipOn]} />
                                  ))}
                                </View>
                                {cost !== null ? (
                                  <Btn
                                    small
                                    testID={`camp-tune-${base.id}-${line.key}`}
                                    label={`×${TUNING_MULTIPLIERS[line.tier + 1]} · ${cost}¢`}
                                    disabled={!canTune(save, base.id, line.key)}
                                    onPress={() => { sfx('unlock'); onChange(buyTuning(save, base.id, line.key)); }}
                                  />
                                ) : (
                                  <Text style={st.maxed}>MAX</Text>
                                )}
                              </View>
                            ) : (
                              <Text style={st.tuneMath}>levels only</Text>
                            )}
                          </View>
                        );
                      })}
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
              Tap a weapon to equip or remove it. Your charms are your whole weapon loadout, in the order you equip them. They also show up in level-up picks and shops.
            </Text>
            <View style={st.slotRow} testID="camp-charm-slots">
              {Array.from({ length: slots }).map((_, i) => {
                const w = charms[i] ? getArmoryWeapon(charms[i], weaponBuilds(save)) : undefined;
                return (
                  <View key={i} style={st.slotWrap}>
                    <View style={[st.slot, w && { borderColor: INK, backgroundColor: COLORS.canvasWhite }]}>
                      {w ? <WeaponAvatar weapon={w} size={26} /> : <Text style={st.slotEmpty}>+</Text>}
                    </View>
                    <Text style={st.slotNo}>{i + 1}</Text>
                  </View>
                );
              })}
              <Text style={st.slotCount}>{charms.length}/{slots}</Text>
            </View>
            {slotsFullNote === 'charms' && (
              <Text testID="camp-charms-full" style={st.fullNote}>All {slots} charm slots are full. Tap an equipped charm to take it off{slots < 6 ? ', or add a slot with the Charm Belt in the Workshop' : ''}.</Text>
            )}
            {save.armory.length === 0 && <Text style={st.blurb}>Nothing here yet. Some stars unlock a weapon.</Text>}
            {WEAPON_ROLES.map(role => {
              const shelf = armoryWeapons(save).filter(w => weaponRole(w.id) === role.id);
              if (shelf.length === 0) return null;
              return (
            <View key={role.id} testID={`camp-armory-shelf-${role.id}`} style={st.shelf}>
            <View style={st.shelfHead}>
              <Text style={st.shelfTitle}>{role.label}</Text>
              <Text style={st.shelfBlurb}>{role.blurb}</Text>
            </View>
            <View style={st.armory}>
              {shelf.map(w => {
                const slot = charms.indexOf(w.id);
                const equipped = slot >= 0;
                const wLevel = weaponLevel(save, w.id);
                // Equipped weapons read as they will in the fight (an Understudy shows what it copies)
                const shown = equipped ? charmWeapons(charms, weaponBuilds(save))[slot] : getArmoryWeapon(w.id, weaponBuilds(save));
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
                      // Every weapon has a voice in the band: tapping it plays its riff
                      band.audition(w.id);
                      setSlotsFullNote(null);
                      onChange(toggleCharm(save, w.id));
                    }}
                    activeOpacity={0.85}
                    accessibilityState={{ selected: equipped }}
                    style={[st.armoryItem, { borderColor: equipped ? COLORS.actionYellow : TONE.spentEdge }, equipped && { backgroundColor: TONE.selected }]}
                  >
                    <WeaponAvatar weapon={w} size={36} triggerKey={armoryTapCounts[w.id]} />
                    <Text style={st.armoryName} numberOfLines={1}>{w.name}{weaponLevelSuffix(wLevel)}</Text>
                    <Text style={[st.armoryRarity, { color: TONE.spent }]}>{equipped ? `slot ${slot + 1}` : `level ${wLevel}`}</Text>
                    <Text style={st.armoryDesc} numberOfLines={3}>{shown?.shortDescription}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </View>
              );
            })}
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
                      <Text style={st.fighterBlurb}>Unlock: {unlockHint({ kind: 'arcana', id: a.id }, save)}</Text>
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
  title: { fontWeight: '900', letterSpacing: 2, color: INK, fontSize: 18, flexShrink: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, paddingVertical: 10, paddingHorizontal: 12 },
  menuRowLocked: { backgroundColor: '#E9E4DC', borderColor: '#8E877D', opacity: 0.8 },
  menuIcon: { width: 50, height: 50, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  menuBadge: { position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.impactRed, borderWidth: 2, borderColor: COLORS.canvasWhite },
  menuTitle: { fontWeight: '900', fontSize: 17, color: INK, letterSpacing: 1, textTransform: 'uppercase' },
  menuSub: { fontSize: 12, color: INK, opacity: 0.8 },
  menuChevron: { fontSize: 26, fontWeight: '900', color: INK, opacity: 0.5 },
  settings: { flexDirection: 'row', gap: 8 },
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
  shelf: { gap: 6, marginTop: 14 },
  shelfHead: { alignItems: 'center', gap: 1 },
  shelfTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.actionYellow },
  shelfBlurb: { fontSize: 11, color: TONE.onDusk, opacity: 0.85, textAlign: 'center' },
  slotWrap: { alignItems: 'center', gap: 1 },
  slotNo: { fontSize: 9, fontWeight: '900', color: INK, opacity: 0.6 },
  armoryItem: { width: 120, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 2.5, padding: 8, alignItems: 'center', gap: 2 },
  armoryName: { fontWeight: '900', fontSize: 12, color: INK },
  tuneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#E2DBCF', paddingTop: 6, marginTop: 6 },
  tuneLabel: { fontSize: 11, fontWeight: '800', color: INK },
  tuneValue: { fontSize: 14, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  tuneMath: { fontSize: 10, fontWeight: '700', color: TONE.spent },
  tunePip: { width: 8, height: 5, borderRadius: 2, backgroundColor: '#D8D0C4' },
  tierPipAbsent: { opacity: 0.25 },
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
