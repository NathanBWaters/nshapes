/**
 * One fight. Wraps the shared GameBoard with the adventure HUD:
 * foe HP bar with running damage / combo / biggest-hit counters, hearts,
 * moves/clock, coins, XP, live passive chips, evolution rings, challenge
 * ticker, coach marks, level-up picks and the between-wave shop.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameBoard from '@/components/GameBoard';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { useEnemyConductor } from '@/hooks/useEnemyConductor';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { COLORS } from '@/utils/colors';
import type { Card, CardReward, Weapon } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { music, sfx } from '@/audio';
import type { AdventureSave, EvolutionRecipe, LevelDef, PassiveId, RunEvent, RunEventType, RunState } from '../types';
import type { WeaponBuilds } from '../data/weaponStats';
import { createRun, runReducer, shopPrice, rerollCost, xpForLevel, type RunAction } from '../engine/run';
import { challengeProgress } from '../engine/challenges';
import { MECHANICS } from '../data/mechanics';
import { getBiome } from '../data/biomes';
import { foeDisplay } from '../data/foes';
import { getFighter } from '../data/fighters';
import { comboWindowFor, getPassive, DEFAULT_COMBO_WINDOW_MS, PASSIVE_TUNING } from '../data/passives';
import { getArcana } from '../data/arcana';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { weaponLevelSuffix } from '../data/armory';
import { COACH_KEYS } from '../progress';
import { Btn, CoinPill, DARK, Eyebrow, Heart, INK, PopIn, TONE } from './ui';
import { EvolutionBanner, EvolutionRing, Floater, MegaFlash, hitTier, type FloaterSpec } from './RunFx';

const TICK_MS = 250;
const REPLACE_DELAY_MS = 950;

interface Props {
  level: LevelDef;
  save: AdventureSave;
  seed: number;
  autoPlayer?: boolean;
  onFinish: (run: RunState) => void;
  onQuit: () => void;
  onRestart: () => void;
  onCoachMarkSeen: (mechanicId: string) => void;
}

type FighterReaction = 'ecstatic' | 'heal' | 'powerup' | 'pain' | 'entrance';
type EnemyReaction = 'criticalHit' | 'hit' | 'gloat' | 'attack' | 'regen' | 'entrance';

/** How each run event looks and sounds. A full Record, so a new event type has to be given a row. */
interface EventPresentation {
  sfx?: Parameters<typeof sfx>[0];
  floater?: (e: RunEvent) => { text: string; color: string };
  /** Damage to the foe: the floater grows with `amount` (big ≥10, huge ≥25 + screen shake, MEGA ≥50 + flash) */
  damage?: boolean;
  fighter?: FighterReaction;
  enemy?: EnemyReaction;
  /** Foe portrait shakes */
  shake?: boolean;
}

const RAINBOW = '#9333EA';
const amount = (e: RunEvent) => e.amount ?? 0;
/** "−12", or "BLAST −12" when the event names its source */
const dmg = (label?: string) => (e: RunEvent) => {
  const source = e.text ?? label;
  return { text: source ? `${source} −${amount(e)}` : `−${amount(e)}`, color: COLORS.impactRed };
};

const EVENT_PRESENTATION: Record<RunEventType, EventPresentation> = {
  hit: { sfx: 'hit', shake: true, damage: true, floater: dmg(), enemy: 'hit' },
  rainbow: { sfx: 'rainbow', shake: true, damage: true, floater: e => ({ text: `RAINBOW −${amount(e)}`, color: RAINBOW }), fighter: 'ecstatic', enemy: 'criticalHit' },
  heal: { sfx: 'heart', fighter: 'heal', floater: e => ({ text: `+${amount(e) || 1}♥`, color: COLORS.logicTeal }) },
  hurt: { sfx: 'hurt', enemy: 'gloat' },
  grace: {},
  coins: { sfx: 'coin', floater: e => ({ text: `+${amount(e)}¢`, color: TONE.coin }) },
  levelup: { sfx: 'levelup', fighter: 'powerup' },
  foe_defeated: { sfx: 'foeDefeated', fighter: 'ecstatic' },
  wave: { sfx: 'wave', fighter: 'entrance', enemy: 'entrance' },
  regen: { sfx: 'graceGain', floater: e => ({ text: `+${amount(e)}`, color: COLORS.logicTeal }), enemy: 'regen' },
  dud: {},
  face_down: {},
  countdown: {},
  bomb: {},
  triple: {},
  shuffle: { sfx: 'whoosh', enemy: 'attack' },
  attr_shift: {},
  card_removed: {},
  time_stolen: { sfx: 'back', fighter: 'pain', enemy: 'attack' },
  inactivity: { fighter: 'pain', enemy: 'attack' },
  fire: {},
  hint: {},
  mistake: {},
  time_up: {},
  moves_out: {},
  time_gain: { floater: e => ({ text: `+${amount(e)}s`, color: COLORS.logicTeal }) },
  // fighter passives
  nine_lives: { sfx: 'heart', floater: () => ({ text: 'NINE LIVES!', color: COLORS.logicTeal }), fighter: 'heal' },
  combo: { floater: e => ({ text: `COMBO ×${amount(e)}`, color: COLORS.impactOrange }), fighter: 'ecstatic' },
  hot_streak: { sfx: 'star2', floater: () => ({ text: 'HOT STREAK READY', color: COLORS.impactOrange }), fighter: 'powerup' },
  hot_streak_hit: { sfx: 'explosion', shake: true, damage: true, floater: dmg('HOT STREAK'), fighter: 'ecstatic', enemy: 'criticalHit' },
  grudge: { floater: e => ({ text: `GRUDGE ${amount(e) || ''}`.trim(), color: '#7A3E00' }) },
  grudge_release: { sfx: 'explosion', shake: true, damage: true, floater: dmg('GRUDGE'), fighter: 'ecstatic', enemy: 'criticalHit' },
  thick_hide: { sfx: 'graceGain', floater: () => ({ text: 'THICK HIDE!', color: COLORS.logicTeal }), fighter: 'heal' },
  patience: { damage: true, floater: dmg('PATIENCE'), enemy: 'hit' },
  freeze: { sfx: 'freeze', fighter: 'ecstatic', floater: () => ({ text: 'FROZEN!', color: '#1D4ED8' }) },
  redeal: { sfx: 'whoosh', fighter: 'ecstatic', floater: () => ({ text: 'ZOOMIES!', color: COLORS.impactOrange }) },
  scoop: { sfx: 'match', fighter: 'ecstatic', enemy: 'criticalHit', floater: () => ({ text: 'BIG SCOOP!', color: COLORS.logicTeal }) },
  keen_eye: { sfx: 'hint' },
  fetch: { sfx: 'deal', floater: () => ({ text: 'FETCH!', color: TONE.coin }) },
  free_mistake: { sfx: 'graceGain', floater: () => ({ text: 'NO HARM', color: COLORS.logicTeal }) },
  // rule effects
  rule: { floater: e => ({ text: e.text ?? '!', color: TONE.combo }) },
  blast: { sfx: 'explosion', shake: true, damage: true, floater: dmg('BLAST'), enemy: 'hit' },
  laser: { sfx: 'laser', shake: true, damage: true, floater: dmg('LASER'), enemy: 'hit' },
  ricochet: { sfx: 'ricochet', damage: true, floater: dmg('RICOCHET'), enemy: 'hit' },
  doubled: { sfx: 'star2', floater: () => ({ text: '×2!', color: TONE.combo }) },
  double_ready: { floater: () => ({ text: 'NEXT ×2', color: TONE.combo }) },
  charged: { sfx: 'star1', floater: e => ({ text: `NEXT SET ×${amount(e)}`, color: COLORS.impactOrange }) },
  empowered: { sfx: 'levelup', floater: e => ({ text: `WAR DRUM +${amount(e)}`, color: COLORS.impactOrange }), fighter: 'powerup' },
  simplified: { sfx: 'whoosh', floater: () => ({ text: 'CLARITY!', color: COLORS.logicTeal }) },
  simplify_end: {},
  pinata: { sfx: 'deal', floater: () => ({ text: 'PIÑATA!', color: '#DB2777' }) },
  pinata_break: { sfx: 'coin', shake: true, damage: true, floater: dmg('PIÑATA'), fighter: 'ecstatic', enemy: 'criticalHit' },
  link: {},
  // purity, evolutions, hazards & arcana
  purity: { sfx: 'match', floater: e => ({ text: `PURITY ×${amount(e)}!`, color: '#0D9488' }) },
  purity_max: { sfx: 'rainbow', floater: e => ({ text: `MAX PURITY ×${amount(e)}!`, color: TONE.combo }), fighter: 'ecstatic', enemy: 'criticalHit' },
  catalyst_spawn: { sfx: 'star1', floater: () => ({ text: 'CATALYST!', color: TONE.evoReady }) },
  evolution_start: { sfx: 'unlock', fighter: 'ecstatic', enemy: 'criticalHit' },
  evolution_end: { floater: () => ({ text: 'EVOLUTION ENDS', color: TONE.spent }) },
  trap_placed: {},
  trap_defused: { sfx: 'confirm', damage: true, floater: e => ({ text: `DEFUSED −${amount(e)}`, color: COLORS.logicTeal }), enemy: 'hit' },
  trap_sprung: { sfx: 'hurt', floater: () => ({ text: 'SPRUNG!', color: COLORS.impactRed }), fighter: 'pain', enemy: 'gloat' },
  arcana_burn: { sfx: 'explosion', floater: () => ({ text: 'CONTROLLED BURN!', color: COLORS.impactOrange }) },
  overkill: { sfx: 'coin', floater: e => ({ text: `OVERKILL +${amount(e)}`, color: TONE.coin }) },
};

/** The recipe an evolution event is about (the engine names it by id or by name). */
const recipeFor = (key: string | undefined): EvolutionRecipe | undefined =>
  key ? EVOLUTION_RECIPES.find(r => r.id === key || r.name === key) : undefined;

/** A tip the player has to accept. The fight is paused while one is showing. */
interface Tip {
  id: string;
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  anchor?: 'top' | 'bottom';
  /** e.g. "Tip 2 of 3" */
  label?: string;
}

/** First-time tips for each run event (several mechanics may wait on the same event). */
const COACH_BY_EVENT = new Map<RunEventType, Tip[]>();
for (const m of Object.values(MECHANICS)) {
  if (!m.coachMark) continue;
  const tip: Tip = { id: COACH_KEYS.event(m.id), title: m.title, text: m.coachMark.text, icon: m.icon };
  COACH_BY_EVENT.set(m.coachMark.on, [...(COACH_BY_EVENT.get(m.coachMark.on) ?? []), tip]);
}

const AdventureRun: React.FC<Props> = ({ level, save, seed, autoPlayer, onFinish, onQuit, onRestart, onCoachMarkSeen }) => {
  const insets = useSafeAreaInsets();
  const [run, dispatchRaw] = useReducer(runReducer, undefined, () => createRun(level, save, { seed }));
  const runRef = useRef(run);
  runRef.current = run;
  const dispatch = useCallback((a: RunAction) => dispatchRaw(a), []);
  const [paused, setPaused] = useState(false);
  const [hudHeight, setHudHeight] = useState(150);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(Date.now());
  const [floaters, setFloaters] = useState<FloaterSpec[]>([]);
  const [megaFlash, setMegaFlash] = useState(0);
  const [banner, setBanner] = useState<{ recipe: EvolutionRecipe | null; text: string; seq: number } | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const tip = tips[0] ?? null;
  const pushTip = useCallback((t: Tip) => setTips(q => (q.some(x => x.id === t.id) ? q : [...q, t])), []);
  const seenCoach = useRef(new Set(save.seenCoachMarks));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const biome = getBiome(level.biome);
  const ended = run.status === 'won' || run.status === 'lost';

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  // Dev only: expose the live run so browser scripts can play end-to-end
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') (window as unknown as { __nshapesRun?: RunState }).__nshapesRun = run;
  }, [run]);
  const later = useCallback((fn: () => void, ms: number) => {
    timeouts.current.push(setTimeout(fn, ms));
  }, []);

  // Music: battle arrangement for this biome, boss arrangement for bosses
  useEffect(() => {
    music.play(level.isBoss ? 'boss' : biome.music);
  }, [level.isBoss, biome.music]);

  const playing = run.status === 'playing' && !paused && !tip;

  // First fight with a new mechanic: walk through its tips before anything moves
  useEffect(() => {
    const m = MECHANICS[level.introduces];
    const key = COACH_KEYS.fightStart(m.id);
    if (!m.fightTips?.length || seenCoach.current.has(key)) return;
    seenCoach.current.add(key);
    onCoachMarkSeen(key);
    const n = m.fightTips.length;
    m.fightTips.forEach((t, i) => pushTip({ id: `${key}_${i}`, title: t.title, text: t.text, icon: m.icon, anchor: t.anchor, label: n > 1 ? `Tip ${i + 1} of ${n}` : 'Tip' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // First fight with a fighter: what its two passives do. First fight with a hazard: how it works.
  useEffect(() => {
    const once = (key: string, tip: Omit<Tip, 'id'>) => {
      if (seenCoach.current.has(key)) return;
      seenCoach.current.add(key);
      onCoachMarkSeen(key);
      pushTip({ id: key, ...tip });
    };
    // A fighter's own lesson (its trial) already explained the passives
    const taught = save.seenMechanics.includes(getFighter(run.fighter).signature);
    if (run.passives.length > 0 && !taught) {
      const [a, b] = run.passives.map(getPassive);
      once(COACH_KEYS.passives(run.fighter), {
        title: `${run.fighter}: ${a.name} & ${b?.name ?? ''}`.replace(/ & $/, ''),
        text: run.passives.map(id => `${getPassive(id).name}: ${getPassive(id).text}`).join('\n'),
        icon: a.icon,
        anchor: 'top',
        label: 'Your passives',
      });
    }
    const hazards = level.rules.hazards;
    if (hazards?.timeBombs) {
      once(COACH_KEYS.hazard('timeBombs'), {
        title: 'Time Bombs',
        text: `A card with a fuse counts down from ${hazards.timeBombs.seconds}s. Match it in a Set before it reaches 0, or you lose a heart.`,
        icon: 'lorc/time-bomb',
        anchor: 'bottom',
        label: 'Hazard',
      });
    }
    if (hazards?.snares) {
      once(COACH_KEYS.hazard('snares'), {
        title: 'Snares',
        text: 'A card with an arrow in its corner is snared. Matching it costs a heart. Match the card the arrow points at instead to defuse it for +4 damage.',
        icon: 'lorc/wolf-trap',
        anchor: 'bottom',
        label: 'Hazard',
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => dispatch({ type: 'TICK', ms: TICK_MS }), TICK_MS);
    return () => clearInterval(iv);
  }, [playing, dispatch]);

  // Low-time tick sound
  const secondsLeft = run.timeLeft !== null ? Math.ceil(run.timeLeft) : null;
  const hasHearts = run.hearts !== null && run.maxHearts !== null && run.maxHearts > 0;
  const fighterHealth = hasHearts ? run.hearts! : (run.status === 'lost' ? 0 : 3);
  const fighterMaxHealth = hasHearts ? run.maxHearts! : 3;
  const conductor = useFighterConductor({
    health: fighterHealth,
    maxHealth: fighterMaxHealth,
    remainingTime: secondsLeft ?? undefined,
    score: run.foeMaxHp - run.foeHp,
    targetScore: run.foeMaxHp,
    isActiveRound: playing,
  });
  const fighterMood = run.status === 'won' ? 'victory' : run.status === 'lost' ? 'defeat' : conductor.mood;

  const ui = run.foe.getUIModifiers();
  const inactivityRatio = ui.showInactivityBar
    ? ui.showInactivityBar.current / Math.max(1, ui.showInactivityBar.max)
    : 0;
  const enemyConductor = useEnemyConductor({
    enemyName: run.foeName,
    hp: run.foeHp,
    maxHp: run.foeMaxHp,
    isBoss: level.isBoss,
    inactivityRatio,
    isActiveCombat: playing,
  });
  const enemyMood = run.status === 'lost' ? 'victory' : enemyConductor.mood;

  const { triggerEntrance } = conductor;
  const { triggerReaction: triggerEnemyReaction } = enemyConductor;
  useEffect(() => {
    triggerEntrance();
    triggerEnemyReaction('entrance');
  }, [triggerEntrance, triggerEnemyReaction]);

  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0 && run.status === 'playing') sfx('tick');
  }, [secondsLeft, run.status]);

  // Events → sfx, floating numbers (sized by the hit), shakes, flashes, banners, coach marks
  const foeShake = useSharedValue(0);
  const foeScale = useSharedValue(1);
  const screenShake = useSharedValue(0);
  const lastEventId = useRef(0);
  useEffect(() => {
    const fresh = run.events.filter(e => e.id > lastEventId.current);
    if (fresh.length === 0) return;
    lastEventId.current = fresh[fresh.length - 1].id;
    let burst = 0;
    for (const e of fresh) {
      const show = EVENT_PRESENTATION[e.type];
      if (show.sfx) sfx(show.sfx);
      const tier = show.damage ? hitTier(e.amount ?? 0) : 0;
      if (show.shake) {
        foeShake.value = withSequence(withTiming(-8, { duration: 40 }), withTiming(8, { duration: 60 }), withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }));
        foeScale.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }));
      }
      if (tier >= 2) {
        const amp = tier === 3 ? 10 : 6;
        screenShake.value = withSequence(withTiming(-amp, { duration: 40 }), withTiming(amp, { duration: 60 }), withTiming(-amp / 2, { duration: 50 }), withTiming(amp / 2, { duration: 50 }), withTiming(0, { duration: 50 }));
      }
      if (tier === 3) setMegaFlash(f => f + 1);
      if (show.floater) {
        const f = show.floater(e);
        addFloater(tier === 3 ? `MEGA ${f.text}` : f.text, f.color, tier, burst++);
      }
      switch (show.fighter) {
        case 'ecstatic': conductor.triggerReaction('ecstatic'); break;
        case 'pain': conductor.triggerReaction('pain'); break;
        case 'heal': conductor.triggerHeal(); break;
        case 'powerup': conductor.triggerPowerup(); break;
        case 'entrance': conductor.triggerEntrance(); break;
      }
      switch (show.enemy) {
        case 'criticalHit': enemyConductor.triggerReaction('crit_pain'); break;
        case 'hit': enemyConductor.triggerReaction('pain'); break;
        case 'gloat': enemyConductor.triggerReaction('taunt'); break;
        case 'attack': enemyConductor.triggerReaction('attack'); break;
        case 'regen': enemyConductor.triggerReaction('regen'); break;
        case 'entrance': enemyConductor.triggerReaction('entrance'); break;
      }
      if (e.type === 'evolution_start') {
        const recipe = recipeFor(e.text);
        setBanner(b => ({ recipe: recipe ?? null, text: recipe?.activeText ?? e.text ?? '', seq: (b?.seq ?? 0) + 1 }));
        later(() => setBanner(null), 2700);
        if (!seenCoach.current.has(COACH_KEYS.evolution)) {
          seenCoach.current.add(COACH_KEYS.evolution);
          onCoachMarkSeen(COACH_KEYS.evolution);
          pushTip({
            id: COACH_KEYS.evolution,
            title: `${recipe?.name ?? 'Evolution'} is live!`,
            text: `For 30 seconds: ${recipe?.activeText ?? 'your evolved rules are on.'} Every Set also deals ×1.5 and +2. The ring by the HP bar shows the time left.`,
            icon: recipe?.icon ?? 'lorc/crystal-shine',
            anchor: 'top',
            label: 'Evolution',
          });
        }
      }
      for (const cm of COACH_BY_EVENT.get(e.type) ?? []) {
        if (seenCoach.current.has(cm.id)) continue;
        seenCoach.current.add(cm.id);
        onCoachMarkSeen(cm.id);
        pushTip(cm);
      }
    }
    dispatch({ type: 'CLEAR_EVENTS', upTo: lastEventId.current - 20 });
  }, [run.events]); // eslint-disable-line react-hooks/exhaustive-deps

  const floaterSeq = useRef(0);
  const addFloater = (text: string, color: string, tier: FloaterSpec['tier'], index: number) => {
    const id = ++floaterSeq.current;
    const dx = ((index % 3) - 1) * 34 + (tier > 0 ? -10 : 0);
    setFloaters(f => [...f.slice(-6), { id, text, color, tier, dx }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), 1100 + tier * 250);
  };

  // End of run → hand off to results after the finishing blow lands
  useEffect(() => {
    if (!ended) return;
    music.stop();
    sfx(run.status === 'won' ? 'victory' : 'gameOver');
    const t = setTimeout(() => onFinish(runRef.current), 1300);
    return () => clearTimeout(t);
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatch = useCallback((cards: Card[], rewards: CardReward[], effects?: WeaponEffectResult) => {
    setLastMatchTime(Date.now());
    const graceUsed = rewards.some(r => r.effectType === 'grace');
    const isMegaMatch =
      Boolean(effects?.explosiveCards.length) ||
      Boolean(effects?.laserCards.length) ||
      Boolean(effects?.ricochetCards.length) ||
      cards.length > 3;
    const didHeal = rewards.some(r => (r.healing ?? 0) > 0) || Boolean(effects?.bonusHealing);
    conductor.triggerMatch({ isGraceMatch: graceUsed, isMegaMatch, didHeal });
    dispatch({ type: 'MATCH', cards, rewards, effects });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), REPLACE_DELAY_MS);
  }, [dispatch, conductor, later]);

  const handleInvalid = useCallback((cards: Card[]) => {
    conductor.triggerMistake();
    enemyConductor.triggerReaction('taunt');
    dispatch({ type: 'INVALID', cards });
    const ids = cards.map(c => c.id);
    later(() => dispatch({ type: 'REPLACE', ids }), 520);
  }, [dispatch, conductor, enemyConductor, later]);

  const handleBurn = useCallback((card: Card) => dispatch({ type: 'BURN', card }), [dispatch]);
  const handleUseHint = useCallback(() => {
    conductor.triggerHint();
    dispatch({ type: 'USE_HINT' });
    sfx('hint');
  }, [dispatch, conductor]);

  const foeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: foeShake.value }, { scale: foeScale.value }] }));
  const screenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: screenShake.value }] }));
  const hpPct = run.foeMaxHp > 0 ? run.foeHp / run.foeMaxHp : 0;
  const challenge = challengeProgress(run);
  const xpNeed = xpForLevel(run.xpLevel);
  const comboLive = run.elapsedMs - run.lastMatchAtMs <= comboWindowMs(run);
  const purityLive = run.features.has('purity') && run.purityChain > 0;
  const evolutionsOn = run.features.has('evolutions') && (run.armedRecipes.length > 0 || run.activeEvolutions.length > 0);
  const catalystOnBoard = run.board.some(c => c.hasEvolutionItem);
  const evolutionsLeft = run.evolutionCap - run.evolutionsTriggered;

  const keenEyeIds = useMemo(() => (run.passive.keenEyeCardId ? [run.passive.keenEyeCardId] : undefined), [run.passive.keenEyeCardId]);
  return (
    <Animated.View style={[st.root, { backgroundColor: biome.colors.sky, paddingTop: insets.top }, screenStyle]}>
      {/* ── HUD ─────────────────────────────────────────── */}
      <View style={st.hud} onLayout={e => setHudHeight(e.nativeEvent.layout.height)}>
        <View style={st.hudTop}>
          <TouchableOpacity onPress={() => setPaused(true)} style={st.pauseBtn} accessibilityLabel="Pause">
            <Text style={st.pauseText}>II</Text>
          </TouchableOpacity>

          <Animated.View style={[st.foePortrait, level.isBoss && { backgroundColor: COLORS.actionYellow }, foeStyle]}>
            <EnemyAvatar
              testID="adventure-run-enemy"
              enemy={{ name: run.foeName, icon: run.foeIcon, tier: run.foe.tier }}
              size={48}
              hp={run.foeHp}
              maxHp={run.foeMaxHp}
              mood={enemyMood}
              reaction={enemyConductor.reaction}
              interactive
            />
          </Animated.View>

          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={st.foeName} numberOfLines={1}>{run.foeName}</Text>
              {level.foes.length > 1 && <Text style={st.wave}>WAVE {run.wave + 1}/{level.foes.length}</Text>}
            </View>
            <View style={st.hpTrack}>
              <View style={[st.hpFill, { width: `${Math.max(0, hpPct * 100)}%`, backgroundColor: hpPct > 0.5 ? COLORS.impactRed : hpPct > 0.25 ? COLORS.impactOrange : '#E53935' }]} />
              <Text style={st.hpText}>{run.foeHp} / {run.foeMaxHp}</Text>
            </View>
            {ui.showInactivityBar && (
              <View style={st.idleTrack}>
                <View style={[st.idleFill, { width: `${Math.min(100, (ui.showInactivityBar.current / ui.showInactivityBar.max) * 100)}%` }]} />
              </View>
            )}
            <View style={st.counters}>
              <Text testID="run-total-damage" style={st.counter} accessibilityLabel={`${run.totalDamage} total damage`}>⚔ {run.totalDamage}</Text>
              {run.combo > 1 && comboLive && (
                <Text testID="run-combo" style={[st.counter, st.counterHot]}>COMBO ×{run.combo}</Text>
              )}
              {run.biggestHit > 0 && <Text testID="run-biggest-hit" style={st.counterDim}>best {run.biggestHit}</Text>}
            </View>
          </View>

          {/* Player's living fighter */}
          <FighterAvatar
            testID="adventure-run-fighter"
            character={run.fighter}
            size={46}
            health={fighterHealth}
            maxHealth={fighterMaxHealth}
            mood={fighterMood}
            reaction={conductor.reaction}
            streak={conductor.streak}
            framed
            interactive
          />

          <View style={st.floaters} pointerEvents="none">
            {floaters.map(f => <Floater key={f.id} spec={f} />)}
          </View>
        </View>

        <View style={st.hudRow}>
          <Hearts hearts={run.hearts} max={run.maxHearts} />
          {run.movesLeft !== null && (
            <View style={[st.stat, run.movesLeft <= 2 && st.statWarn]}>
              <Icon name="lorc/archery-target" size={16} color={INK} />
              <Text style={st.statText}>{run.movesLeft} moves</Text>
            </View>
          )}
          {secondsLeft !== null && (
            <View style={[st.stat, secondsLeft <= 10 && st.statWarn, ui.timerSpeedMultiplier && ui.timerSpeedMultiplier > 1 ? { borderColor: COLORS.impactOrange } : null]}>
              <Icon name="lorc/stopwatch" size={16} color={INK} />
              <Text style={st.statText}>{secondsLeft}s</Text>
            </View>
          )}
          {run.passives.map(id => <PassiveChip key={id} id={id} run={run} />)}
          {run.features.has('graces') && (
            <View style={st.stat}>
              <Icon name="lorc/clover" size={16} color={COLORS.logicTeal} />
              <Text style={st.statText}>{run.stats.graces}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {run.features.has('coins') && <CoinPill coins={run.coins} />}
          {run.features.has('hints') && (
            <TouchableOpacity
              testID="run-hint"
              onPress={() => run.stats.hints > 0 && !ui.disableManualHint && setHintTrigger(t => t + 1)}
              style={[st.hintBtn, (run.stats.hints <= 0 || ui.disableManualHint) && { opacity: 0.4 }]}
              accessibilityLabel="Use hint"
            >
              <Icon name="lorc/light-bulb" size={18} color={INK} />
              <Text style={st.statText}>{run.stats.hints}</Text>
            </TouchableOpacity>
          )}
        </View>

        {run.features.has('xp') && (
          <View style={st.xpTrack}>
            <View style={[st.xpFill, { width: `${(run.xp / xpNeed) * 100}%` }]} />
            <Text style={st.xpText}>LV {run.xpLevel + 1}</Text>
          </View>
        )}

        {/* Live Arcana, Escalating Purity, board effects & Evolution status strip */}
        {(run.arcana.length > 0 || purityLive || evolutionsOn || run.simplified || run.doubleNext > 0 || run.nextSetMultiplier > 1) && (
          <View style={st.synergyRow}>
            {run.arcana.map(id => (
              <View key={id} testID="run-arcana-chip" style={st.arcanaChip}>
                <Icon name={getArcana(id).icon} size={12} color={TONE.arcana} />
                <Text style={st.arcanaChipText}>{getArcana(id).numeral}</Text>
              </View>
            ))}
            {purityLive && (
              <View testID="run-purity-chip" style={[st.purityChip, run.purityChain >= 2 && st.purityChipHot]}>
                <Icon name="lorc/lightning-branches" size={12} color={run.purityChain >= 2 ? TONE.upside : INK} />
                <Text style={st.purityChipText}>
                  {run.purityChain >= 2 ? `Purity ×${run.purityChain}` : `Purity 1`} · &gt;{run.lastDiffCount} diff next
                </Text>
              </View>
            )}
            {run.doubleNext > 0 && (
              <View testID="run-double-chip" style={[st.purityChip, st.purityChipHot]}>
                <Text style={st.purityChipText}>NEXT TRIGGER ×2{run.doubleNext > 1 ? ` (${run.doubleNext})` : ''}</Text>
              </View>
            )}
            {run.nextSetMultiplier > 1 && (
              <View testID="run-charged-chip" style={[st.purityChip, { backgroundColor: '#FFE8CC', borderColor: COLORS.impactOrange }]}>
                <Text style={st.purityChipText}>NEXT SET ×{run.nextSetMultiplier}</Text>
              </View>
            )}
            {run.simplified && (
              <View testID="run-simplified-chip" style={[st.purityChip, st.purityChipHot]}>
                <Icon name="lorc/third-eye" size={12} color={TONE.upside} />
                <Text style={st.purityChipText}>
                  All {run.simplified.attribute} {String(run.simplified.value)} · {Math.ceil(run.simplified.remainingMs / 1000)}s
                </Text>
              </View>
            )}
            {evolutionsOn && (
              <View
                testID="run-evo-chip"
                accessibilityLabel={`${run.armedRecipes.length} evolutions armed, ${run.evolutionsTriggered} of ${run.evolutionCap} used, ${Math.round(run.evolutionLikelihood)} percent catalyst chance`}
                style={[st.evoChip, catalystOnBoard && st.evoChipReady, evolutionsLeft <= 0 && { opacity: 0.55 }]}
              >
                <Icon name="lorc/crystal-shine" size={12} color={catalystOnBoard ? INK : TONE.arcana} />
                <Text style={st.evoChipText} numberOfLines={1}>
                  {evolutionsLeft <= 0
                    ? `Evolutions ${run.evolutionsTriggered}/${run.evolutionCap}`
                    : catalystOnBoard
                      ? 'CATALYST! Match it to evolve'
                      : `${run.armedRecipes.length} armed · ${Math.round(run.evolutionLikelihood)}% · ${run.evolutionsTriggered}/${run.evolutionCap}`}
                </Text>
              </View>
            )}
            {run.activeEvolutions.map(a => {
              const recipe = recipeFor(a.id);
              return (
                <EvolutionRing
                  key={a.id}
                  icon={recipe?.icon ?? 'lorc/crystal-shine'}
                  name={recipe?.name ?? a.id}
                  remainingMs={a.remainingMs}
                  durationMs={a.durationMs}
                />
              );
            })}
          </View>
        )}

        <View style={[st.challenge, challenge.met && { backgroundColor: '#D4F4EE' }, challenge.failed && { opacity: 0.55 }]}>
          <Text style={st.challengeStar}>★★★</Text>
          <Text style={[st.challengeText, challenge.failed && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{challenge.text}</Text>
          {challenge.met && <Icon name="lorc/checked-shield" size={14} color={COLORS.logicTeal} />}
        </View>
      </View>

      {/* ── Board ───────────────────────────────────────── */}
      <View style={st.boardWrap}>
        {/* Evolution pulse: a glow behind the cards, never a card border */}
        {run.activeEvolutions.length > 0 && <EvolutionGlow />}
        {run.frozenMs > 0 && (
          <View style={st.frozen} pointerEvents="none">
            <Icon name="lorc/snowflake-1" size={18} color="#1D4ED8" />
            <Text style={st.frozenText}>FROZEN {Math.ceil(run.frozenMs / 1000)}s</Text>
          </View>
        )}
        <GameBoard
          cards={run.board}
          connections={run.connections}
          onMatch={handleMatch}
          onInvalidSelection={handleInvalid}
          playerStats={run.stats}
          weapons={run.weapons}
          isPlayerTurn={run.status === 'playing' && !paused && !tip}
          activeAttributes={run.attributes}
          onUseHint={handleUseHint}
          triggerHint={hintTrigger}
          onCardBurn={handleBurn}
          isPaused={!playing}
          lastMatchTime={lastMatchTime}
          autoPlayer={autoPlayer}
          enemy={run.foe}
          hideEnemyOverlay
          glowingCardIds={keenEyeIds}
          onSelectedCountChange={conductor.setSelectedCount}
          onBoardIdleChange={conductor.setIsBoardIdle}
        />
      </View>

      {banner && (
        <View style={[st.bannerWrap, { top: insets.top + hudHeight / 2 }]} pointerEvents="none">
          <EvolutionBanner
            name={banner.recipe?.name ?? 'Evolution'}
            icon={banner.recipe?.icon ?? 'lorc/crystal-shine'}
            text={banner.text}
            seq={banner.seq}
          />
        </View>
      )}
      <MegaFlash trigger={megaFlash} />

      {/* Tip: pauses the fight until accepted. The part it talks about stays lit. */}
      {tip && !ended && (() => {
        const hudBottom = insets.top + hudHeight;
        const aboutHud = tip.anchor !== 'bottom';
        return (
          <>
            {/* dim everything except what the tip is pointing at */}
            <View style={[st.tipDim, aboutHud ? { top: hudBottom, bottom: 0 } : { top: 0, height: hudBottom }]} />
            <View style={[st.tipWrap, aboutHud ? { top: hudBottom + 2 } : { bottom: Math.max(insets.bottom, 12) + 8 }]} pointerEvents="box-none">
              {aboutHud && <View style={st.tipArrow} />}
              <View style={st.tipCard}>
                <View style={st.tipRule} />
                <View style={st.tipBody}>
                  <View style={st.tipHead}>
                    <View style={st.tipIcon}><Icon name={tip.icon} size={22} color={INK} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.tipEyebrow}>{tip.label ?? 'Tip'}</Text>
                      <Text style={st.tipTitle}>{tip.title}</Text>
                    </View>
                  </View>
                  <Text style={st.tipText}>{tip.text}</Text>
                  <TouchableOpacity testID="tip-ok" onPress={() => { sfx('click'); setTips(q => q.slice(1)); }} style={st.tipBtn} activeOpacity={0.85}>
                    <Text style={st.tipBtnText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );
      })()}

      {run.status === 'pick' && (
        <WeaponPick
          title="LEVEL UP!"
          subtitle="Pick one for this fight"
          options={run.pickOptions}
          weaponBuilds={run.weaponBuilds}
          onPick={w => { sfx('confirm'); conductor.triggerPowerup(); dispatch({ type: 'PICK', weaponId: w.id }); }}
          onSkip={() => dispatch({ type: 'PICK', weaponId: null })}
        />
      )}

      {/* Between waves */}
      {run.status === 'intermission' && (
        <Intermission run={run} dispatch={dispatch} onPurchase={() => conductor.triggerPowerup()} />
      )}

      <Modal visible={paused} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={st.overlay}>
          <PopIn style={st.panel}>
            <Text style={st.panelTitle}>PAUSED</Text>
            <Text style={st.panelSub}>{level.id} · {level.name}</Text>
            {run.weapons.length > 0 && (
              <View style={st.gearRow}>
                {run.weapons.map((w, i) => {
                  const level = run.weaponBuilds[w.id]?.level ?? 1;
                  return (
                    <View key={i} style={st.gearChip}>
                      <WeaponAvatar weapon={w} size={20} interactive />
                      <Text style={st.gearText} numberOfLines={1}>{w.name}{weaponLevelSuffix(level)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Btn label="Resume" onPress={() => setPaused(false)} />
            <Btn label="Restart" variant="secondary" onPress={() => { setPaused(false); onRestart(); }} />
            <Btn label="Retreat to map" variant="secondary" onPress={() => { setPaused(false); music.stop(); onQuit(); }} />
            <Text style={st.panelHint}>Retreating forfeits this attempt, including the coins you've collected in it.</Text>
          </PopIn>
        </View>
      </Modal>
    </Animated.View>
  );
};

/** Base tuning for a passive number (skill nodes can move it; the chips are a guide, the engine decides). */
const tune = (id: PassiveId, key: string): number => (PASSIVE_TUNING[id] as Record<string, number>)[key] ?? 0;

const comboWindowMs = (run: RunState): number =>
  comboWindowFor(run.passives.includes('combo') ? tune('combo', 'combo.windowMs') : DEFAULT_COMBO_WINDOW_MS, run.attributes.length);

/** One passive's live state. Lit when it is about to matter. */
const PassiveChip: React.FC<{ id: PassiveId; run: RunState }> = ({ id, run }) => {
  const def = getPassive(id);
  const p = run.passive;
  const sinceSet = run.elapsedMs - run.lastMatchAtMs;
  let label = '';
  let lit = false;
  switch (id) {
    case 'nine_lives': label = p.nineLivesLeft > 0 ? `${p.nineLivesLeft} life` : 'used'; lit = p.nineLivesLeft > 0; break;
    case 'scrappy': {
      const missing = run.hearts !== null && run.maxHearts !== null ? run.maxHearts - run.hearts : 0;
      label = missing > 0 ? `+${missing * tune('scrappy', 'scrappy.perHeart')}` : '+0'; lit = missing > 0; break;
    }
    case 'combo': {
      const live = run.combo > 0 && sinceSet <= comboWindowMs(run);
      label = live ? `×${run.combo}` : 'combo'; lit = live; break;
    }
    case 'hot_streak': label = p.hotStreak ? '×2 ready' : 'streak'; lit = p.hotStreak; break;
    case 'grudge': label = p.grudge > 0 ? `+${p.grudge * tune('grudge', 'grudge.damage')}` : 'calm'; lit = p.grudge > 0; break;
    case 'thick_hide': label = p.thickHideLeft > 0 ? `${p.thickHideLeft} free` : 'spent'; lit = p.thickHideLeft > 0; break;
    case 'patience': {
      const wait = tune('patience', 'patience.msPerTrait') * run.attributes.length - sinceSet;
      label = run.matches === 0 || wait <= 0 ? 'ready' : `${Math.ceil(wait / 1000)}s`; lit = run.matches > 0 && wait <= 0; break;
    }
    case 'deep_freeze': label = run.frozenMs > 0 ? `${Math.ceil(run.frozenMs / 1000)}s` : 'rainbow'; lit = run.frozenMs > 0; break;
    case 'zoomies': label = `in ${p.zoomiesIn}`; lit = p.zoomiesIn <= 1; break;
    case 'fetch': label = 'fetch'; lit = false; break;
    case 'big_scoop': label = `in ${p.scoopIn}`; lit = p.scoopIn <= 1; break;
    case 'keen_eye': label = p.keenEyeCardId ? 'look!' : 'eye'; lit = !!p.keenEyeCardId; break;
  }
  return (
    <View testID={`run-passive-${id}`} style={[st.stat, lit && { backgroundColor: '#FFF1C7' }, !lit && { opacity: 0.6 }]} accessibilityLabel={`${def.name}: ${label}`}>
      <Icon name={def.icon} size={15} color={INK} />
      <Text style={st.statText}>{label}</Text>
    </View>
  );
};

/** Soft pulsing glow behind the board while an evolution runs. */
const EvolutionGlow: React.FC = () => {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.6, { duration: 500 }), withTiming(0.25, { duration: 500 })), -1);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID="evolution-glow" pointerEvents="none" style={[st.glow, style]} />;
};

const Hearts: React.FC<{ hearts: number | null; max: number | null }> = ({ hearts, max }) => {
  if (hearts === null || max === null) {
    return (
      <View style={st.stat}>
        <Heart />
        <Text style={st.statText}>∞</Text>
      </View>
    );
  }
  if (max > 6) {
    return (
      <View style={st.stat}>
        <Heart />
        <Text style={st.statText}>{hearts}/{max}</Text>
      </View>
    );
  }
  return (
    <View style={[st.stat, { gap: 1 }]} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} size={17} filled={i < hearts} />
      ))}
    </View>
  );
};

const WeaponPick: React.FC<{ title: string; subtitle: string; options: Weapon[]; weaponBuilds?: WeaponBuilds; onPick: (w: Weapon) => void; onSkip: () => void }> = ({ title, subtitle, options, weaponBuilds, onPick, onSkip }) => (
  <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
    <View style={st.overlay}>
      <PopIn style={st.panel}>
        <Eyebrow text={title} />
        <Text style={st.panelSub}>{subtitle}</Text>
        {options.map((w, i) => {
          const level = weaponBuilds?.[w.id]?.level ?? 1;
          return (
            <TouchableOpacity key={`${w.id}-${i}`} testID={`pick-${i}`} onPress={() => onPick(w)} style={st.pickCard} activeOpacity={0.85}>
              <View style={[st.pickIcon, { backgroundColor: COLORS.paperBeige }]}><WeaponAvatar weapon={w} size={34} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.pickName}>{w.name} <Text style={[st.pickRarity, { color: TONE.spent }]}>LV {level}</Text></Text>
                <Text style={st.pickDesc}>{w.shortDescription}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <Btn label="Skip" variant="ghost" small onPress={onSkip} />
      </PopIn>
    </View>
  </Modal>
);

const Intermission: React.FC<{ run: RunState; dispatch: (a: RunAction) => void; onPurchase?: () => void }> = ({ run, dispatch, onPurchase }) => {
  const hasShop = run.features.has('shop');
  const next = run.level.foes[run.wave + 1];
  const nextDisplay = next ? foeDisplay(next) : null;
  const [tapTriggers, setTapTriggers] = useState<Record<number, number>>({});
  return (
    <Modal visible transparent animationType="fade">
      <View style={st.overlay}>
        <PopIn style={st.panel}>
          <Eyebrow text={`Wave ${run.wave + 1} cleared!`} color="#9BE3D8" />
          <Text style={st.panelTitle}>{hasShop ? 'SHOP' : 'Catch your breath'}</Text>
          {hasShop && (
            <>
              <Text style={st.panelSub}>Buy gear for this fight, or bank every coin for Camp.</Text>
              <CoinPill coins={run.coins} style={{ alignSelf: 'center' }} />
              <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
                {run.shopOptions.map((w, i) => {
                  const price = shopPrice(w);
                  const afford = run.coins >= price;
                  return (
                    <TouchableOpacity
                      key={`${w.id}-${i}`}
                      testID={`shop-buy-${i}`}
                      onPress={() => {
                        setTapTriggers(prev => ({ ...prev, [i]: (prev[i] ?? 0) + 1 }));
                        if (afford) {
                          sfx('coin');
                          onPurchase?.();
                          dispatch({ type: 'BUY', index: i });
                        }
                      }}
                      style={[st.pickCard, { opacity: afford ? 1 : 0.5 }]}
                      activeOpacity={0.85}
                    >
                      <View style={st.pickIcon}><WeaponAvatar weapon={w} size={34} triggerKey={tapTriggers[i]} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.pickName}>{w.name}{weaponLevelSuffix(run.weaponBuilds[w.id]?.level ?? 1)}</Text>
                        <Text style={st.pickDesc}>{w.shortDescription}</Text>
                      </View>
                      <CoinPill coins={price} />
                    </TouchableOpacity>
                  );
                })}
                {run.shopOptions.length === 0 && <Text style={st.panelSub}>Sold out!</Text>}
              </ScrollView>
              <Btn small variant="secondary" label={`Reroll (${rerollCost(run)}¢)`} disabled={run.coins < rerollCost(run)} onPress={() => dispatch({ type: 'REROLL' })} />
            </>
          )}
          {next && nextDisplay && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <EnemyAvatar enemy={nextDisplay} size={30} mood="menacing" lightweight />
              <Text style={st.panelSub}>Next: {nextDisplay.name} · {next.hp} HP</Text>
            </View>
          )}
          <Btn testID="next-wave" label="Next wave" icon="lorc/crossed-swords" onPress={() => { sfx('wave'); dispatch({ type: 'NEXT_WAVE' }); }} />
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  hud: { backgroundColor: COLORS.canvasWhite, borderBottomWidth: 2, borderBottomColor: INK, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, gap: 6 },
  hudTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pauseBtn: { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pauseText: { fontWeight: '900', color: INK, letterSpacing: -1 },
  foePortrait: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderBottomWidth: 5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  foeName: { fontWeight: '900', fontSize: 15, color: INK, flexShrink: 1 },
  wave: { fontWeight: '900', fontSize: 11, color: INK, letterSpacing: 1 },
  hpTrack: { height: 20, borderRadius: 4, borderWidth: 2, borderColor: INK, backgroundColor: '#F1E9E0', overflow: 'hidden', justifyContent: 'center' },
  hpFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  hpText: { textAlign: 'center', fontWeight: '900', fontSize: 11, color: INK, fontVariant: ['tabular-nums'] },
  idleTrack: { height: 5, borderRadius: 3, backgroundColor: '#EEE', overflow: 'hidden' },
  idleFill: { height: '100%', backgroundColor: COLORS.impactOrange },
  floaters: { position: 'absolute', left: 120, top: 0, alignItems: 'flex-start' },
  counters: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counter: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  counterHot: { color: COLORS.impactOrange },
  counterDim: { fontSize: 10, fontWeight: '700', color: TONE.spent, fontVariant: ['tabular-nums'] },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, backgroundColor: '#FDE68A' },
  bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 250 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.canvasWhite },
  statWarn: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  statText: { fontWeight: '900', color: INK, fontSize: 13, fontVariant: ['tabular-nums'] },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: 2, borderBottomWidth: 3, borderColor: INK, backgroundColor: COLORS.actionYellow },
  xpTrack: { height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, overflow: 'hidden', justifyContent: 'center' },
  xpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#7AC8FF' },
  xpText: { fontSize: 9, fontWeight: '900', color: INK, textAlign: 'center' },
  synergyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  arcanaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TONE.arcanaPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 7, paddingVertical: 2 },
  arcanaChipText: { fontSize: 10, fontWeight: '900', color: TONE.arcana },
  purityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.paperBeige, borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 },
  purityChipHot: { backgroundColor: '#CCFBF1', borderColor: TONE.upside },
  purityChipText: { fontSize: 10, fontWeight: '800', color: INK },
  evoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TONE.comboPale, borderRadius: 999, borderWidth: 1.5, borderColor: TONE.arcana, paddingHorizontal: 7, paddingVertical: 2 },
  evoChipReady: { backgroundColor: COLORS.actionYellow, borderColor: INK },
  evoChipText: { fontSize: 10, fontWeight: '900', color: INK },
  frozen: { position: 'absolute', top: 10, alignSelf: 'center', zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  frozenText: { fontWeight: '900', color: '#1D4ED8', letterSpacing: 1 },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.paperBeige, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  challengeStar: { color: '#E0A800', fontSize: 11, fontWeight: '900' },
  challengeText: { flex: 1, fontSize: 12, fontWeight: '700', color: INK },
  boardWrap: { flex: 1, padding: 6 },
  tipDim: { position: 'absolute', left: 0, right: 0, zIndex: 299, backgroundColor: 'rgba(10,10,10,0.5)' },
  tipWrap: { position: 'absolute', left: 0, right: 0, zIndex: 300, alignItems: 'center', paddingHorizontal: 12 },
  tipArrow: { width: 18, height: 18, backgroundColor: COLORS.actionYellow, transform: [{ rotate: '45deg' }], marginBottom: -11, alignSelf: 'flex-start', marginLeft: 70 },
  tipCard: { width: '100%', maxWidth: 460, backgroundColor: DARK.panel, borderRadius: 14, borderWidth: 1, borderColor: DARK.goldEdge(0.4), overflow: 'hidden' },
  tipRule: { height: 4, backgroundColor: COLORS.actionYellow },
  tipBody: { padding: 16, gap: 12 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  tipEyebrow: { color: COLORS.actionYellow, fontWeight: '800', letterSpacing: 2, fontSize: 10, textTransform: 'uppercase' },
  tipTitle: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 20 },
  tipText: { color: DARK.text, fontSize: 16, lineHeight: 23 },
  tipBtn: { backgroundColor: COLORS.actionYellow, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  tipBtnText: { color: INK, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 18, gap: 10 },
  panelTitle: { fontSize: 24, fontWeight: '900', color: INK, textAlign: 'center' },
  panelSub: { fontSize: 14, color: INK, textAlign: 'center', opacity: 0.85 },
  panelHint: { fontSize: 12, color: INK, opacity: 0.6, textAlign: 'center' },
  gearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  gearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 160 },
  gearText: { fontSize: 11, fontWeight: '800', color: INK },
  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2.5, borderBottomWidth: 4, borderRadius: 10, padding: 10, backgroundColor: COLORS.canvasWhite },
  pickIcon: { width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  pickName: { fontWeight: '900', color: INK, fontSize: 15 },
  pickRarity: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pickDesc: { fontSize: 13, color: INK, opacity: 0.85 },
});

export default AdventureRun;
