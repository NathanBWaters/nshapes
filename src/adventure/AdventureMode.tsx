/**
 * Adventure Mode root: map ⇄ preview ⇄ lesson ⇄ run ⇄ results ⇄ unlock reveals,
 * plus Camp and the Field Guide. Owns the save and persists every change.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { music, setMusicEnabled, setSfxOverride, sfx } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AdventureSave, FeatureDestination, LevelDef, MechanicDef, RunState } from './types';
import { MAIN_LEVELS, getLevel, mainIndexOf } from './data/levels';
import { CAMPAIGN_FEATURES } from './data/features';
import { MECHANICS } from './data/mechanics';
import { STORY } from './data/story';
import {
  applyLevelResult,
  equipArcana,
  equipCharm,
  isLevelUnlocked,
  markCoachMarkSeen,
  markMechanicSeen,
  toggleArcana,
  toggleCharm,
  type ResultApplication,
  type Unlock,
} from './progress';
import { isFirstVisit, lessonsDueBefore, type LessonPlan } from './lessons';
import { loadAdventureSave, writeAdventureSave } from './save';
import { computeStars } from './engine/run';
import { randomSeed } from './engine/rng';
import AdventureMap from './components/AdventureMap';
import LevelPreview from './components/LevelPreview';
import MechanicIntro from './components/MechanicIntro';
import AdventureRun from './components/AdventureRun';
import LevelResults from './components/LevelResults';
import UnlockReveal from './components/UnlockReveal';
import Camp, { type CampTab } from './components/Camp';
import FieldGuide from './components/FieldGuide';
import BountyBoard from './components/BountyBoard';
import { starsLandedMs } from './components/ui';

type Screen =
  | { kind: 'map'; highlight?: string | null }
  | { kind: 'run'; levelId: string; seed: number }
  | { kind: 'results'; levelId: string; run: RunState; stars: number; result: ResultApplication }
  | { kind: 'camp'; tab?: CampTab }
  | { kind: 'guide' }
  | { kind: 'bounties' };

/** Lessons still to play before a fight starts; the first one is on screen. */
interface Teaching {
  plans: LessonPlan[];
  level: LevelDef;
}

const screenFor = (d: FeatureDestination): Screen =>
  d.screen === 'camp' ? { kind: 'camp', tab: d.tab } : { kind: 'bounties' };

/** First visit ever: story → lessons → "Is this a Set?" checks → straight into the first level. */
const onboarding = (save: AdventureSave): Teaching | null => {
  const first = MAIN_LEVELS[0];
  if (!isFirstVisit(save)) return null;
  const [lesson, ...rest] = lessonsDueBefore(first, save);
  return { plans: [{ ...lesson, prelude: STORY.welcome }, ...rest], level: first };
};

interface Props {
  onExit: () => void;
  autoPlayer?: boolean;
  /** Dev: start with a specific save */
  initialSave?: AdventureSave;
}

const AdventureMode: React.FC<Props> = ({ onExit, autoPlayer, initialSave }) => {
  const [save, setSaveState] = useState<AdventureSave>(() => initialSave ?? loadAdventureSave());
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });
  const reducedMotion = useReducedMotion();
  const [preview, setPreview] = useState<LevelDef | null>(null);
  const [teaching, setTeaching] = useState<Teaching | null>(() => onboarding(save));
  /** A mechanic opened just to read about it (no fight follows) */
  const [reference, setReference] = useState<MechanicDef | null>(null);
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);
  const [unlocksRevealed, setUnlocksRevealed] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const setSave = useCallback((next: AdventureSave | ((s: AdventureSave) => AdventureSave)) => {
    setSaveState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      writeAdventureSave(value);
      return value;
    });
  }, []);

  // One switch for the whole score: in Adventure the effects are part of the music
  // (src/audio/band.ts), so the map's sound button turns both on and off.
  useEffect(() => {
    setMusicEnabled(save.musicOn);
    setSfxOverride(save.musicOn);
  }, [save.musicOn]);
  useEffect(() => () => setSfxOverride(null), []);

  // Map / camp music
  useEffect(() => {
    if (screen.kind === 'map' || screen.kind === 'camp' || screen.kind === 'guide' || screen.kind === 'bounties') music.play('map');
  }, [screen.kind]);

  const clearPendingTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => {
    music.stop();
    clearPendingTimers();
  }, [clearPendingTimers]);

  const startRun = useCallback((level: LevelDef) => {
    clearPendingTimers();
    setUnlocks([]);
    setUnlocksRevealed(true);
    setScreen({ kind: 'run', levelId: level.id, seed: randomSeed() });
  }, [clearPendingTimers]);

  const handlePlay = (level: LevelDef) => {
    sfx('confirm');
    setPreview(null);
    const plans = lessonsDueBefore(level, save);
    if (plans.length > 0) setTeaching({ plans, level });
    else startRun(level);
  };

  /** The lesson on screen was accepted: record it, then show the next one or start the fight. */
  const finishLesson = ({ plans: [done, ...rest], level }: Teaching) => {
    setSave(s => done.marks.reduce(markMechanicSeen, s));
    if (rest.length > 0) setTeaching({ plans: rest, level });
    else {
      setTeaching(null);
      startRun(level);
    }
  };

  const handleFinish = (level: LevelDef, run: RunState) => {
    const stars = computeStars(run);
    const result = applyLevelResult(save, level, stars, run.coins, run);
    setSave(result.save);
    setScreen({ kind: 'results', levelId: level.id, run, stars, result });
    if (result.unlocks.length > 0) {
      // Let the stars land first, then give each unlock its own moment
      setUnlocksRevealed(false);
      timers.current.push(setTimeout(() => setUnlocks(result.unlocks), starsLandedMs(stars)));
    } else {
      setUnlocksRevealed(true);
    }
  };

  /** Next stop on the main path (an elite branch leads back to the map). */
  const nextLevelAfter = (level: LevelDef): LevelDef | null =>
    level.branchOf ? null : MAIN_LEVELS[mainIndexOf(level) + 1] ?? null;

  let body: React.ReactNode = null;
  if (screen.kind === 'map') {
    body = (
      <AdventureMap
        save={save}
        highlightLevelId={screen.highlight}
        onSelectLevel={l => { sfx('click'); setPreview(l); }}
        onOpenCamp={() => { sfx('confirm'); setScreen({ kind: 'camp' }); }}
        onOpenGuide={() => { sfx('confirm'); setScreen({ kind: 'guide' }); }}
        onOpenBounties={() => { sfx('confirm'); setScreen({ kind: 'bounties' }); }}
        onExit={() => { music.stop(); onExit(); }}
        musicOn={save.musicOn}
        onToggleMusic={() => setSave(s => ({ ...s, musicOn: !s.musicOn }))}
      />
    );
  } else if (screen.kind === 'run') {
    const level = getLevel(screen.levelId);
    body = (
      <AdventureRun
        key={`${screen.levelId}-${screen.seed}`}
        level={level}
        save={save}
        seed={screen.seed}
        autoPlayer={autoPlayer}
        onFinish={run => handleFinish(level, run)}
        onQuit={() => setScreen({ kind: 'map', highlight: level.id })}
        onRestart={() => startRun(level)}
        onCoachMarkSeen={id => setSave(s => markCoachMarkSeen(s, id))}
        effects={save.effectsOn && !reducedMotion}
        // A device that asks for reduced motion keeps effects off
        onToggleEffects={reducedMotion ? undefined : () => setSave(s => ({ ...s, effectsOn: !s.effectsOn }))}
      />
    );
  } else if (screen.kind === 'results') {
    const level = getLevel(screen.levelId);
    const next = nextLevelAfter(level);
    body = (
      <LevelResults
        level={level}
        run={screen.run}
        stars={screen.stars}
        result={screen.result}
        unlocksRevealed={unlocksRevealed}
        nextLevel={next}
        nextUnlocked={!!next && isLevelUnlocked(save, next)}
        onRetry={() => startRun(level)}
        onNext={() => next && setPreview(next)}
        onMap={() => { clearPendingTimers(); setUnlocks([]); setScreen({ kind: 'map', highlight: next && isLevelUnlocked(save, next) ? next.id : level.id }); }}
        onCamp={() => {
          clearPendingTimers();
          setUnlocks([]);
          // Land on the Camp tab this result just unlocked, if any
          const tab = screen.result.unlocks.flatMap(u => {
            const d = u.kind === 'feature' ? CAMPAIGN_FEATURES[u.feature].open?.destination : undefined;
            return d?.screen === 'camp' ? [d.tab] : [];
          })[0];
          setScreen({ kind: 'camp', tab });
        }}
        onBounties={() => { clearPendingTimers(); setUnlocks([]); setScreen({ kind: 'bounties' }); }}
      />
    );
  } else if (screen.kind === 'camp') {
    body = <Camp save={save} initialTab={screen.tab} onChange={setSave} onClose={() => setScreen({ kind: 'map' })} />;
  } else if (screen.kind === 'guide') {
    body = <FieldGuide save={save} onClose={() => setScreen({ kind: 'map' })} />;
  } else if (screen.kind === 'bounties') {
    body = <BountyBoard save={save} onClose={() => setScreen({ kind: 'map' })} />;
  }

  return (
    <View style={st.root}>
      {body}
      <LevelPreview
        level={preview}
        save={save}
        onClose={() => setPreview(null)}
        onPlay={handlePlay}
        onSelectFighter={f => { sfx('click'); setSave(s => ({ ...s, selectedFighter: f })); }}
        onSelectCharm={id => { sfx('click'); setSave(s => toggleCharm(s, id)); }}
        onSelectArcana={id => { sfx('click'); setSave(s => toggleArcana(s, id)); }}
        onShowMechanic={id => setReference(MECHANICS[id])}
      />
      {teaching ? (
        <MechanicIntro
          mechanic={teaching.plans[0].mechanic}
          prelude={teaching.plans[0].prelude}
          cta={teaching.plans.length > 1 ? `Next: ${teaching.plans[1].mechanic.title}` : 'Start the fight'}
          onClose={() => finishLesson(teaching)}
        />
      ) : (
        <MechanicIntro mechanic={reference} cta="Close" quiz={false} dismissible onClose={() => setReference(null)} />
      )}
      {unlocks.length > 0 && (
        <UnlockReveal
          unlocks={unlocks}
          save={save}
          onUseFighter={name => setSave(s => ({ ...s, selectedFighter: name }))}
          onEquipCharm={id => setSave(s => equipCharm(s, id))}
          onEquipArcana={id => setSave(s => equipArcana(s, id))}
          onOpenFeature={feature => {
            const open = CAMPAIGN_FEATURES[feature].open;
            if (open) setScreen(screenFor(open.destination));
          }}
          onDone={() => {
            setUnlocks([]);
            setUnlocksRevealed(true);
          }}
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({ root: { flex: 1 } });

export default AdventureMode;
