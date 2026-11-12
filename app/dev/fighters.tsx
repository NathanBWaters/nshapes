import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EnemyAvatar } from '@/components/enemies';
import { ALL_CUSTOM_ENEMY_RIG_NAMES } from '@/components/enemies/rigs';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { WeaponRarity } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import {
  ENEMY_AMBIENT_MOODS,
  ENEMY_REACTION_TYPES,
  EnemyAmbientMood,
  EnemyReactionEvent,
  EnemyReactionType,
  getEnemyHealthState,
} from '@/utils/enemyAnimations';
import {
  FIGHTER_AMBIENT_MOODS,
  FIGHTER_REACTION_TYPES,
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
} from '@/utils/fighterAnimations';
import { CHARACTERS, WEAPONS } from '@/utils/gameDefinitions';

type StudioTab = 'fighters' | 'enemies' | 'weapons';

const FIGHTER_MOODS = FIGHTER_AMBIENT_MOODS;

const FIGHTER_REACTION_LABELS: Record<FighterReactionType, string> = {
  joy: 'Match Joy',
  ecstatic: 'Mega / 3x Streak',
  pain: 'Mistake Pain',
  relief: 'Grace Phew!',
  heal: 'Heal +♥',
  powerup: 'Level Up!',
  hint: 'Hint Aha!',
  pet: 'Pet Blush',
  dizzy_joy: '5x Zoomie!',
  entrance: 'Salute',
};

const FIGHTER_REACTIONS = FIGHTER_REACTION_TYPES.map((type) => ({ type, label: FIGHTER_REACTION_LABELS[type] }));

// 'defeat' is reached through the 0/4 KO preset, not offered as a mood chip.
const ENEMY_MOODS = ENEMY_AMBIENT_MOODS.filter((m) => m !== 'defeat');

const ENEMY_REACTION_LABELS: Record<EnemyReactionType, string> = {
  pain: 'Set Hit!',
  crit_pain: 'Rainbow Crit!',
  taunt: 'Mistake Gloat',
  attack: 'Ability Attack!',
  regen: 'Regen +HP',
  poke: 'Tap Poke',
  rage_spin: '5x Rage!',
  entrance: 'Stomp In',
};

const ENEMY_REACTIONS = ENEMY_REACTION_TYPES.map((type) => ({ type, label: ENEMY_REACTION_LABELS[type] }));

const HP_PRESETS: { label: string; health: number; maxHealth: number }[] = [
  { label: '4/4 Pristine', health: 4, maxHealth: 4 },
  { label: '3/4 Scuffed', health: 3, maxHealth: 4 },
  { label: '2/4 Battered', health: 2, maxHealth: 4 },
  { label: '1/4 Critical', health: 1, maxHealth: 4 },
  { label: '0/4 KO', health: 0, maxHealth: 4 },
];

const RARITIES: WeaponRarity[] = ['common', 'rare', 'epic', 'legendary'];

export default function DevFightersPage() {
  const [tab, setTab] = useState<StudioTab>('fighters');
  const [hpPresetIndex, setHpPresetIndex] = useState(0);
  const [fighterMood, setFighterMood] = useState<FighterAmbientMood>('idle');
  const [fighterReaction, setFighterReaction] = useState<FighterReactionEvent | null>(null);
  const [enemyMood, setEnemyMood] = useState<EnemyAmbientMood>('menacing');
  const [enemyReaction, setEnemyReaction] = useState<EnemyReactionEvent | null>(null);
  const [enemyPage, setEnemyPage] = useState(0);
  const [weaponRarity, setWeaponRarity] = useState<WeaponRarity | 'default'>('default');
  const [autoCycle, setAutoCycle] = useState(false);

  const reactionIdRef = useRef(0);
  const stepRef = useRef(0);

  const hp = HP_PRESETS[hpPresetIndex];
  const healthState =
    tab === 'enemies'
      ? getEnemyHealthState(hp.health, hp.maxHealth)
      : getFighterHealthState(hp.health, hp.maxHealth);

  const uniqueWeapons = useMemo(() => {
    const map = new Map<string, (typeof WEAPONS)[number]>();
    for (const w of WEAPONS) {
      if (!map.has(w.name)) map.set(w.name, w);
    }
    return Array.from(map.values());
  }, []);

  const ENEMIES_PER_PAGE = 18;
  const enemyPageCount = Math.ceil(ALL_CUSTOM_ENEMY_RIG_NAMES.length / ENEMIES_PER_PAGE);
  const visibleEnemies = useMemo(
    () =>
      ALL_CUSTOM_ENEMY_RIG_NAMES.slice(
        enemyPage * ENEMIES_PER_PAGE,
        (enemyPage + 1) * ENEMIES_PER_PAGE
      ),
    [enemyPage]
  );

  const triggerFighter = (type: FighterReactionType) => {
    reactionIdRef.current += 1;
    setFighterReaction({ type, id: reactionIdRef.current });
  };

  const triggerEnemy = (type: EnemyReactionType) => {
    reactionIdRef.current += 1;
    setEnemyReaction({ type, id: reactionIdRef.current });
  };

  useEffect(() => {
    if (!autoCycle) return;
    const iv = setInterval(() => {
      const idx = stepRef.current;
      stepRef.current += 1;
      if (tab === 'fighters') {
        const sequence: {
          mood: FighterAmbientMood;
          hpIdx: number;
          reaction?: FighterReactionType;
        }[] = [
          { mood: 'idle', hpIdx: 0 },
          { mood: 'curious', hpIdx: 0 },
          { mood: 'anticipation', hpIdx: 0 },
          { mood: 'streak', hpIdx: 0, reaction: 'joy' },
          { mood: 'streak', hpIdx: 0, reaction: 'ecstatic' },
          { mood: 'urgent', hpIdx: 1, reaction: 'pain' },
          { mood: 'idle', hpIdx: 2, reaction: 'relief' },
          { mood: 'urgent', hpIdx: 3, reaction: 'heal' },
          { mood: 'sleepy', hpIdx: 0 },
          { mood: 'victory', hpIdx: 0, reaction: 'powerup' },
        ];
        const next = sequence[idx % sequence.length];
        setFighterMood(next.mood);
        setHpPresetIndex(next.hpIdx);
        if (next.reaction) triggerFighter(next.reaction);
      } else if (tab === 'enemies') {
        const sequence: {
          mood: EnemyAmbientMood;
          hpIdx: number;
          reaction?: EnemyReactionType;
        }[] = [
          { mood: 'menacing', hpIdx: 0, reaction: 'entrance' },
          { mood: 'menacing', hpIdx: 1, reaction: 'pain' },
          { mood: 'enraged', hpIdx: 1, reaction: 'attack' },
          { mood: 'victory', hpIdx: 1, reaction: 'taunt' },
          { mood: 'cornered', hpIdx: 2, reaction: 'crit_pain' },
          { mood: 'cornered', hpIdx: 3, reaction: 'regen' },
          { mood: 'sleepy', hpIdx: 0 },
          { mood: 'cornered', hpIdx: 4 },
        ];
        const next = sequence[idx % sequence.length];
        setEnemyMood(next.mood);
        setHpPresetIndex(next.hpIdx);
        if (next.reaction) triggerEnemy(next.reaction);
      }
    }, 1150);
    return () => clearInterval(iv);
  }, [autoCycle, tab]);

  return (
    <View style={styles.container}>
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>ANIMATION & RELIC STUDIO</Text>
        <View style={styles.eyebrowRight}>
          {tab !== 'weapons' && (
            <>
              <TouchableOpacity
                style={[styles.autoBtn, autoCycle && styles.autoBtnActive]}
                onPress={() => setAutoCycle((v) => !v)}
              >
                <Text style={[styles.autoBtnText, autoCycle && styles.chipTextActive]}>
                  {autoCycle ? '■ Stop Flow' : '▶ Auto-Flow'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.statePill}>{healthState.toUpperCase()}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.tabRow}>
        {(
          [
            { id: 'fighters', label: `Fighters (${CHARACTERS.length})` },
            { id: 'enemies', label: `Enemies (${ALL_CUSTOM_ENEMY_RIG_NAMES.length})` },
            { id: 'weapons', label: `Weapons (${uniqueWeapons.length})` },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => {
              setAutoCycle(false);
              setTab(t.id);
            }}
          >
            <Text style={[styles.tabBtnText, tab === t.id && styles.chipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === 'fighters' && (
          <>
            <View style={styles.grid}>
              {CHARACTERS.map((char) => (
                <View key={char.name} style={styles.fighterCard}>
                  <FighterAvatar
                    character={char}
                    size={96}
                    health={hp.health}
                    maxHealth={hp.maxHealth}
                    mood={fighterMood}
                    reaction={fighterReaction}
                    streak={fighterMood === 'streak' ? 4 : 0}
                    framed
                    interactive
                  />
                  <Text style={styles.fighterName}>{char.name}</Text>
                  <Text style={styles.petHint}>Tap 1x or 5x to pet!</Text>
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>1. HEALTH & PROGRESSIVE WEAR-AND-TEAR</Text>
              <View style={styles.chipRow}>
                {HP_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.chip, hpPresetIndex === idx && styles.chipActive]}
                    onPress={() => setHpPresetIndex(idx)}
                  >
                    <Text style={[styles.chipText, hpPresetIndex === idx && styles.chipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>2. ONE-SHOT REACTIONS</Text>
              <View style={styles.chipRow}>
                {FIGHTER_REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.type}
                    style={styles.reactionBtn}
                    onPress={() => triggerFighter(r.type)}
                  >
                    <Text style={styles.reactionBtnText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>3. CONTINUOUS AMBIENT MOODS</Text>
              <View style={styles.chipRow}>
                {FIGHTER_MOODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, fighterMood === m && styles.chipActive]}
                    onPress={() => setFighterMood(m)}
                  >
                    <Text style={[styles.chipText, fighterMood === m && styles.chipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {tab === 'enemies' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                ENEMY ROSTER PAGE {enemyPage + 1} / {enemyPageCount}
              </Text>
              <View style={styles.chipRow}>
                {Array.from({ length: enemyPageCount }).map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.chip, enemyPage === idx && styles.chipActive]}
                    onPress={() => setEnemyPage(idx)}
                  >
                    <Text style={[styles.chipText, enemyPage === idx && styles.chipTextActive]}>
                      Group {idx + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.grid}>
              {visibleEnemies.map((enemyName) => (
                <View key={enemyName} style={styles.fighterCard}>
                  <EnemyAvatar
                    enemy={enemyName}
                    size={82}
                    hp={hp.health}
                    maxHp={hp.maxHealth}
                    mood={enemyMood}
                    reaction={enemyReaction}
                    framed
                    interactive
                  />
                  <Text style={styles.fighterName}>{enemyName}</Text>
                  <Text style={styles.petHint}>Tap 1x or 5x to poke!</Text>
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>1. HEALTH & PROGRESSIVE WEAR-AND-TEAR</Text>
              <View style={styles.chipRow}>
                {HP_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.chip, hpPresetIndex === idx && styles.chipActive]}
                    onPress={() => setHpPresetIndex(idx)}
                  >
                    <Text style={[styles.chipText, hpPresetIndex === idx && styles.chipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>2. COMBAT REACTIONS</Text>
              <View style={styles.chipRow}>
                {ENEMY_REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.type}
                    style={styles.reactionBtn}
                    onPress={() => triggerEnemy(r.type)}
                  >
                    <Text style={styles.reactionBtnText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>3. CONTINUOUS AMBIENT MOODS</Text>
              <View style={styles.chipRow}>
                {ENEMY_MOODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, enemyMood === m && styles.chipActive]}
                    onPress={() => setEnemyMood(m)}
                  >
                    <Text style={[styles.chipText, enemyMood === m && styles.chipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {tab === 'weapons' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                TAP ANY WEAPON RELIC FOR ITS SINGLE SIGNATURE ANIMATION (STATIC AT REST)
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, weaponRarity === 'default' && styles.chipActive]}
                  onPress={() => setWeaponRarity('default')}
                >
                  <Text
                    style={[styles.chipText, weaponRarity === 'default' && styles.chipTextActive]}
                  >
                    Base Rarity
                  </Text>
                </TouchableOpacity>
                {RARITIES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, weaponRarity === r && styles.chipActive]}
                    onPress={() => setWeaponRarity(r)}
                  >
                    <Text style={[styles.chipText, weaponRarity === r && styles.chipTextActive]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.grid}>
              {uniqueWeapons.map((w) => {
                const displayRarity = weaponRarity === 'default' ? w.rarity : weaponRarity;
                return (
                  <View
                    key={w.name}
                    style={[
                      styles.weaponCard,
                      { borderColor: getRarityColor(displayRarity) },
                    ]}
                  >
                    <WeaponAvatar
                      weapon={w}
                      rarity={displayRarity}
                      size={56}
                      interactive
                    />
                    <Text style={styles.fighterName} numberOfLines={2}>
                      {w.name}
                    </Text>
                    <Text style={styles.petHint}>Tap to animate</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 48,
    backgroundColor: COLORS.actionYellow,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 1.4,
  },
  eyebrowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.slateCharcoal,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: COLORS.logicTeal,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  autoBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
  },
  autoBtnActive: {
    backgroundColor: COLORS.logicTeal,
  },
  autoBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  statePill: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.canvasWhite,
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  fighterCard: {
    width: '30%',
    minWidth: 112,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  weaponCard: {
    width: '28%',
    minWidth: 100,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  fighterName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  petHint: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
  },
  panel: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 8,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
  },
  chipActive: {
    backgroundColor: COLORS.logicTeal,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  chipTextActive: {
    color: COLORS.canvasWhite,
  },
  reactionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.actionYellow,
  },
  reactionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
});
