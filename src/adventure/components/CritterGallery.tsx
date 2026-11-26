/**
 * [TP-14] Interactive Critter Gallery & Animation Studio (`CritterGallery`).
 *
 * Powers BOTH:
 *  - `mode="gallery"` inside `FieldGuide.tsx`'s "Critters" tab: unlocked Fighters
 *    and defeated Foes (undefeated foes silhouetted via `Silhouette`), allowing
 *    players to pet/poke rigs, preview battle-worn HP expressions, trigger
 *    reactions, and inspect each foe's taunt, world, ability, and Counter-Parry
 *    rule (formatted with v0.1.173 Circle/Triangle/Bolt × Orange/Blue/Pink copy).
 *  - `mode="studio"` inside `app/dev/fighters.tsx`: thin unlocked-all dev wrapper
 *    exposing all 6 Fighters, all `ALL_CUSTOM_ENEMY_RIG_NAMES`, and all Weapons.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EnemyAvatar } from '@/components/enemies';
import { ALL_CUSTOM_ENEMY_RIG_NAMES } from '@/components/enemies/rigs';
import { FighterAvatar } from '@/components/fighters';
import Icon, { type IconName } from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import type { CharacterName, WeaponRarity } from '@/types';
import { formatParryCounterMeta } from '@/utils/cardVisuals';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import {
  ENEMY_AMBIENT_MOODS,
  ENEMY_REACTION_TYPES,
  type EnemyAmbientMood,
  type EnemyReactionEvent,
  type EnemyReactionType,
  getEnemyHealthState,
} from '@/utils/enemyAnimations';
import {
  FIGHTER_AMBIENT_MOODS,
  FIGHTER_REACTION_TYPES,
  type FighterAmbientMood,
  type FighterReactionEvent,
  type FighterReactionType,
  getFighterHealthState,
} from '@/utils/fighterAnimations';
import { CHARACTERS, WEAPONS } from '@/utils/gameDefinitions';
import { registerInterval } from '@/utils/perfWatchdog';
import { getBiome } from '../data/biomes';
import { FIGHTERS } from '../data/fighters';
import { foeDisplay } from '../data/foes';
import { LEVELS } from '../data/levels';
import { resolveParrySpec } from '../data/parry';
import { getPassive } from '../data/passives';
import { unlockHint } from '../data/rewards';
import type { AdventureSave, ParrySpec } from '../types';
import { Silhouette } from './rewards';
import { INK, TONE } from './ui';

type StudioTab = 'fighters' | 'enemies' | 'weapons';
type GallerySubTab = 'fighters' | 'foes';

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

const FIGHTER_REACTIONS = FIGHTER_REACTION_TYPES.map(type => ({
  type,
  label: FIGHTER_REACTION_LABELS[type],
}));

const ENEMY_MOODS = ENEMY_AMBIENT_MOODS.filter(m => m !== 'defeat');

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

const ENEMY_REACTIONS = ENEMY_REACTION_TYPES.map(type => ({
  type,
  label: ENEMY_REACTION_LABELS[type],
}));

const HP_PRESETS: { label: string; health: number; maxHealth: number }[] = [
  { label: '4/4 Pristine', health: 4, maxHealth: 4 },
  { label: '3/4 Scuffed', health: 3, maxHealth: 4 },
  { label: '2/4 Battered', health: 2, maxHealth: 4 },
  { label: '1/4 Critical', health: 1, maxHealth: 4 },
  { label: '0/4 KO', health: 0, maxHealth: 4 },
];

const RARITIES: WeaponRarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface GalleryFoeEntry {
  key: string;
  name: string;
  icon: IconName;
  tier: number;
  ability: string | null;
  taunt: string | null;
  worldName: string;
  levelId: string;
  levelName: string;
  parrySpec: ParrySpec | null;
  defeated: boolean;
}

/** Collect all unique campaign foes in campaign order, flagging defeated ones via `save.stars`. */
export const collectGalleryFoes = (save?: AdventureSave): GalleryFoeEntry[] => {
  const byName = new Map<string, GalleryFoeEntry>();
  for (const level of LEVELS) {
    const defeatedHere = (save?.stars[level.id] ?? 0) >= 1;
    const biome = getBiome(level.biome);
    for (const foeDef of level.foes) {
      const display = foeDisplay(foeDef);
      const key = foeDef.enemy ?? display.name;
      const existing = byName.get(key);
      if (existing) {
        if (defeatedHere) existing.defeated = true;
        if (!existing.taunt && foeDef.taunt) existing.taunt = foeDef.taunt;
        continue;
      }
      byName.set(key, {
        key,
        name: display.name,
        icon: display.icon,
        tier: display.tier,
        ability: display.ability,
        taunt: foeDef.taunt ?? null,
        worldName: biome.name,
        levelId: level.id,
        levelName: level.name,
        parrySpec: resolveParrySpec(level, foeDef),
        defeated: defeatedHere,
      });
    }
  }
  return Array.from(byName.values());
};

export interface CritterGalleryProps {
  /** 'studio' unlocks everything for /dev/fighters; 'gallery' honors player save progress */
  mode?: 'studio' | 'gallery';
  save?: AdventureSave;
  bottomInset?: number;
}

const CritterGallery: React.FC<CritterGalleryProps> = ({
  mode = 'gallery',
  save,
  bottomInset = 24,
}) => {
  if (mode === 'studio') {
    return <StudioView />;
  }
  return <GalleryView save={save} bottomInset={bottomInset} />;
};

/** Unlocked-all Animation & Relic Studio used by `/dev/fighters`. */
const StudioView: React.FC = () => {
  const appActive = useAppActive();
  const [tab, setTab] = useState<StudioTab>('fighters');
  const [hpPresetIndex, setHpPresetIndex] = useState(0);
  const [fighterMood, setFighterMood] = useState<FighterAmbientMood>('idle');
  const [fighterReaction, setFighterReaction] = useState<FighterReactionEvent | null>(null);
  const [enemyMood, setEnemyMood] = useState<EnemyAmbientMood>('menacing');
  const [enemyReaction, setEnemyReaction] = useState<EnemyReactionEvent | null>(null);
  const [enemyPage, setEnemyPage] = useState(0);
  const [weaponRarity, setWeaponRarity] = useState<WeaponRarity | 'default'>('default');
  const [autoCycle, setAutoCycle] = useState(false);
  const [effectsOff, setEffectsOff] = useState(false);
  const [streak, setStreak] = useState(0);

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
    if (!autoCycle || !appActive) return;
    const unregister = registerInterval('CritterGallery:autoCycle');
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
    return () => {
      clearInterval(iv);
      unregister();
    };
  }, [autoCycle, appActive, tab]);

  return (
    <View style={styles.container}>
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText} numberOfLines={1}>ANIMATION & RELIC STUDIO</Text>
        <View style={styles.eyebrowRight}>
          {tab !== 'weapons' && (
            <>
              <TouchableOpacity
                style={[styles.autoBtn, autoCycle && styles.autoBtnActive]}
                onPress={() => setAutoCycle(v => !v)}
              >
                <Text style={[styles.autoBtnText, autoCycle && styles.chipTextActive]}>
                  {autoCycle ? '■ Stop Flow' : '▶ Auto-Flow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="studio-effects-off"
                style={[styles.autoBtn, effectsOff && styles.autoBtnActive]}
                onPress={() => setEffectsOff(v => !v)}
              >
                <Text style={[styles.autoBtnText, effectsOff && styles.chipTextActive]}>
                  {effectsOff ? 'Effects off' : 'Effects on'}
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
        ).map(t => (
          <TouchableOpacity
            key={t.id}
            testID={`studio-tab-${t.id}`}
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
              {CHARACTERS.map((char, idx) => (
                <View key={char.name} testID={`studio-fighter-card-${idx}`} style={styles.fighterCard}>
                  <FighterAvatar
                    character={char}
                    size={96}
                    health={hp.health}
                    maxHealth={hp.maxHealth}
                    mood={fighterMood}
                    reaction={fighterReaction}
                    streak={streak || (fighterMood === 'streak' ? 4 : 0)}
                    quiet={effectsOff}
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
                    testID={`studio-hp-${idx}`}
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
                {[0, 1, 3, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    testID={`studio-streak-${n}`}
                    style={[styles.chip, streak === n && styles.chipActive]}
                    onPress={() => setStreak(n)}
                  >
                    <Text style={[styles.chipText, streak === n && styles.chipTextActive]}>
                      {n === 0 ? 'No streak' : `Streak ${n}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chipRow}>
                {FIGHTER_REACTIONS.map(r => (
                  <TouchableOpacity
                    key={r.type}
                    testID={`studio-fighter-react-${r.type}`}
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
                {FIGHTER_MOODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    testID={`studio-mood-${m}`}
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
              {visibleEnemies.map((enemyName, idx) => (
                <View key={enemyName} testID={`studio-enemy-card-${idx}`} style={styles.fighterCard}>
                  <EnemyAvatar
                    enemy={enemyName}
                    size={82}
                    hp={hp.health}
                    maxHp={hp.maxHealth}
                    mood={enemyMood}
                    reaction={enemyReaction}
                    quiet={effectsOff}
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
                    testID={`studio-hp-${idx}`}
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
                {ENEMY_REACTIONS.map(r => (
                  <TouchableOpacity
                    key={r.type}
                    testID={`studio-enemy-react-${r.type}`}
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
                {ENEMY_MOODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    testID={`studio-mood-${m}`}
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
                  <Text style={[styles.chipText, weaponRarity === 'default' && styles.chipTextActive]}>
                    Base Rarity
                  </Text>
                </TouchableOpacity>
                {RARITIES.map(r => (
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
              {uniqueWeapons.map(w => {
                const displayRarity = weaponRarity === 'default' ? w.rarity : weaponRarity;
                return (
                  <View
                    key={w.name}
                    style={[styles.weaponCard, { borderColor: getRarityColor(displayRarity) }]}
                  >
                    <WeaponAvatar weapon={w} rarity={displayRarity} size={56} interactive />
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
};

/** Player-facing Field Guide "Critters" gallery honoring save unlock & defeat progress. */
const GalleryView: React.FC<{ save?: AdventureSave; bottomInset: number }> = ({
  save,
  bottomInset,
}) => {
  const [subTab, setSubTab] = useState<GallerySubTab>('fighters');
  const [hpPresetIndex, setHpPresetIndex] = useState(0);
  const [selectedFighter, setSelectedFighter] = useState<CharacterName>(
    save?.selectedFighter ?? 'Orange Tabby'
  );
  const [fighterMood, setFighterMood] = useState<FighterAmbientMood>('idle');
  const [fighterReaction, setFighterReaction] = useState<FighterReactionEvent | null>(null);
  const [enemyMood, setEnemyMood] = useState<EnemyAmbientMood>('menacing');
  const [enemyReaction, setEnemyReaction] = useState<EnemyReactionEvent | null>(null);
  const reactionIdRef = useRef(0);

  const unlockedFighters = useMemo(
    () => new Set<string>(save?.unlockedFighters ?? ['Orange Tabby']),
    [save?.unlockedFighters]
  );
  const foes = useMemo(() => collectGalleryFoes(save), [save]);
  const defeatedFoes = useMemo(() => foes.filter(f => f.defeated), [foes]);
  const [selectedFoeKey, setSelectedFoeKey] = useState<string | null>(
    () => defeatedFoes[0]?.key ?? null
  );

  const hp = HP_PRESETS[hpPresetIndex];
  const focusedFighter =
    FIGHTERS.find(f => f.name === selectedFighter && unlockedFighters.has(f.name)) ??
    FIGHTERS.find(f => unlockedFighters.has(f.name)) ??
    FIGHTERS[0];
  const focusedFoe =
    foes.find(f => f.key === selectedFoeKey && f.defeated) ?? defeatedFoes[0] ?? null;

  const fireFighter = (type: FighterReactionType) => {
    reactionIdRef.current += 1;
    setFighterReaction({ type, id: reactionIdRef.current });
  };

  const fireEnemy = (type: EnemyReactionType) => {
    reactionIdRef.current += 1;
    setEnemyReaction({ type, id: reactionIdRef.current });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.galleryWrap, { paddingBottom: bottomInset + 24 }]}
      testID="critter-gallery"
    >
      <View style={styles.subTabRow}>
        <TouchableOpacity
          testID="critter-gallery-tab-fighters"
          onPress={() => setSubTab('fighters')}
          style={[styles.subTabBtn, subTab === 'fighters' && styles.subTabBtnOn]}
        >
          <Icon name="lorc/cat" size={15} color={INK} />
          <Text style={styles.subTabText}>
            FIGHTERS ({unlockedFighters.size}/{FIGHTERS.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="critter-gallery-tab-foes"
          onPress={() => setSubTab('foes')}
          style={[styles.subTabBtn, subTab === 'foes' && styles.subTabBtnOn]}
        >
          <Icon name="lorc/daemon-skull" size={15} color={INK} />
          <Text style={styles.subTabText}>
            FOES ({defeatedFoes.length}/{foes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'fighters' && (
        <>
          {/* Interactive Fighter Stage */}
          <View style={styles.stageCard} testID="critter-gallery-stage">
            <View style={styles.stageTop}>
              <FighterAvatar
                character={focusedFighter.name}
                size={100}
                health={hp.health}
                maxHealth={hp.maxHealth}
                mood={fighterMood}
                reaction={fighterReaction}
                framed
                interactive
                testID={`critter-stage-fighter-${focusedFighter.name}`}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.stageName}>{focusedFighter.name}</Text>
                <Text style={styles.stageBlurb}>{focusedFighter.blurb}</Text>
                <Text style={styles.stageHint}>Tap critter 1× to pet, or 5× for zoomies!</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              {HP_PRESETS.map((preset, idx) => (
                <TouchableOpacity
                  key={preset.label}
                  testID={`critter-hp-${idx}`}
                  onPress={() => setHpPresetIndex(idx)}
                  style={[styles.chip, hpPresetIndex === idx && styles.chipActive]}
                >
                  <Text style={[styles.chipText, hpPresetIndex === idx && styles.chipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chipRow}>
              {(
                [
                  { type: 'pet', label: 'Pet Blush' },
                  { type: 'joy', label: 'Cheer' },
                  { type: 'ecstatic', label: '3× Streak!' },
                  { type: 'dizzy_joy', label: '5× Zoomie!' },
                ] as { type: FighterReactionType; label: string }[]
              ).map(r => (
                <TouchableOpacity
                  key={r.type}
                  testID={`critter-fighter-react-${r.type}`}
                  onPress={() => fireFighter(r.type)}
                  style={styles.reactionBtn}
                >
                  <Text style={styles.reactionBtnText}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chipRow}>
              {(['idle', 'curious', 'anticipation', 'victory', 'sleepy'] as FighterAmbientMood[]).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setFighterMood(m)}
                  style={[styles.chip, fighterMood === m && styles.chipActive]}
                >
                  <Text style={[styles.chipText, fighterMood === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.metaBox}>
              {focusedFighter.passives.map(pid => {
                const p = getPassive(pid);
                return (
                  <View key={pid} style={styles.metaRow}>
                    <Icon name={p.icon} size={14} color={INK} />
                    <Text style={styles.metaText}>
                      <Text style={{ fontWeight: '900' }}>{p.name}: </Text>
                      {p.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Fighter Grid */}
          <View style={styles.grid}>
            {FIGHTERS.map(f => {
              const unlocked = unlockedFighters.has(f.name);
              const selected = unlocked && focusedFighter.name === f.name;
              return (
                <TouchableOpacity
                  key={f.name}
                  testID={`critter-fighter-${f.name}`}
                  disabled={!unlocked}
                  onPress={() => {
                    setSelectedFighter(f.name);
                    fireFighter('entrance');
                  }}
                  style={[
                    styles.fighterCard,
                    selected && styles.cardSelected,
                    !unlocked && styles.cardLocked,
                  ]}
                >
                  {unlocked ? (
                    <FighterAvatar character={f.name} size={64} mood="idle" framed animate={false} />
                  ) : (
                    <View style={styles.silhouetteWrap}>
                      <Silhouette icon={f.icon} size={36} light />
                    </View>
                  )}
                  <Text style={styles.fighterName}>{unlocked ? f.name : '???'}</Text>
                  <Text style={styles.petHint} numberOfLines={2}>
                    {unlocked ? 'Tap to inspect' : unlockHint({ kind: 'fighter', id: f.name }, save) ?? 'Locked'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {subTab === 'foes' && (
        <>
          {focusedFoe ? (
            <View style={styles.stageCard} testID="critter-gallery-stage">
              <View style={styles.stageTop}>
                <EnemyAvatar
                  enemy={{ name: focusedFoe.name, icon: focusedFoe.icon, tier: focusedFoe.tier }}
                  size={96}
                  hp={hp.health}
                  maxHp={hp.maxHealth}
                  mood={enemyMood}
                  reaction={enemyReaction}
                  framed
                  interactive
                  testID={`critter-stage-foe-${focusedFoe.key}`}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.stageWorld}>{focusedFoe.worldName.toUpperCase()} · {focusedFoe.levelId}</Text>
                  <Text style={styles.stageName}>{focusedFoe.name}</Text>
                  {focusedFoe.taunt && (
                    <Text style={styles.stageTaunt}>“{focusedFoe.taunt}”</Text>
                  )}
                  <Text style={styles.stageHint}>Tap foe 1× to poke, or 5× for rage!</Text>
                </View>
              </View>

              <View style={styles.chipRow}>
                {HP_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={preset.label}
                    testID={`critter-foe-hp-${idx}`}
                    onPress={() => setHpPresetIndex(idx)}
                    style={[styles.chip, hpPresetIndex === idx && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, hpPresetIndex === idx && styles.chipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.chipRow}>
                {(
                  [
                    { type: 'poke', label: 'Poke' },
                    { type: 'pain', label: 'Set Hit!' },
                    { type: 'crit_pain', label: 'Rainbow Crit!' },
                    { type: 'taunt', label: 'Taunt' },
                    { type: 'rage_spin', label: '5× Rage!' },
                  ] as { type: EnemyReactionType; label: string }[]
                ).map(r => (
                  <TouchableOpacity
                    key={r.type}
                    testID={`critter-foe-react-${r.type}`}
                    onPress={() => fireEnemy(r.type)}
                    style={styles.reactionBtn}
                  >
                    <Text style={styles.reactionBtnText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.chipRow}>
                {ENEMY_MOODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setEnemyMood(m)}
                    style={[styles.chip, enemyMood === m && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, enemyMood === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.metaBox}>
                {focusedFoe.ability && (
                  <View style={styles.metaRow}>
                    <Icon name="lorc/crossed-swords" size={14} color={INK} />
                    <Text style={styles.metaText}>
                      <Text style={{ fontWeight: '900' }}>Ability: </Text>
                      {focusedFoe.ability}
                    </Text>
                  </View>
                )}
                {focusedFoe.parrySpec && (() => {
                  const meta = formatParryCounterMeta(focusedFoe.parrySpec.counter);
                  return (
                    <View style={styles.metaRow} testID="critter-foe-parry-rule">
                      <Icon name={meta.icon} size={14} color={meta.color} />
                      <Text style={styles.metaText}>
                        <Text style={{ fontWeight: '900' }}>Parry ({meta.shortLabel}): </Text>
                        {meta.explain}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          ) : (
            <View style={styles.emptyStage} testID="critter-gallery-no-foes">
              <Icon name="lorc/crossed-swords" size={26} color={INK} />
              <Text style={styles.stageName}>No foes defeated yet</Text>
              <Text style={styles.stageBlurb}>Earn a ★ on any campaign stage to unlock its foe in the Critter Gallery!</Text>
            </View>
          )}

          {/* Foe Roster Grid (Defeated live, Undefeated silhouetted) */}
          <View style={styles.grid}>
            {foes.map(foe => {
              const selected = foe.defeated && focusedFoe?.key === foe.key;
              return (
                <TouchableOpacity
                  key={foe.key}
                  testID={`critter-foe-${foe.key}`}
                  disabled={!foe.defeated}
                  onPress={() => {
                    setSelectedFoeKey(foe.key);
                    fireEnemy('entrance');
                  }}
                  style={[
                    styles.fighterCard,
                    selected && styles.cardSelected,
                    !foe.defeated && styles.cardLocked,
                  ]}
                >
                  {foe.defeated ? (
                    <EnemyAvatar
                      enemy={{ name: foe.name, icon: foe.icon, tier: foe.tier }}
                      size={60}
                      mood="menacing"
                      framed
                      animate={false}
                    />
                  ) : (
                    <View style={styles.silhouetteWrap} testID={`critter-foe-silhouette-${foe.key}`}>
                      <Silhouette icon={foe.icon} size={34} light />
                    </View>
                  )}
                  <Text style={styles.fighterName} numberOfLines={2}>
                    {foe.defeated ? foe.name : '???'}
                  </Text>
                  <Text style={styles.petHint} numberOfLines={1}>
                    {foe.worldName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
};

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
    gap: 8,
  },
  eyebrowText: {
    flexShrink: 1,
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
  galleryWrap: {
    padding: 12,
    gap: 12,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#B8B0A4',
    backgroundColor: COLORS.canvasWhite,
  },
  subTabBtnOn: {
    backgroundColor: COLORS.actionYellow,
    borderColor: INK,
    borderBottomWidth: 4,
  },
  subTabText: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: INK,
  },
  stageCard: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    padding: 12,
    gap: 10,
  },
  emptyStage: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  stageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stageWorld: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#0F766E',
  },
  stageName: {
    fontSize: 18,
    fontWeight: '900',
    color: INK,
  },
  stageTaunt: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: INK,
    opacity: 0.85,
  },
  stageBlurb: {
    fontSize: 12.5,
    lineHeight: 17,
    color: INK,
    opacity: 0.85,
  },
  stageHint: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  metaBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: INK,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  fighterCard: {
    width: '30%',
    minWidth: 104,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 5,
  },
  cardSelected: {
    borderColor: INK,
    borderWidth: 2.5,
    borderBottomWidth: 4,
    backgroundColor: TONE.selected,
  },
  cardLocked: {
    borderColor: TONE.spentEdge,
    backgroundColor: '#EFEAE2',
    opacity: 0.82,
  },
  silhouetteWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.deepOnyx,
    alignItems: 'center',
    justifyContent: 'center',
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
    opacity: 0.65,
    textAlign: 'center',
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
    gap: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
  },
  chipActive: {
    backgroundColor: COLORS.logicTeal,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  chipTextActive: {
    color: COLORS.canvasWhite,
  },
  reactionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.actionYellow,
  },
  reactionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
});

export default CritterGallery;
