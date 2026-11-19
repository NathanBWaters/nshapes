import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AdventureMode from '@/adventure/AdventureMode';
import { createMaxedSave, createNewSave, createSaveBefore } from '@/adventure/progress';
import { BOUNTIES } from '@/adventure/data/bounties';
import { getLevel } from '@/adventure/data/levels';
import { simulateRun, BOTS } from '@/adventure/engine/bot';
import type { AdventureSave, RunState } from '@/adventure/types';

/**
 * Dev Results Page (/dev/results): the real results flow (AdventureMode → LevelResults → UnlockReveal)
 * on a fight that was won a moment ago by the headless bot, so the results and the unlock reveals
 * can be seen in seconds instead of after a whole fight.
 *
 * URL params:
 * - ?case=perfect — 1-1 replayed for ★★★ on a maxed save: stars, coins, no unlocks (default)
 * - ?case=two     — the same with ★★ (the ★★★ challenge missed)
 * - ?case=first   — a first ★★★ on 2-5: weapons and a secret path, one reveal each
 * - ?case=fighter — a first ★★★ on 2-1: multiple weapon & recipe unlocks in sequence
 * - ?level=2-8&stars=2&save=before|maxed|fresh&seed=3 — any level and star count (save `before` = first time on that level)
 *
 * Like /dev/adventure, the save is only written once you do something (equip, pick a fighter).
 */
const CASES: Record<string, { level: string; stars: number; save: string }> = {
  perfect: { level: '1-1', stars: 3, save: 'maxed' },
  two: { level: '1-1', stars: 2, save: 'maxed' },
  first: { level: '2-5', stars: 3, save: 'before' },
  fighter: { level: '2-1', stars: 3, save: 'before' },
  geared: { level: '2-4', stars: 3, save: 'geared' },
};

const saveFor = (kind: string, levelId: string): AdventureSave => {
  if (kind === 'geared') {
    const s = createMaxedSave();
    return { ...s, completedBounties: BOUNTIES.map(b => b.id) };
  }
  return kind === 'maxed' ? createMaxedSave() : kind === 'fresh' ? createNewSave() : createSaveBefore(levelId);
};

/** A won fight on `levelId`, played by the expert bot; patched to land on exactly `stars`. */
const wonRun = (levelId: string, save: AdventureSave, stars: number, seed: number): RunState => {
  const level = getLevel(levelId);
  let run: RunState | null = null;
  for (let k = 0; k < 8 && (!run || run.status !== 'won'); k++) run = simulateRun(level, save, BOTS.expert, seed + k).state;
  const state = run as RunState;
  return {
    ...state,
    status: stars > 0 ? 'won' : 'lost',
    endReason: stars === 1 ? 'survived' : stars > 1 ? 'defeated' : 'hearts',
    challengeMet: stars >= 3,
    foeHp: stars > 1 ? 0 : state.foeHp,
  };
};

export default function DevResults() {
  const params = useLocalSearchParams<{ case?: string; level?: string; stars?: string; save?: string; seed?: string }>();
  const preset = CASES[params.case ?? ''] ?? (params.level ? null : CASES.perfect);
  const levelId = params.level ?? preset?.level ?? '1-1';
  const stars = Math.max(0, Math.min(3, Number(params.stars ?? preset?.stars ?? 3)));
  const saveKind = params.save ?? preset?.save ?? 'before';
  const seed = Number(params.seed ?? 7);
  const { save, devResult } = useMemo(() => {
    const s = saveFor(saveKind, levelId);
    return { save: s, devResult: { levelId, run: wonRun(levelId, s, stars, seed), stars } };
  }, [levelId, stars, saveKind, seed]);
  return (
    <View style={{ flex: 1 }}>
      <AdventureMode initialSave={save} coldOpen={false} devResult={devResult} onExit={() => router.replace('/')} />
    </View>
  );
}
