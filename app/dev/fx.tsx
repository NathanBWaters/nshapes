/**
 * Effects studio (/dev/fx): watch everything the fight can show ([FX-26]).
 *
 * A live stand-in fight screen (fighter on the left, foe on the right, HUD
 * chips, weapon belt with 5-state evolution HUD, twelve cards, live HP drop,
 * creature reactions, combat shake, chiaroscuro flash, and single-weapon
 * evolution cut-in / banner) wired through the exact `onLand` + `fxClock.slow`
 * pipeline used in live fights.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { useAppActive } from '@/hooks/useAppActive';
import { useCombatShake } from '@/hooks/useCombatShake';
import { useEnemyConductor } from '@/hooks/useEnemyConductor';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import type { Card as CardType } from '@/types';
import { COLORS } from '@/utils/colors';
import {
  ScreenFlashStorage,
  ScreenShakeStorage,
  useScreenFlashEnabled,
  useScreenShakeEnabled,
} from '@/utils/fxSettingsStorage';
import { getArmoryWeapon } from '@/adventure/data/armory';
import {
  WEAPON_EVOLUTIONS,
  defaultEvolutionForWeapon,
  evolutionConditionShort,
  evolutionConditionText,
  evolutionShortVerb,
  getWeaponEvolution,
} from '@/adventure/data/evolutions';
import { PASSIVES } from '@/adventure/data/passives';
import { ChiaroscuroFlash, EvolutionBanner, type EvolutionBannerEntry } from '@/adventure/components/RunFx';
import type { RunEvent, RunEventType, WeaponEvolutionDef } from '@/adventure/types';
import type { EvolutionLiveStateVM } from '@/adventure/ui/evolutionViewModel';
import {
  Anchor,
  AnchorsProvider,
  EVENT_FX,
  EvolutionCutIn,
  FxStage,
  GearBelt,
  fxClock,
  scriptFor,
  useAnchors,
  useFightFx,
} from '@/adventure/fx';
import type { EvolutionCutInEntry } from '@/adventure/fx/EvolutionCutIn';
import { combatShakeKindOf, hitKindOf } from '@/adventure/fx/catalog';
import type { Beat } from '@/adventure/fx/types';

const INK = COLORS.slateCharcoal;
const WEAPON_IDS = ['blast-powder', 'prismatic-ray', 'chaos-shard', 'flint-spark', 'mending-charm', 'fortunes-favor'];
const SPEEDS = [1, 4, 10];
const STUDIO_MAX_HP = 180;

type BeltEvoPreview = 'idle' | 'progress' | 'almost' | 'active' | 'cooldown';
const BELT_EVO_MODES: readonly [BeltEvoPreview, string][] = [
  ['idle', 'Idle'],
  ['progress', 'Progress 2/3'],
  ['almost', 'Almost-Ready'],
  ['active', 'Evolved 18s'],
  ['cooldown', 'Cooldown 3s'],
];

const SHAPES = ['diamond', 'oval', 'squiggle'] as const;
const CARD_COLORS = ['red', 'green', 'purple'] as const;
const SHADINGS = ['solid', 'striped', 'open'] as const;
const BOARD: CardType[] = Array.from({ length: 12 }, (_, i) => ({
  id: `studio-${i}`,
  shape: SHAPES[i % 3],
  color: CARD_COLORS[Math.floor(i / 3) % 3],
  number: ((i % 3) + 1) as CardType['number'],
  shading: SHADINGS[(i + Math.floor(i / 3)) % 3],
  selected: false,
}));

/** Which cards a sample of each event plays on, and the rule that "caused" it (so its weapon jumps on the belt) */
const SAMPLE: Partial<Record<RunEventType, Partial<RunEvent>>> = {
  hit: { amount: 14, slots: [0, 4, 8] },
  rainbow: { amount: 28, slots: [0, 4, 8] },
  surge_hit: { amount: 58, slots: [0, 4, 8] },
  surge_warn: { amount: 3 },
  surge_start: { amount: 1.8 },
  blast: { amount: 18, text: '4', slots: [1, 3, 4, 7], source: 'w0:blast-powder#0' },
  laser: { amount: 12, text: '3', slots: [3, 4, 5], source: 'w1:prismatic-ray#0' },
  ricochet: { amount: 9, text: '3', slots: [1, 6, 11], source: 'w2:chaos-shard#0' },
  link_burst: { text: '2', slots: [2, 9] },
  echo: { text: '3', slots: [2, 5, 10] },
  fire: { amount: 2, slots: [5, 9] },
  pinata: { amount: 12, slots: [7] },
  pinata_break: { amount: 26, slots: [7] },
  grow: { amount: 1, slots: [11] },
  link: { amount: 1, slots: [0, 10] },
  holo_spawn: { slots: [4] },
  marked: { slots: [2, 6] },
  fetch: { amount: 2, slots: [2, 6] },
  keen_eye: { slots: [4] },
  evo_progress: { amount: 0.66, text: '2/3', source: 'weapon:blast-powder' },
  evo_almost: { text: '1 LEFT!', source: 'weapon:blast-powder' },
  evo_charge: { amount: 1, source: 'w0:blast-powder#0' },
  evolution_start: { slots: [4], source: 'weapon:blast-powder' },
  trap_placed: { text: 'snare', slots: [6] },
  trap_defused: { amount: 8, text: 'bomb', slots: [6] },
  trap_sprung: { amount: 1, text: 'bomb', slots: [6] },
  dud: { slots: [1] },
  face_down: { slots: [10] },
  bomb: { slots: [8] },
  countdown: { slots: [8] },
  attr_shift: { slots: [3, 4] },
  card_removed: { slots: [11] },
  heal: { amount: 1, source: 'w4:mending-charm#0' },
  coins: { amount: 5 },
  time_gain: { amount: 3 },
  hint: { amount: 1 },
  hurt: { amount: 1 },
  regen: { amount: 4 },
  wave: { amount: 2 },
  combo: { amount: 4 },
  hot_streak_hit: { amount: 1.35 },
  grudge: { amount: 2 },
  grudge_release: { amount: 6 },
  patience: { amount: 3 },
  rule: { amount: 4, text: 'Mirror!' },
  charged: { amount: 1.4 },
  empowered: { amount: 1 },
  simplified: { text: 'color' },
  purity: { amount: 2 },
  purity_max: { amount: 3 },
  overkill: { amount: 9 },
  evolution_end: { text: 'Cluster Charge', source: 'weapon:blast-powder' },
  parry: { amount: 1.25, slots: [0, 4, 8] },
  perfect_parry: { amount: 1.35, slots: [0, 4, 8] },
  foe_strike: { text: 'Strike' },
};

/** Events that throw or remove cards show the card that was there */
const REMOVES: ReadonlySet<RunEventType> = new Set([
  'hit',
  'rainbow',
  'surge_hit',
  'blast',
  'laser',
  'ricochet',
  'link_burst',
  'pinata_break',
  'trap_sprung',
]);

let nextId = 1;
const sampleEvent = (type: RunEventType, overrides?: Partial<RunEvent>): RunEvent => {
  const s = { ...(SAMPLE[type] ?? {}), ...(overrides ?? {}) };
  return {
    id: nextId++,
    type,
    ...s,
    ...(s.slots && REMOVES.has(type) && !s.cards ? { cards: s.slots.map(i => BOARD[i]) } : {}),
  };
};

const CASCADE: RunEventType[] = ['hit', 'blast', 'coins', 'laser', 'heal', 'ricochet', 'evo_almost', 'time_gain'];

const Chip: React.FC<{ label: string; on?: boolean; onPress: () => void; testID?: string }> = ({ label, on, onPress, testID }) => (
  <TouchableOpacity testID={testID} onPress={onPress} style={[st.chip, on && st.chipOn]} activeOpacity={0.7}>
    <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);

const previewEvoState = (evo: WeaponEvolutionDef, mode: BeltEvoPreview): EvolutionLiveStateVM => {
  const durationMs = evo.durationMs;
  const phase = mode === 'active' ? 'active' : mode === 'cooldown' ? 'cooldown' : 'charging';
  return {
    weaponId: evo.weaponId,
    evolutionId: evo.id,
    evolutionName: evo.name,
    icon: evo.icon,
    accent: evo.accent,
    phase,
    conditionShort: evolutionConditionShort(evo),
    conditionFull: evolutionConditionText(evo),
    effectText: evolutionShortVerb(evo),
    progress: mode === 'progress' ? 2 : mode === 'almost' ? 2 : 0,
    target: 3,
    almostReady: mode === 'almost',
    activeRemainingMs: mode === 'active' ? durationMs : 0,
    activeDurationMs: durationMs,
    cooldownRemainingMs: mode === 'cooldown' ? 3000 : 0,
    triggersThisFight: mode === 'active' || mode === 'cooldown' ? 1 : 0,
  };
};

export default function FxStudio() {
  const appActive = useAppActive();
  const anchors = useAnchors();
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [hp, setHp] = useState(STUDIO_MAX_HP);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [beltEvoMode, setBeltEvoMode] = useState<BeltEvoPreview>('progress');
  const shakePref = useScreenShakeEnabled();
  const flashPref = useScreenFlashEnabled();

  const { shakeStyle, triggerCombatShake } = useCombatShake({
    enabled: !reduced,
    reduced,
    stageW: stage.w || 375,
  });

  const enemyConductor = useEnemyConductor({
    enemyName: 'Sparring Dummy',
    hp,
    maxHp: STUDIO_MAX_HP,
  });

  const fighterConductor = useFighterConductor({
    health: 3,
    maxHealth: 4,
  });

  useEffect(() => () => {
    fxClock.slow = 1;
  }, []);

  const handleLand = useCallback(
    (beat: Beat) => {
      if (beat.damage > 0) {
        setHp(cur => {
          const next = cur - beat.damage;
          return next <= 0 ? STUDIO_MAX_HP : next;
        });
      }
      if (!beat.quiet) {
        const shakeKind = combatShakeKindOf(beat.event.type, beat.tier);
        if (shakeKind) triggerCombatShake(shakeKind, stage.w || 375);
        if (beat.tier >= 3 || beat.event.type === 'perfect_parry') {
          setFlashTrigger(t => t + 1);
        }
        const foeAct = beat.row.enemy;
        if (foeAct === 'criticalHit') {
          enemyConductor.triggerReaction('crit_pain', { hitTier: beat.tier, hitKind: hitKindOf(beat.event.type), moveKind: beat.event.type });
        } else if (foeAct === 'hit') {
          enemyConductor.triggerReaction('pain', { hitTier: beat.tier, hitKind: hitKindOf(beat.event.type), moveKind: beat.event.type });
        } else if (foeAct === 'attack') enemyConductor.triggerReaction('attack');
        else if (foeAct === 'gloat') enemyConductor.triggerReaction('taunt');
        else if (foeAct === 'regen') enemyConductor.triggerReaction('regen');
        else if (foeAct === 'entrance') enemyConductor.triggerReaction('entrance');

        const fAct = beat.row.fighter;
        if (fAct === 'pain') fighterConductor.triggerMistake();
        else if (fAct === 'heal') fighterConductor.triggerMatch({ didHeal: true });
        else if (fAct === 'powerup') fighterConductor.triggerPowerup();
        else if (fAct === 'ecstatic') fighterConductor.triggerMatch({ isMegaMatch: true });
      }
    },
    [triggerCombatShake, stage.w, enemyConductor, fighterConductor]
  );

  const fx = useFightFx({ anchors, reduced, onLand: handleLand });
  const weapons = useMemo(() => WEAPON_IDS.map(id => getArmoryWeapon(id)).filter((w): w is NonNullable<typeof w> => !!w), []);
  const studioEvos = useMemo<WeaponEvolutionDef[]>(() => {
    const first = defaultEvolutionForWeapon('blast-powder') ?? WEAPON_EVOLUTIONS[0];
    const second = defaultEvolutionForWeapon('prismatic-ray') ?? WEAPON_EVOLUTIONS[1];
    return [first, second].filter((e): e is WeaponEvolutionDef => Boolean(e));
  }, []);

  const beltEvolutions = useMemo<EvolutionLiveStateVM[]>(
    () =>
      weapons
        .map(w => defaultEvolutionForWeapon(w.id))
        .filter((e): e is WeaponEvolutionDef => Boolean(e))
        .map((evo, i) => previewEvoState(evo, i === 0 ? beltEvoMode : i === 1 ? 'almost' : 'idle')),
    [weapons, beltEvoMode]
  );

  const playEvents = (events: RunEvent[]) => fx.play(scriptFor(events, { weapons, reduced }));
  const play = (types: RunEventType[]) => playEvents(types.map(t => sampleEvent(t)));
  const evolve = (list: WeaponEvolutionDef[], forceBanner = false) =>
    fx.play(
      scriptFor(
        list.map(evo => ({
          ...sampleEvent('evolution_start'),
          text: evo.id,
          source: `weapon:${evo.weaponId}`,
        })),
        { weapons, reduced, forceBanner }
      )
    );
  const changeSpeed = (s: number) => {
    fxClock.slow = s;
    setSpeed(s);
  };

  const shownHp = Math.max(0, Math.min(STUDIO_MAX_HP, hp));
  const hpPct = STUDIO_MAX_HP > 0 ? shownHp / STUDIO_MAX_HP : 1;

  const cutInEntries = useMemo<EvolutionCutInEntry[]>(() => {
    if (!fx.cutIn) return [];
    return fx.cutIn.recipes
      .map(id => getWeaponEvolution(id))
      .filter((e): e is WeaponEvolutionDef => Boolean(e))
      .map(evo => ({
        evolution: evo,
        weapon: weapons.find(w => w.id === evo.weaponId) ?? getArmoryWeapon(evo.weaponId),
        durationSec: Math.max(1, Math.round(evo.durationMs / 1000)),
      }));
  }, [fx.cutIn, weapons]);

  const bannerEntries = useMemo<EvolutionBannerEntry[]>(() => {
    if (!fx.banner) return [];
    return fx.banner.recipes
      .map(id => getWeaponEvolution(id))
      .filter((e): e is WeaponEvolutionDef => Boolean(e))
      .map(evo => ({
        id: evo.id,
        name: evo.name,
        icon: evo.icon,
        text: evolutionShortVerb(evo),
        seconds: Math.max(1, Math.round(evo.durationMs / 1000)),
        weapon: weapons.find(w => w.id === evo.weaponId) ?? getArmoryWeapon(evo.weaponId),
      }));
  }, [fx.banner, weapons]);

  return (
    <AnchorsProvider value={anchors} quiet={reduced}>
      <View style={st.page}>
        <Animated.View
          testID="fx-stage-root"
          style={[st.fight, shakeStyle]}
          onLayout={e => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <View ref={anchors.rootRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={st.hud}>
            <View style={st.row}>
              <Anchor name="fighter">
                <FighterAvatar
                  character="Orange Tabby"
                  size={44}
                  mood={fighterConductor.mood}
                  reaction={fighterConductor.reaction}
                  streak={fighterConductor.streak}
                  animate={appActive}
                  quiet={reduced}
                  framed
                />
              </Anchor>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={st.titleRow}>
                  <Text style={st.name} numberOfLines={1}>Effects studio</Text>
                  <Text style={st.hpText}>{Math.round(shownHp)}/{STUDIO_MAX_HP}</Text>
                </View>
                <View style={st.hp}>
                  <View style={[st.hpFill, { transform: [{ scaleX: Math.max(0.001, hpPct) }] }]} />
                </View>
                <Anchor name="combo" style={{ alignSelf: 'flex-start' }}><Text style={st.small}>COMBO ×4</Text></Anchor>
              </View>
              <Anchor name="foe">
                <View style={st.portrait}>
                  <EnemyAvatar
                    enemy={{ name: 'Sparring Dummy', icon: 'lorc/daemon-skull', tier: 1 }}
                    size={44}
                    hp={shownHp}
                    maxHp={STUDIO_MAX_HP}
                    mood={enemyConductor.mood}
                    reaction={enemyConductor.reaction}
                    hitTier={enemyConductor.reaction?.hitTier}
                    hitKind={enemyConductor.reaction?.hitKind}
                    hideImpactStars={true}
                    animate={appActive}
                    quiet={reduced}
                  />
                </View>
              </Anchor>
            </View>
            <View style={[st.row, { flexWrap: 'wrap', gap: 6 }]}>
              <Anchor name="hearts"><View style={st.stat}><Text style={st.statText}>♥ 3/4</Text></View></Anchor>
              <Anchor name="clock">
                <View style={[st.stat, fx.busy && st.statHeld]} testID="studio-clock">
                  <Icon name="lorc/stopwatch" size={14} color={fx.busy ? COLORS.logicTeal : INK} />
                  <Text style={st.statText}>{fx.busy ? 'held' : '60s'}</Text>
                </View>
              </Anchor>
              <Anchor name="graces"><View style={st.stat}><Icon name="lorc/clover" size={14} color={COLORS.logicTeal} /><Text style={st.statText}>2</Text></View></Anchor>
              <View style={{ flex: 1 }} />
              <Anchor name="coins"><View style={st.stat}><Icon name="lorc/crown-coin" size={14} color="#E0A800" /><Text style={st.statText}>120</Text></View></Anchor>
              <Anchor name="hint"><View style={[st.stat, { backgroundColor: COLORS.actionYellow }]}><Icon name="lorc/light-bulb" size={14} color={INK} /><Text style={st.statText}>3</Text></View></Anchor>
            </View>
            <View style={[st.row, { flexWrap: 'wrap', gap: 4 }]}>
              {Object.values(PASSIVES).map(p => (
                <Anchor key={p.id} name={`passive:${p.id}`}><View style={st.passive}><Icon name={p.icon} size={13} color={INK} /></View></Anchor>
              ))}
              {studioEvos[0] && (
                <Anchor name={`evo:${studioEvos[0].id}`}>
                  <View style={[st.passive, { backgroundColor: '#E9D5FF' }]}>
                    <Icon name={studioEvos[0].icon} size={13} color={INK} />
                  </View>
                </Anchor>
              )}
            </View>
            <Anchor name="xp"><View style={st.xp} /></Anchor>
            <GearBelt
              weapons={weapons}
              evolutions={beltEvolutions}
              active={!fx.busy}
              effects={!reduced}
              reduced={reduced}
              width={stage.w}
              onInspect={() => {}}
            />
          </View>

          <View ref={anchors.ref('board')} collapsable={false} style={st.board}>
            {[0, 1, 2, 3].map(r => (
              <View key={r} style={st.cardRow}>
                {[0, 1, 2].map(c => {
                  const i = r * 3 + c;
                  return (
                    <View key={i} ref={anchors.ref(`slot:${i}`)} collapsable={false} onLayout={anchors.measure} style={st.slot}>
                      <Card card={BOARD[i]} onClick={() => {}} disabled />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <FxStage fx={fx} anchors={anchors} size={stage} effects={!reduced} />
          <ChiaroscuroFlash trigger={flashTrigger} enabled={!reduced} stageW={stage.w || 375} testID="studio-chiaroscuro-flash" />
          {fx.cutIn && cutInEntries.length > 0 && (
            <EvolutionCutIn
              key={fx.cutIn.key}
              evolutions={cutInEntries}
              weapons={weapons}
              size={stage}
              onDone={fx.dismissCutIn}
            />
          )}
          {fx.banner && bannerEntries.length > 0 && (
            <View style={st.bannerWrap} pointerEvents="none">
              <EvolutionBanner entries={bannerEntries} seq={fx.banner.key} />
            </View>
          )}
        </Animated.View>

        <ScrollView style={st.controls} contentContainerStyle={st.controlsBody}>
          <View style={st.wrap}>
            <Text style={st.heading}>Speed & Accessibility</Text>
            {SPEEDS.map(s => <Chip key={s} label={s === 1 ? 'Real time' : `${s}× slower`} on={speed === s} onPress={() => changeSpeed(s)} testID={`fx-speed-${s}`} />)}
            <Chip label={reduced ? 'Effects off' : 'Effects on'} on={!reduced} onPress={() => setReduced(r => !r)} testID="fx-reduced" />
            <Chip label={shakePref ? 'Shake on' : 'Shake off'} on={shakePref} onPress={() => ScreenShakeStorage.set(!shakePref)} testID="fx-toggle-shake" />
            <Chip label={flashPref ? 'Flash on' : 'Flash off'} on={flashPref} onPress={() => ScreenFlashStorage.set(!flashPref)} testID="fx-toggle-flash" />
            <Chip label="Reset HP" onPress={() => setHp(STUDIO_MAX_HP)} testID="fx-reset-hp" />
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Belt Evolution HUD State</Text>
            {BELT_EVO_MODES.map(([mode, label]) => (
              <Chip
                key={mode}
                label={label}
                on={beltEvoMode === mode}
                onPress={() => setBeltEvoMode(mode)}
                testID={`fx-belt-evo-${mode}`}
              />
            ))}
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Wave 4 VFX Showcase</Text>
            <Chip
              label="4-Stage Explosion (6 slots)"
              onPress={() => playEvents([sampleEvent('blast', { amount: 28, text: '6', slots: [0, 1, 3, 4, 6, 7] })])}
              testID="fx-showcase-explosion"
            />
            <Chip
              label="Chiaroscuro Flash + Edge Starburst (MEGA)"
              onPress={() => playEvents([sampleEvent('hit', { amount: 64, slots: [0, 4, 8] })])}
              testID="fx-showcase-mega"
            />
            <Chip
              label="2f Snap Beam + Sparks"
              onPress={() => playEvents([sampleEvent('laser', { amount: 16, text: '3', slots: [3, 4, 5] })])}
              testID="fx-showcase-beam"
            />
            <Chip
              label="Foe Strike (no foe flinch)"
              onPress={() => playEvents([sampleEvent('foe_strike')])}
              testID="fx-showcase-foe-strike"
            />
            <Chip
              label="Evo Almost-Ready Pulse"
              onPress={() => {
                setBeltEvoMode('almost');
                playEvents([sampleEvent('evo_almost')]);
              }}
              testID="fx-showcase-evo-almost"
            />
            <Chip
              label="Evo Charge Bolt"
              onPress={() => playEvents([sampleEvent('evo_charge')])}
              testID="fx-showcase-evo-charge"
            />
            <Chip
              label="Holo Card Spawn"
              onPress={() => playEvents([sampleEvent('holo_spawn')])}
              testID="fx-showcase-holo"
            />
            <Chip label="Shake: Small (Y)" onPress={() => triggerCombatShake('small', stage.w || 375)} testID="fx-shake-small" />
            <Chip label="Shake: Medium (XY)" onPress={() => triggerCombatShake('medium', stage.w || 375)} testID="fx-shake-medium" />
            <Chip label="Shake: Large (XY+Roll)" onPress={() => triggerCombatShake('large', stage.w || 375)} testID="fx-shake-large" />
            <Chip label="Flash: Chiaroscuro (112ms)" onPress={() => setFlashTrigger(t => t + 1)} testID="fx-flash-chiaroscuro" />
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Play</Text>
            <Chip label="A Set and what it sets off" onPress={() => play(CASCADE)} testID="fx-cascade" />
            <Chip label="Evolution (Cut-In)" onPress={() => evolve(studioEvos.slice(0, 1))} testID="fx-evolution" />
            <Chip label="Two evolutions at once" onPress={() => evolve(studioEvos)} testID="fx-evolution-2" />
            <Chip label="Repeat Evolution Banner" onPress={() => evolve(studioEvos, true)} testID="fx-evolution-banner" />
          </View>
          <View style={st.wrap}>
            <Text style={st.heading}>Every event</Text>
            {(Object.keys(EVENT_FX) as RunEventType[]).map(type => (
              <Chip key={type} label={EVENT_FX[type] ? type : `${type} (nothing)`} onPress={() => play([type])} testID={`fx-event-${type}`} />
            ))}
          </View>
        </ScrollView>
      </View>
    </AnchorsProvider>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.paperBeige, alignItems: 'center' },
  fight: { width: '100%', maxWidth: 480, backgroundColor: '#E8F3E4', overflow: 'hidden' },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  portrait: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvasWhite },
  name: { flexShrink: 1, fontWeight: '900', fontSize: 15, color: INK },
  hpText: { fontSize: 11, fontWeight: '800', color: INK, opacity: 0.75, fontVariant: ['tabular-nums'] },
  small: { fontSize: 11, fontWeight: '900', color: COLORS.impactOrange },
  hp: { height: 16, borderRadius: 4, borderWidth: 2, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden' },
  hpFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLORS.impactRed, transformOrigin: 'left center' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  statHeld: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  statText: { fontWeight: '900', color: INK, fontSize: 13 },
  passive: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  xp: { height: 10, borderRadius: 3, borderWidth: 1.5, borderColor: INK, backgroundColor: '#7AC8FF' },
  board: { paddingVertical: 8, paddingHorizontal: 44, gap: 6 },
  cardRow: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, aspectRatio: 0.95 },
  bannerWrap: { position: 'absolute', left: 0, right: 0, top: 72, zIndex: 260 },
  controls: { width: '100%', maxWidth: 480, flex: 1 },
  controlsBody: { padding: 10, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  heading: { width: '100%', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK, opacity: 0.7, textTransform: 'uppercase' },
  chip: { borderWidth: 2, borderColor: INK, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: COLORS.canvasWhite },
  chipOn: { backgroundColor: COLORS.actionYellow },
  chipText: { fontSize: 12, fontWeight: '800', color: INK },
  chipTextOn: { color: INK },
});
