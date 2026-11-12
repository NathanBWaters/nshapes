/**
 * Adventure Mode root: map ⇄ preview ⇄ lesson ⇄ run ⇄ results ⇄ unlock reveals,
 * plus Camp and the Field Guide. Owns the save and persists every change.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { CharacterName } from '@/types';
import { music, setMusicEnabled, sfx } from '@/audio';
import type { AdventureSave, LessonPage, LevelDef, MechanicDef, RunState } from './types';
import { MAIN_LEVELS, getLevel, mainIndexOf } from './data/levels';
import { COMBO_DISCOVERY_SEEN_ID, MECHANICS, buildAdaptiveEvolutionMechanic, buildComboDiscoveryPages } from './data/mechanics';
import { STORY } from './data/story';
import { applyLevelResult, equipArcana, equipCharm, isLevelUnlocked, markCoachMarkSeen, markMechanicSeen, type ResultApplication, type Unlock } from './progress';
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

type Screen =
  | { kind: 'map'; highlight?: string | null }
  | { kind: 'run'; levelId: string; seed: number; attempt: number }
  | { kind: 'results'; levelId: string; run: RunState; stars: number; result: ResultApplication }
  | { kind: 'camp'; tab?: CampTab }
  | { kind: 'guide' }
  | { kind: 'bounties' };

interface LessonRequest {
  mechanic: MechanicDef;
  cta?: string;
  quiz?: boolean;
  prelude?: LessonPage[];
  dismissible?: boolean;
  then?: () => void;
}

interface Props {
  onExit: () => void;
  autoPlayer?: boolean;
  /** Dev: start with a specific save */
  initialSave?: AdventureSave;
}

const AdventureMode: React.FC<Props> = ({ onExit, autoPlayer, initialSave }) => {
  const [save, setSaveState] = useState<AdventureSave>(() => initialSave ?? loadAdventureSave());
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });
  const [preview, setPreview] = useState<LevelDef | null>(null);
  const [lesson, setLesson] = useState<LessonRequest | null>(null);
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

  useEffect(() => {
    setMusicEnabled(save.musicOn);
  }, [save.musicOn]);

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

  const startRun = useCallback((level: LevelDef, attempt = 0) => {
    clearPendingTimers();
    setUnlocks([]);
    setUnlocksRevealed(true);
    setScreen({ kind: 'run', levelId: level.id, seed: randomSeed(), attempt });
  }, [clearPendingTimers]);

  /** Teach a level's mechanic the first time, then fight. */
  const teachThenFight = useCallback((level: LevelDef, prelude?: LessonPage[]) => {
    setLesson({
      mechanic: MECHANICS[level.introduces],
      cta: 'Start the fight',
      prelude,
      then: () => {
        setSave(s => markMechanicSeen(s, level.introduces));
        startRun(level);
      },
    });
  }, [setSave, startRun]);

  // First visit ever: story → lessons → "Is this a Set?" checks → straight into 1-1
  useEffect(() => {
    const first = MAIN_LEVELS[0];
    if (Object.keys(save.plays).length === 0 && !save.seenMechanics.includes(first.introduces)) {
      teachThenFight(first, STORY.welcome);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = (level: LevelDef, _fighter: CharacterName) => {
    sfx('confirm');
    setPreview(null);
    const discoveryPages = buildComboDiscoveryPages(level.id, save);
    const needsIntro = !save.seenMechanics.includes(level.introduces);
    const needsEvoTutorial =
      !level.rules.noGear &&
      save.unlockedEvolutions.length > 0 &&
      !save.seenMechanics.includes('weapon_evolutions');

    const launchEvoThenFight = () => {
      setLesson({
        mechanic: buildAdaptiveEvolutionMechanic(save),
        cta: 'Start the fight',
        then: () => {
          setSave(s => markMechanicSeen(s, 'weapon_evolutions'));
          startRun(level);
        },
      });
    };

    if (needsIntro) {
      setLesson({
        mechanic: MECHANICS[level.introduces],
        cta: needsEvoTutorial ? 'Next: Weapon Combos' : 'Start the fight',
        prelude: discoveryPages.length > 0 ? discoveryPages : undefined,
        then: () => {
          setSave(s => {
            let updated = markMechanicSeen(s, level.introduces);
            if (discoveryPages.length > 0) updated = markMechanicSeen(updated, COMBO_DISCOVERY_SEEN_ID);
            return updated;
          });
          if (needsEvoTutorial) launchEvoThenFight();
          else startRun(level);
        },
      });
    } else if (needsEvoTutorial) {
      launchEvoThenFight();
    } else {
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
      timers.current.push(setTimeout(() => setUnlocks(result.unlocks), 600 + stars * 450));
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
        onRestart={() => startRun(level, screen.attempt + 1)}
        onCoachMarkSeen={id => setSave(s => markCoachMarkSeen(s, id))}
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
          const unlockedWorkshop = screen.result.unlocks.some(u => u.kind === 'feature' && u.feature === 'workshop');
          setScreen({ kind: 'camp', tab: unlockedWorkshop ? 'workshop' : undefined });
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
        onSelectCharm={id => { sfx('click'); setSave(s => equipCharm(s, id)); }}
        onSelectArcana={id => { sfx('click'); setSave(s => equipArcana(s, id)); }}
        onShowMechanic={id => setLesson({ mechanic: MECHANICS[id], cta: 'Close', quiz: false, dismissible: true })}
      />
      <MechanicIntro
        mechanic={lesson?.mechanic ?? null}
        cta={lesson?.cta}
        quiz={lesson?.quiz}
        prelude={lesson?.prelude}
        dismissible={lesson?.dismissible}
        onClose={() => {
          const then = lesson?.then;
          setLesson(null);
          then?.();
        }}
      />
      {unlocks.length > 0 && (
        <UnlockReveal
          unlocks={unlocks}
          save={save}
          onUseFighter={name => setSave(s => ({ ...s, selectedFighter: name }))}
          onEquipCharm={id => setSave(s => equipCharm(s, id))}
          onEquipArcana={id => setSave(s => equipArcana(s, id))}
          onOpenBounties={() => setScreen({ kind: 'bounties' })}
          onOpenWorkshop={() => setScreen({ kind: 'camp', tab: 'workshop' })}
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
