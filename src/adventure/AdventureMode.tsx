/**
 * Adventure Mode root: map ⇄ preview ⇄ intro ⇄ run ⇄ results, plus Camp
 * and the Field Guide. Owns the save and persists every change.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { CharacterName } from '@/types';
import { music, setMusicEnabled, unlockAudio, sfx } from '@/audio';
import type { AdventureSave, LevelDef, MechanicDef, RunState } from './types';
import { LEVELS, getLevel } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { getFighter } from './data/fighters';
import { applyLevelResult, isLevelUnlocked, markCoachMarkSeen, markMechanicSeen, type ResultApplication } from './progress';
import { loadAdventureSave, writeAdventureSave } from './save';
import { computeStars } from './engine/run';
import { randomSeed } from './engine/rng';
import AdventureMap from './components/AdventureMap';
import LevelPreview from './components/LevelPreview';
import MechanicIntro from './components/MechanicIntro';
import AdventureRun from './components/AdventureRun';
import LevelResults from './components/LevelResults';
import Camp from './components/Camp';
import FieldGuide from './components/FieldGuide';

type Screen =
  | { kind: 'map'; highlight?: string | null }
  | { kind: 'run'; levelId: string; seed: number; attempt: number }
  | { kind: 'results'; levelId: string; run: RunState; stars: number; result: ResultApplication }
  | { kind: 'camp' }
  | { kind: 'guide' };

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
  const [intro, setIntro] = useState<{ mechanic: MechanicDef; eyebrow?: string; cta?: string; then?: () => void } | null>(null);

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
    if (screen.kind === 'map' || screen.kind === 'camp' || screen.kind === 'guide') music.play('map');
  }, [screen.kind]);

  useEffect(() => () => music.stop(), []);

  const startRun = (level: LevelDef, attempt = 0) => {
    setScreen({ kind: 'run', levelId: level.id, seed: randomSeed(), attempt });
  };

  const handlePlay = (level: LevelDef, _fighter: CharacterName) => {
    sfx('confirm');
    setPreview(null);
    if (!save.seenMechanics.includes(level.introduces)) {
      setIntro({
        mechanic: MECHANICS[level.introduces],
        cta: "Let's go!",
        then: () => {
          setSave(s => markMechanicSeen(s, level.introduces));
          startRun(level);
        },
      });
    } else {
      startRun(level);
    }
  };

  const handleFinish = (level: LevelDef, run: RunState) => {
    const stars = computeStars(run);
    const result = applyLevelResult(save, level, stars, run.coins);
    setSave(result.save);
    setScreen({ kind: 'results', levelId: level.id, run, stars, result });
    // Celebrate any newly unlocked fighter
    const newFighter = result.granted.find(g => g.reward.character)?.reward.character;
    if (newFighter) {
      const f = getFighter(newFighter);
      setTimeout(() => {
        sfx('unlock');
        setIntro({ mechanic: MECHANICS[f.signature], eyebrow: 'New fighter unlocked!', cta: 'Welcome aboard!' });
      }, 2200);
    }
  };

  const nextLevelAfter = (level: LevelDef): LevelDef | null => LEVELS[level.index + 1] ?? null;

  let body: React.ReactNode = null;
  if (screen.kind === 'map') {
    body = (
      <AdventureMap
        save={save}
        highlightLevelId={screen.highlight}
        onSelectLevel={l => { sfx('click'); setPreview(l); }}
        onOpenCamp={() => { sfx('confirm'); setScreen({ kind: 'camp' }); }}
        onOpenGuide={() => { sfx('confirm'); setScreen({ kind: 'guide' }); }}
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
        nextLevel={next}
        nextUnlocked={!!next && isLevelUnlocked(save, next)}
        onRetry={() => startRun(level)}
        onNext={() => next && setPreview(next)}
        onMap={() => setScreen({ kind: 'map', highlight: next && isLevelUnlocked(save, next) ? next.id : level.id })}
        onCamp={() => setScreen({ kind: 'camp' })}
      />
    );
  } else if (screen.kind === 'camp') {
    body = <Camp save={save} onChange={setSave} onClose={() => setScreen({ kind: 'map' })} />;
  } else if (screen.kind === 'guide') {
    body = <FieldGuide save={save} onClose={() => setScreen({ kind: 'map' })} />;
  }

  return (
    <View style={st.root} onTouchStart={unlockAudio}>
      {body}
      <LevelPreview
        level={preview}
        save={save}
        onClose={() => setPreview(null)}
        onPlay={handlePlay}
        onSelectFighter={f => { sfx('click'); setSave(s => ({ ...s, selectedFighter: f })); }}
        onShowMechanic={id => setIntro({ mechanic: MECHANICS[id], cta: 'Close' })}
      />
      <MechanicIntro
        mechanic={intro?.mechanic ?? null}
        eyebrowOverride={intro?.eyebrow}
        cta={intro?.cta}
        onClose={() => {
          const then = intro?.then;
          setIntro(null);
          then?.();
        }}
      />
    </View>
  );
};

const st = StyleSheet.create({ root: { flex: 1 } });

export default AdventureMode;
