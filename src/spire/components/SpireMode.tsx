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
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CharacterName } from '@/types';
import { music, setMusicEnabled, setSfxOverride, sfx } from '@/audio';
import { setAudioEnabled } from '@/utils/sounds';
import { MusicStorage, SoundStorage } from '@/utils/storage';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { getBiome } from '@/adventure/data/biomes';
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
  type CreateSpireRunOptions,
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
import { useSpireScreenTransition } from './SpireMotion';

interface Props {
  onExit: () => void;
  autoPlayer?: boolean;
  /** Dev helper: skip setup and immediately open a fresh run */
  initialRun?: SpireRun | null;
  /** Optional URL deep-link parameters (`?mode=summit&seed=<N>&daily=YYYY-MM-DD&fighter=...&asc=...`) */
  initialSeed?: number;
  initialDaily?: boolean;
  initialDailyDate?: string;
  initialFighter?: CharacterName;
  initialAscension?: number;
}

const SpireMode: React.FC<Props> = ({
  onExit,
  autoPlayer,
  initialRun,
  initialSeed,
  initialDaily,
  initialDailyDate,
  initialFighter,
  initialAscension,
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [prefs, setPrefs] = useState(() => {
    const adv = loadAdventureSave();
    const musicOn =
      typeof MusicStorage?.hasValue === 'function' && MusicStorage.hasValue()
        ? MusicStorage.get()
        : adv.musicOn && (typeof MusicStorage?.get === 'function' ? MusicStorage.get() : true);
    const sfxOn = typeof SoundStorage?.get === 'function' ? SoundStorage.get() : adv.musicOn;
    return { musicOn, sfxOn, effectsOn: adv.effectsOn };
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
  const screenTx = useSpireScreenTransition({ enterOnMount: false });
  const roomTx = useSpireScreenTransition({ enterOnMount: false });

  const run = savedRun;

  const updateRun = useCallback((next: SpireRun | null) => {
    setSavedRun(next);
    writeSpireRun(next);
  }, []);

  useAndroidBackHandler(() => {
    if (buildOpen) {
      setBuildOpen(false);
      return true;
    }
    if (inSetup) {
      onExit();
      return true;
    }
    if (!run || run.phase === 'map' || run.phase === 'victory' || run.phase === 'defeat') {
      screenTx.go(() => setInSetup(true), 'descend');
      return true;
    }
    if (run.phase === 'preview') {
      roomTx.go(() => updateRun(cancelSpirePreview(run)), 'descend');
      return true;
    }
    // Consume back during active fights/shops/rewards so players don't drop a run accidentally
    return true;
  });

  useEffect(() => {
    const unsubMusic =
      typeof MusicStorage?.subscribe === 'function'
        ? MusicStorage.subscribe(musicOn => setPrefs(prev => (prev.musicOn === musicOn ? prev : { ...prev, musicOn })))
        : undefined;
    const unsubSfx =
      typeof SoundStorage?.subscribe === 'function'
        ? SoundStorage.subscribe(sfxOn => setPrefs(prev => (prev.sfxOn === sfxOn ? prev : { ...prev, sfxOn })))
        : undefined;
    return () => {
      unsubMusic?.();
      unsubSfx?.();
    };
  }, []);

  useEffect(() => {
    setMusicEnabled(prefs.musicOn);
  }, [prefs.musicOn]);

  useEffect(() => {
    setSfxOverride(prefs.sfxOn);
  }, [prefs.sfxOn]);

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

  const handleToggleAudio = useCallback(() => {
    // Cycle: Music+SFX -> SFX only (music muted) -> All muted -> Music+SFX
    const nextMusic = !prefs.musicOn && !prefs.sfxOn;
    const nextSfx = prefs.musicOn && prefs.sfxOn ? true : !prefs.musicOn && !prefs.sfxOn;
    setPrefs(prev => ({ ...prev, musicOn: nextMusic, sfxOn: nextSfx }));
    setAudioEnabled(nextSfx);
    if (typeof MusicStorage?.set === 'function') MusicStorage.set(nextMusic);
    if (typeof SoundStorage?.set === 'function') SoundStorage.set(nextSfx);
    const adv = loadAdventureSave();
    if (adv.musicOn !== nextMusic) {
      writeAdventureSave({ ...adv, musicOn: nextMusic });
    }
    if (nextSfx) {
      setSfxOverride(true);
      sfx('click');
    }
  }, [prefs.musicOn, prefs.sfxOn]);

  const handleToggleEffects = useCallback(() => {
    setPrefs(prev => {
      const next = { ...prev, effectsOn: !prev.effectsOn };
      const adv = loadAdventureSave();
      writeAdventureSave({ ...adv, effectsOn: next.effectsOn });
      return next;
    });
  }, []);

  const handleStartNew = useCallback((
    fighter: CharacterName,
    ascension: number,
    seed: number,
    options?: CreateSpireRunOptions
  ) => {
    commitSpireFight('spire_new_run');
    const fresh = createSpireRun(fighter, ascension, seed, options);
    screenTx.go(() => {
      setLastFight(null);
      setLastFightFeedback(null);
      updateRun(fresh);
      setInSetup(false);
    }, 'ascend');
  }, [screenTx, updateRun]);

  const handleResume = useCallback(() => {
    if (savedRun) screenTx.go(() => setInSetup(false), 'ascend');
  }, [savedRun, screenTx]);

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
    if (fightRun.forgedRecipes.length > 0) {
      syncSpireDiscoveriesToAdventure(fightRun.forgedRecipes);
    }
    const next = completeSpireBattle(run, fightRun);
    const snapshot: SpireLastFightSnapshot = {
      run: fightRun,
      weapons: spireHeldWeapons(run),
      builds: buildSpireWeaponBuilds(run),
    };
    screenTx.go(() => {
      setLastFightFeedback({ fightId, funRating: null, funTags: [] });
      setLastFight(snapshot);
      if (next.phase === 'defeat') {
        setMeta(recordSpireRunEnd(next, false));
        writeSpireRun(null);
        setSavedRun(next);
      } else {
        updateRun(next);
      }
    }, 'ascend');
  }, [run, screenTx, updateRun]);

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
      screenTx.go(() => {
        setMeta(recordSpireRunEnd(next, true));
        updateRun(next);
      }, 'ascend');
    } else {
      const ascendingAct = next.act > run.act;
      roomTx.go(() => {
        commitSpireFight('spire_reward_continue');
        setLastFightFeedback(null);
        updateRun(next);
      }, ascendingAct ? 'ascend' : 'descend');
    }
  }, [run, screenTx, roomTx, updateRun]);

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

  let screenContent: React.ReactNode;

  if (inSetup || !run) {
    screenContent = (
      <SpireSetup
        activeRun={savedRun}
        meta={meta}
        initialTab={initialDaily ? 'daily' : 'standard'}
        initialSeed={initialSeed}
        initialFighter={initialFighter}
        initialAscension={initialAscension}
        initialDailyDate={initialDailyDate}
        onStartNew={handleStartNew}
        onResume={handleResume}
        onAbandonActive={handleAbandonActive}
        onExit={() => { music.stop(); onExit(); }}
      />
    );
  } else if (run.phase === 'fight' && activeLevel && virtualSave && run.activeEncounter) {
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
    screenContent = (
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
          screenTx.go(() => {
            if (next.phase === 'defeat') {
              setMeta(recordSpireRunEnd(next, false));
              writeSpireRun(null);
              setSavedRun(next);
            } else {
              updateRun(next);
            }
          }, 'descend');
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
          requireKnockoutToWin: true,
          starlessVictory: true,
          isEliteEncounter: enc.kind === 'elite',
          quitLabel: isLastHeart ? 'Forfeit Run' : 'Retreat (−1 ♥)',
          quitHint: isLastHeart
            ? 'You are at 1 ♥ — retreating ends this climb.'
            : 'Costs 1 ♥ and reshuffles the board before returning to briefing.',
        }}
      />
    );
  } else if (run.phase === 'victory' || run.phase === 'defeat') {
    screenContent = (
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
                screenTx.go(() => {
                  commitSpireFight('spire_enter_endless');
                  setLastFightFeedback(null);
                  updateRun(enterEndlessSpire(run));
                }, 'ascend');
              }
            : undefined
        }
        onNewRun={() => {
          screenTx.go(() => {
            commitSpireFight('spire_end_new_run');
            setLastFightFeedback(null);
            writeSpireRun(null);
            setSavedRun(null);
            setInSetup(true);
          }, 'descend');
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
  } else {
    const roomBg =
      run.phase === 'map' || run.phase === 'preview'
        ? getBiome(run.map.biome).colors.sky
        : '#2B2118';
    screenContent = (
      <View style={[st.root, { paddingTop: insets.top, backgroundColor: roomBg }]}>
        <SpireHeader
          run={run}
          musicOn={prefs.musicOn}
          sfxOn={prefs.sfxOn}
          onToggleAudio={handleToggleAudio}
          onOpenBuild={() => setBuildOpen(true)}
          onExitToMenu={() => {
            screenTx.go(() => {
              commitSpireFight('spire_header_exit');
              setLastFightFeedback(null);
              writeSpireRun(run);
              setInSetup(true);
            }, 'descend');
          }}
        />

        <Animated.View
          style={[st.roomViewport, roomTx.style]}
          pointerEvents={roomTx.leaving ? 'none' : 'auto'}
        >
          {run.phase === 'map' && (
            <SpireMap
              run={run}
              onSelectNode={nodeId => roomTx.go(() => updateRun(selectSpireNode(run, nodeId)), 'ascend')}
              onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
            />
          )}

          {run.phase === 'preview' && run.activeEncounter && (
            <SpireEncounterPreview
              run={run}
              encounter={run.activeEncounter}
              onFight={() => screenTx.go(() => updateRun(startSpireEncounter(run)), 'ascend')}
              onInspectBuild={() => setBuildOpen(true)}
              onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
              onBack={
                run.prevNodeId !== undefined
                  ? () => roomTx.go(() => updateRun(cancelSpirePreview(run)), 'descend')
                  : undefined
              }
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
              onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
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
              onLeave={() => roomTx.go(() => updateRun(leaveShop(run)), 'descend')}
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
              onLeave={() => roomTx.go(() => updateRun(leaveCampfire(run)), 'descend')}
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
              onLeave={() => {
                const next = leaveEvent(run);
                roomTx.go(() => updateRun(next), next.phase === 'preview' ? 'ascend' : 'descend');
              }}
            />
          )}

          {run.phase === 'treasure' && run.treasure && (
            <SpireTreasure
              run={run}
              treasure={run.treasure}
              onClaim={(choice, replaceId) => updateRun(claimTreasure(run, choice, replaceId))}
              onLeave={() => roomTx.go(() => updateRun(leaveTreasure(run)), 'descend')}
            />
          )}
        </Animated.View>

        <SpireBuildModal
          visible={buildOpen}
          run={run}
          onReorderWeapon={(from, to) => updateRun(reorderSpireWeapon(run, from, to))}
          onClose={() => setBuildOpen(false)}
        />
      </View>
    );
  }

  return (
    <View style={st.shell}>
      <Animated.View
        style={[st.screenWrap, screenTx.style]}
        pointerEvents={screenTx.leaving ? 'none' : 'auto'}
      >
        {screenContent}
      </Animated.View>
    </View>
  );
};

const st = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#2B2118', overflow: 'hidden' },
  screenWrap: { flex: 1 },
  root: { flex: 1, backgroundColor: '#2B2118' },
  roomViewport: { flex: 1, overflow: 'hidden' },
});

export default SpireMode;
