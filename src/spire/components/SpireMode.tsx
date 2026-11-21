/**
 * Starfall Summit — Root Mode Coordinator.
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
import { battleRecord, wasFought } from '@/adventure/history';
import type { FightTape } from '@/adventure/engine/replay';
import AdventureRun from '@/adventure/components/AdventureRun';
import type { RunState } from '@/adventure/types';
import {
  commitSpireFight,
  markReplayOpened,
  rateFight,
  stageSpireFight,
  trackFight,
  type FunRating,
  type FunTag,
  type SpireFightMeta,
} from '@/analytics/fightEvent';
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
  cancelSpirePreview,
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
  reorderSpireWeapon,
  rerollRewardWeapons,
  resolveEventPendingArcana,
  resolveEventPendingForge,
  resolveEventPendingSkill,
  resolveEventPendingWeapon,
  retreatSpireBattle,
  selectSpireNode,
  shopBuyArcana,
  shopBuyHeal,
  shopBuyUpgrade,
  shopBuyWeapon,
  shopForgeWeapon,
  shopPurgeArcana,
  shopReroll,
  shopSellWeapon,
  shopToggleLock,
  skipEventPendingWeapon,
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
  const [lastFightFeedback, setLastFightFeedback] = useState<{
    fightId: string;
    funRating: FunRating | null;
    funTags: FunTag[];
  } | null>(null);

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
    commitSpireFight('spire_unmount');
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
    commitSpireFight('spire_new_run');
    const fresh = createSpireRun(fighter, ascension, seed);
    setLastFight(null);
    setLastFightFeedback(null);
    updateRun(fresh);
    setInSetup(false);
  }, [updateRun]);

  const handleResume = useCallback(() => {
    if (savedRun) setInSetup(false);
  }, [savedRun]);

  const handleAbandonActive = useCallback(() => {
    commitSpireFight('spire_abandon');
    updateRun(null);
    setLastFight(null);
    setLastFightFeedback(null);
  }, [updateRun]);

  const spireFightMeta = (spireRun: SpireRun, fightRun: RunState): SpireFightMeta => ({
    runId: spireRun.id,
    act: spireRun.act,
    floor: spireRun.floor,
    ascension: spireRun.ascension,
    endless: spireRun.endless,
    nodeKind: spireRun.activeEncounter?.kind ?? 'skirmish',
    weaponLevels: { ...spireRun.weaponLevels },
    parries: fightRun.parriesLanded,
    perfectParries: fightRun.perfectParriesLanded,
  });

  const handleBattleFinish = useCallback((fightRun: RunState, tape: FightTape) => {
    if (!run || !run.activeEncounter) return;
    const level = spireEncounterToLevel(run, run.activeEncounter);
    const won = fightRun.status === 'won' && fightRun.endReason === 'defeated';
    const at = Date.now();
    const fightId = `${at}-${tape.recording.seed}`;
    const record = {
      ...battleRecord(level, fightRun, { at, fightId }),
      outcome: (won ? 'won' : 'lost') as 'won' | 'lost',
    };
    stageSpireFight(level, fightRun, record, tape, {
      fightId,
      spire: spireFightMeta(run, fightRun),
    });
    setLastFightFeedback({ fightId, funRating: null, funTags: [] });
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

  const handleRateFun = useCallback((rating: FunRating | null, tags: FunTag[]) => {
    setLastFightFeedback(prev => {
      if (!prev) return prev;
      rateFight(prev.fightId, { funRating: rating, funTags: tags }, { source: 'spire' });
      return { ...prev, funRating: rating, funTags: tags };
    });
  }, []);

  const handleReplayOpened = useCallback(() => {
    if (lastFightFeedback) markReplayOpened(lastFightFeedback.fightId);
  }, [lastFightFeedback]);

  const handleFinishRewards = useCallback(() => {
    if (!run) return;
    const next = finishSpireRewards(run);
    if (next.phase === 'victory') {
      setMeta(recordSpireRunEnd(next, true));
    } else {
      commitSpireFight('spire_reward_continue');
      setLastFightFeedback(null);
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
    const fightSeed = (
      run.seed ^
      (run.floor * 7919) ^
      (run.act * 104729) ^
      ((run.retreats ?? 0) * 2654435761)
    ) >>> 0;
    const isLastHeart = run.hearts <= 1;
    return (
      <AdventureRun
        key={`spire-fight-${run.act}-${run.floor}-${enc.id}-${run.retreats ?? 0}`}
        level={activeLevel}
        save={virtualSave}
        seed={fightSeed}
        autoPlayer={autoPlayer}
        onFinish={(fightRun, tape) => handleBattleFinish(fightRun, tape)}
        onQuit={(fightRun, tape) => {
          // Record retreats once a move was made, then charge 1 ♥ (or forfeit on 1 ♥) so combat cannot be save-scummed
          if (wasFought(fightRun)) {
            const at = Date.now();
            const fightId = `${at}-${tape.recording.seed}`;
            const record = battleRecord(activeLevel, fightRun, { at, left: true, fightId });
            trackFight(activeLevel, fightRun, record, tape, {
              fightId,
              spire: spireFightMeta(run, fightRun),
            });
          }
          music.stop();
          const next = retreatSpireBattle(run, fightRun.foeName);
          if (next.phase === 'defeat') {
            setMeta(recordSpireRunEnd(next, false));
            writeSpireRun(null);
            setSavedRun(next);
          } else {
            updateRun(next);
          }
        }}
        onRestart={() => {}}
        onCoachMarkSeen={() => {}}
        effects={prefs.effectsOn && !reducedMotion}
        onToggleEffects={reducedMotion ? undefined : handleToggleEffects}
        runOverrides={overrides}
        featuresOverride={new Set(SPIRE_FIGHT_FEATURES)}
        chrome={{
          statusBanner: {
            icon: 'lorc/mountaintop',
            text: `${floorLabel} · ${nodeLabel}`,
            testID: 'run-spire-bar',
          },
          pauseSubtitle: `${floorLabel} · ${enc.name}`,
          alwaysShowHudStats: true,
          allowRestart: false,
          quitLabel: isLastHeart ? 'Forfeit Run' : 'Retreat (−1 ♥)',
          quitHint: isLastHeart
            ? 'You are at 1 ♥ — retreating ends this climb.'
            : 'Costs 1 ♥ and reshuffles the board before returning to briefing.',
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
        funRating={lastFightFeedback?.funRating ?? null}
        funTags={lastFightFeedback?.funTags}
        onRateFun={lastFightFeedback ? handleRateFun : undefined}
        onReplayOpened={handleReplayOpened}
        onEnterEndless={
          run.phase === 'victory'
            ? () => {
                commitSpireFight('spire_enter_endless');
                setLastFightFeedback(null);
                updateRun(enterEndlessSpire(run));
              }
            : undefined
        }
        onNewRun={() => {
          commitSpireFight('spire_end_new_run');
          setLastFightFeedback(null);
          writeSpireRun(null);
          setSavedRun(null);
          setInSetup(true);
        }}
        onExitToMenu={() => {
          commitSpireFight('spire_end_exit');
          setLastFightFeedback(null);
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
          commitSpireFight('spire_header_exit');
          setLastFightFeedback(null);
          writeSpireRun(run);
          setInSetup(true);
        }}
      />

      {run.phase === 'map' && (
        <SpireMap
          run={run}
          onSelectNode={nodeId => updateRun(selectSpireNode(run, nodeId))}
          onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
        />
      )}

      {run.phase === 'preview' && run.activeEncounter && (
        <SpireEncounterPreview
          run={run}
          encounter={run.activeEncounter}
          onFight={() => updateRun(startSpireEncounter(run))}
          onInspectBuild={() => setBuildOpen(true)}
          onBack={run.prevNodeId !== undefined ? () => updateRun(cancelSpirePreview(run)) : undefined}
        />
      )}

      {run.phase === 'reward' && run.reward && (
        <SpireRewardScreen
          run={run}
          reward={run.reward}
          lastFight={lastFight}
          funRating={lastFightFeedback?.funRating ?? null}
          funTags={lastFightFeedback?.funTags}
          onRateFun={lastFightFeedback ? handleRateFun : undefined}
          onReplayOpened={handleReplayOpened}
          onClaimWeapon={(idx, replaceId) => updateRun(claimRewardWeapon(run, idx, replaceId))}
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
          onBuyWeapon={(idx, replaceId) => updateRun(shopBuyWeapon(run, idx, replaceId))}
          onBuyArcana={idx => updateRun(shopBuyArcana(run, idx))}
          onBuyUpgrade={idx => updateRun(shopBuyUpgrade(run, idx))}
          onBuyHeal={() => updateRun(shopBuyHeal(run))}
          onForgeWeapon={wId => updateRun(shopForgeWeapon(run, wId))}
          onReroll={() => updateRun(shopReroll(run))}
          onToggleLock={(kind, idx) => updateRun(shopToggleLock(run, kind, idx))}
          onSellWeapon={wId => updateRun(shopSellWeapon(run, wId))}
          onPurgeArcana={id => updateRun(shopPurgeArcana(run, id))}
          onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
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
          onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
          onLeave={() => updateRun(leaveCampfire(run))}
        />
      )}

      {run.phase === 'event' && run.event && (
        <SpireEvent
          run={run}
          eventState={run.event}
          onChoose={optId => updateRun(chooseEventOption(run, optId))}
          onPickWeapon={(idx, replaceId) => updateRun(resolveEventPendingWeapon(run, idx, replaceId))}
          onSkipWeapon={() => updateRun(skipEventPendingWeapon(run))}
          onPickSkill={id => updateRun(resolveEventPendingSkill(run, id))}
          onPickForge={wId => updateRun(resolveEventPendingForge(run, wId))}
          onResolveArcana={accept => updateRun(resolveEventPendingArcana(run, accept))}
          onLeave={() => updateRun(leaveEvent(run))}
        />
      )}

      {run.phase === 'treasure' && run.treasure && (
        <SpireTreasure
          run={run}
          treasure={run.treasure}
          onClaim={(choice, replaceId) => updateRun(claimTreasure(run, choice, replaceId))}
          onLeave={() => updateRun(leaveTreasure(run))}
        />
      )}

      <SpireBuildModal
        visible={buildOpen}
        run={run}
        onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
        onClose={() => setBuildOpen(false)}
      />
    </View>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2118' },
});

export default SpireMode;
