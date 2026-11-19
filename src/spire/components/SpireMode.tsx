/**
 * Starfall Spire — Root Mode Coordinator.
 *
 * Self-contained screen router for the roguelike climb:
 *   setup ⇄ map ⇄ preview ⇄ fight (shared AdventureRun!) ⇄ reward / shop /
 *   campfire / event / treasure ⇄ victory (→ Endless!) / defeat.
 *
 * Persists every decision automatically to MMKV and syncs newly discovered
 * Evolution recipes back into Adventure Mode's shared Recipe Guide!
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CharacterName } from '@/types';
import { music, setMusicEnabled, setSfxOverride } from '@/audio';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import AdventureRun from '@/adventure/components/AdventureRun';
import type { RunState } from '@/adventure/types';
import {
  buildSpireWeaponBuilds,
  SPIRE_FIGHT_FEATURES,
  spireEncounterToLevel,
  spireHeldWeapons,
  spireRunOverrides,
  spireRunToVirtualSave,
} from '../engine/bridge';
import {
  campfireForge,
  campfireMeditate,
  campfireRest,
  chooseEventOption,
  claimRewardArcana,
  claimRewardSkillNode,
  claimRewardWeapon,
  claimTreasure,
  completeSpireBattle,
  createSpireRun,
  enterEndlessSpire,
  finishSpireRewards,
  leaveCampfire,
  leaveEvent,
  leaveShop,
  leaveTreasure,
  rerollRewardWeapons,
  resolveEventPendingForge,
  resolveEventPendingSkill,
  resolveEventPendingWeapon,
  selectSpireNode,
  shopBuyArcana,
  shopBuyHeal,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopForgeWeapon,
  shopReroll,
  skipRewardArcana,
  skipRewardSkillNode,
  skipRewardWeapon,
  startSpireEncounter,
} from '../engine/runState';
import {
  loadSpireMeta,
  loadSpireRun,
  recordSpireRunEnd,
  syncSpireDiscoveriesToAdventure,
  writeSpireRun,
} from '../save';
import type { SpireLastFightSnapshot, SpireMeta, SpireRun } from '../types';
import SpireSetup from './SpireSetup';
import SpireHeader from './SpireHeader';
import SpireMap from './SpireMap';
import SpireEncounterPreview from './SpireEncounterPreview';
import SpireRewardScreen from './SpireRewardScreen';
import SpireShop from './SpireShop';
import SpireCampfire from './SpireCampfire';
import SpireEvent from './SpireEvent';
import SpireTreasure from './SpireTreasure';
import SpireEndScreen from './SpireEndScreen';
import SpireBuildModal from './SpireBuildModal';

interface Props {
  onExit: () => void;
  autoPlayer?: boolean;
  /** Dev helper: skip setup and immediately open a fresh run */
  initialRun?: SpireRun | null;
}

const SpireMode: React.FC<Props> = ({ onExit, autoPlayer, initialRun }) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [prefs, setPrefs] = useState(() => {
    const adv = loadAdventureSave();
    return { musicOn: adv.musicOn, effectsOn: adv.effectsOn };
  });
  const [meta, setMeta] = useState<SpireMeta>(loadSpireMeta);
  const [savedRun, setSavedRun] = useState<SpireRun | null>(() => initialRun ?? loadSpireRun());
  const [inSetup, setInSetup] = useState<boolean>(() => !initialRun);
  const [buildOpen, setBuildOpen] = useState(false);
  const [lastFight, setLastFight] = useState<SpireLastFightSnapshot | null>(null);

  const run = savedRun;

  const updateRun = useCallback((next: SpireRun | null) => {
    setSavedRun(next);
    writeSpireRun(next);
  }, []);

  useEffect(() => {
    setMusicEnabled(prefs.musicOn);
    setSfxOverride(prefs.musicOn);
  }, [prefs.musicOn]);
  useEffect(() => () => {
    setSfxOverride(null);
    music.stop();
  }, []);

  // Calm map/menu music outside combat (AdventureRun manages fight music during 'fight')
  useEffect(() => {
    if (inSetup || !run || run.phase !== 'fight') {
      music.play('map');
    }
  }, [inSetup, run?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleEffects = useCallback(() => {
    setPrefs(prev => {
      const next = { ...prev, effectsOn: !prev.effectsOn };
      const adv = loadAdventureSave();
      writeAdventureSave({ ...adv, effectsOn: next.effectsOn });
      return next;
    });
  }, []);

  const handleStartNew = useCallback((fighter: CharacterName, ascension: number, seed: number) => {
    const fresh = createSpireRun(fighter, ascension, seed);
    setLastFight(null);
    updateRun(fresh);
    setInSetup(false);
  }, [updateRun]);

  const handleResume = useCallback(() => {
    if (savedRun) setInSetup(false);
  }, [savedRun]);

  const handleAbandonActive = useCallback(() => {
    updateRun(null);
    setLastFight(null);
  }, [updateRun]);

  const handleBattleFinish = useCallback((fightRun: RunState) => {
    if (!run) return;
    setLastFight({
      run: fightRun,
      weapons: spireHeldWeapons(run),
      builds: buildSpireWeaponBuilds(run),
    });
    if (fightRun.forgedRecipes.length > 0) {
      syncSpireDiscoveriesToAdventure(fightRun.forgedRecipes);
    }
    const next = completeSpireBattle(run, fightRun);
    if (next.phase === 'defeat') {
      setMeta(recordSpireRunEnd(next, false));
      writeSpireRun(null);
      setSavedRun(next);
    } else {
      updateRun(next);
    }
  }, [run, updateRun]);

  const handleFinishRewards = useCallback(() => {
    if (!run) return;
    const next = finishSpireRewards(run);
    if (next.phase === 'victory') {
      setMeta(recordSpireRunEnd(next, true));
    }
    updateRun(next);
  }, [run, updateRun]);

  const activeLevel = useMemo(
    () => (run && run.activeEncounter ? spireEncounterToLevel(run, run.activeEncounter) : null),
    [run]
  );
  const virtualSave = useMemo(
    () => (run ? spireRunToVirtualSave(run, prefs) : null),
    [run, prefs]
  );
  const overrides = useMemo(
    () => (run ? spireRunOverrides(run) : undefined),
    [run]
  );

  if (inSetup || !run) {
    return (
      <SpireSetup
        activeRun={savedRun}
        meta={meta}
        onStartNew={handleStartNew}
        onResume={handleResume}
        onAbandonActive={handleAbandonActive}
        onExit={() => { music.stop(); onExit(); }}
      />
    );
  }

  if (run.phase === 'fight' && activeLevel && virtualSave && run.activeEncounter) {
    const enc = run.activeEncounter;
    const floorLabel = run.endless ? `Endless Act ${run.act} · Fl ${run.floor}` : `Act ${run.act} · Floor ${run.floor}`;
    const nodeLabel = enc.kind === 'boss' ? 'Act Boss' : enc.kind === 'elite' ? 'Elite' : 'Skirmish';
    return (
      <AdventureRun
        key={`spire-fight-${run.act}-${run.floor}-${enc.id}`}
        level={activeLevel}
        save={virtualSave}
        seed={(run.seed ^ (run.floor * 7919) ^ (run.act * 104729)) >>> 0}
        autoPlayer={autoPlayer}
        onFinish={fightRun => handleBattleFinish(fightRun)}
        onQuit={() => {
          // Saving mid-fight safely returns to the Spire encounter preview / menu without losing run progress
          music.stop();
          updateRun({ ...run, phase: 'preview' });
        }}
        onRestart={() => {}}
        onCoachMarkSeen={() => {}}
        effects={prefs.effectsOn && !reducedMotion}
        onToggleEffects={reducedMotion ? undefined : handleToggleEffects}
        runOverrides={overrides}
        featuresOverride={new Set(SPIRE_FIGHT_FEATURES)}
        spireContext={{
          floorLabel,
          nodeLabel,
          hideChallenge: true,
          noRestart: true,
          quitLabel: 'Retreat to Briefing',
          quitHint: 'Returns to the pre-battle briefing for this floor.',
        }}
      />
    );
  }

  if (run.phase === 'victory' || run.phase === 'defeat') {
    return (
      <SpireEndScreen
        run={run}
        victory={run.phase === 'victory'}
        lastFight={lastFight}
        onEnterEndless={
          run.phase === 'victory'
            ? () => updateRun(enterEndlessSpire(run))
            : undefined
        }
        onNewRun={() => {
          writeSpireRun(null);
          setSavedRun(null);
          setInSetup(true);
        }}
        onExitToMenu={() => {
          if (run.phase === 'victory' || run.phase === 'defeat') {
            writeSpireRun(null);
            setSavedRun(null);
          }
          music.stop();
          onExit();
        }}
      />
    );
  }

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <SpireHeader
        run={run}
        onOpenBuild={() => setBuildOpen(true)}
        onExitToMenu={() => {
          writeSpireRun(run);
          setInSetup(true);
        }}
      />

      {run.phase === 'map' && (
        <SpireMap
          run={run}
          onSelectNode={nodeId => updateRun(selectSpireNode(run, nodeId))}
        />
      )}

      {run.phase === 'preview' && run.activeEncounter && (
        <SpireEncounterPreview
          run={run}
          encounter={run.activeEncounter}
          onFight={() => updateRun(startSpireEncounter(run))}
          onInspectBuild={() => setBuildOpen(true)}
        />
      )}

      {run.phase === 'reward' && run.reward && (
        <SpireRewardScreen
          run={run}
          reward={run.reward}
          lastFight={lastFight}
          onClaimWeapon={idx => updateRun(claimRewardWeapon(run, idx))}
          onRerollWeapons={() => updateRun(rerollRewardWeapons(run))}
          onSkipWeapon={() => updateRun(skipRewardWeapon(run))}
          onClaimArcana={id => updateRun(claimRewardArcana(run, id))}
          onSkipArcana={() => updateRun(skipRewardArcana(run))}
          onClaimSkill={id => updateRun(claimRewardSkillNode(run, id))}
          onSkipSkill={() => updateRun(skipRewardSkillNode(run))}
          onContinue={handleFinishRewards}
        />
      )}

      {run.phase === 'shop' && run.shop && (
        <SpireShop
          run={run}
          shop={run.shop}
          onBuyWeapon={idx => updateRun(shopBuyWeapon(run, idx))}
          onBuyArcana={idx => updateRun(shopBuyArcana(run, idx))}
          onBuyUpgrade={idx => updateRun(shopBuyUpgrade(run, idx))}
          onBuyHeal={() => updateRun(shopBuyHeal(run))}
          onForgeWeapon={wId => updateRun(shopForgeWeapon(run, wId))}
          onReroll={() => updateRun(shopReroll(run))}
          onLeave={() => updateRun(leaveShop(run))}
        />
      )}

      {run.phase === 'campfire' && run.campfire && (
        <SpireCampfire
          run={run}
          campfire={run.campfire}
          onRest={() => updateRun(campfireRest(run))}
          onForge={wId => updateRun(campfireForge(run, wId))}
          onMeditate={nodeId => updateRun(campfireMeditate(run, nodeId))}
          onLeave={() => updateRun(leaveCampfire(run))}
        />
      )}

      {run.phase === 'event' && run.event && (
        <SpireEvent
          run={run}
          eventState={run.event}
          onChoose={optId => updateRun(chooseEventOption(run, optId))}
          onPickWeapon={idx => updateRun(resolveEventPendingWeapon(run, idx))}
          onPickSkill={id => updateRun(resolveEventPendingSkill(run, id))}
          onPickForge={wId => updateRun(resolveEventPendingForge(run, wId))}
          onLeave={() => updateRun(leaveEvent(run))}
        />
      )}

      {run.phase === 'treasure' && run.treasure && (
        <SpireTreasure
          run={run}
          treasure={run.treasure}
          onClaim={choice => updateRun(claimTreasure(run, choice))}
          onLeave={() => updateRun(leaveTreasure(run))}
        />
      )}

      <SpireBuildModal visible={buildOpen} run={run} onClose={() => setBuildOpen(false)} />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
});

export default SpireMode;
