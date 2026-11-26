/**
 * Wave 3 Lane B (`w3-onboarding-story`) comprehensive regression & unit test suite:
 *   - [OB-05] StoryIntro Beat-3 live tappable cards, early-tap snap, Pause & always-visible Skip
 *   - [OB-06] UnlockReveal 340-420ms dead CTA fix, snap reveal, Claim All & starsLandedMs trim
 *   - [OB-08] + [AU-13] Repeat & post-pick non-blocking EvolutionBanner, 200ms guard, mount audio cues
 *   - [OB-09] 2-2 Evolutions unified into taughtOnPreview & skippable MechanicIntro + quiz skip
 *   - [OB-10] 1-5 decongested, 1-6 Timing Parry debut, 1-10 ANY timing, 2-4 Counter-Parry + live callouts
 *   - [OB-11] Dynamic 1-4D unlocked traits, 1-4 Damage Numbers, 3-1 Shading Surge assist safety net
 *   - [OB-12] 3 stale mechanics.ts copy fixes (30s of power, Bounty Board at Camp, paused wave clock)
 *   - [OB-13] + [OB-17] DefeatOverlay instant retry, pre-1-8 Closest Yet! bar & context-aware diagnostics
 *   - [OB-15] + [OB-16] 1-1 taunt suppression, 900ms intro taunt cap, voiced quips, 3-3 auto-wave, direct Camp launch
 *   - [OB-19] + [OB-20] Star Shards + 5 caged friends unity, Raider/Boss callbacks, 5-5 StoryEndingModal
 *   - [TP-17] AdventureMode single overlay state machine & navEpochRef timer race hardening
 */
import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import StoryIntro from '@/adventure/components/StoryIntro';
import StoryEndingModal from '@/adventure/components/StoryEndingModal';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import MechanicIntro from '@/adventure/components/MechanicIntro';
import DefeatOverlay from '@/adventure/components/DefeatOverlay';
import ParryPreviewCard from '@/adventure/components/ParryPreviewCard';
import LevelResults from '@/adventure/components/LevelResults';
import AdventureRun from '@/adventure/components/AdventureRun';
import EvolutionPickOverlay from '@/adventure/components/EvolutionPickOverlay';
import { EvolutionCutIn, scriptFor, useAnchors, useFightFx } from '@/adventure/fx';
import { starsLandedMs } from '@/adventure/components/ui';
import { STORY, STORY_BOSS_CALLBACKS, STORY_CAPTIVE_FRIENDS, STORY_RAIDER_TAUNTS } from '@/adventure/data/story';
import { MECHANICS } from '@/adventure/data/mechanics';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { getLevel, LEVELS, PRACTICE_LEVELS } from '@/adventure/data/levels';
import { getParryArchetype, resolveParrySpec } from '@/adventure/data/parry';
import { SURGE_RULES } from '@/adventure/data/rules';
import { lessonsDueBefore, taughtOnPreview } from '@/adventure/lessons';
import {
  applyLevelResult,
  armableRecipesFromArmory,
  COACH_KEYS,
  createMaxedSave,
  createNewSave,
  createSaveBefore,
  markEndingSeen,
} from '@/adventure/progress';
import { createRun, runReducer } from '@/adventure/engine/run';
import {
  assistStepsFor,
  companionVoice,
  computeLiveGuidance,
  diagnoseResultTip,
  fightRemarks,
  foeMidFightBark,
  parryOnboardingCallout,
  resolvePracticeFeatures,
  resolvePracticeLevel,
  shouldShowDamageNumbers,
  THIRD_WORLD_INTRO_ASSIST_STEPS,
} from '@/adventure/coach';
import type { RunEvent, RunState } from '@/adventure/types';

const mockKvStore = new Map<string, string>();
const mockSfx = jest.fn();
const mockBandCue = jest.fn();
const mockBandEvolve = jest.fn();
const mockBandFinale = jest.fn();

jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (key: string) => mockKvStore.get(key),
    set: (key: string, val: string) => { mockKvStore.set(key, val); },
    remove: (key: string) => { mockKvStore.delete(key); },
  },
  MusicStorage: { hasValue: () => false, get: () => true, set: () => undefined, subscribe: () => () => undefined },
  SoundStorage: { get: () => true, subscribe: () => () => undefined },
}));

jest.mock('@/audio', () => {
  const band = new Proxy(
    {
      inFight: false,
      gridMs: 62.5,
      cue: (...args: unknown[]) => mockBandCue(...args),
      evolve: (...args: unknown[]) => mockBandEvolve(...args),
      finale: (...args: unknown[]) => mockBandFinale(...args),
    } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === 'playCutInEvolve' || key === 'playWeaponPickReelStop') return undefined;
        return () => undefined;
      },
    }
  );
  return { sfx: (...args: unknown[]) => mockSfx(...args), music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) => ReactActual.createElement(View, props, props?.children as React.ReactNode);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={INSETS}>{node}</SafeAreaProvider>;

describe('Wave 3B: [OB-05] & [OB-19] StoryIntro interactive Beat-3, snap-to-settled, Pause & 5 caged friends', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSfx.mockClear();
    mockBandCue.mockClear();
  });
  afterEach(() => {
    act(() => { jest.clearAllTimers(); });
    jest.useRealTimers();
  });

  it('reconciles Star Shards + 5 caged friends + Golden Keys and snaps on early body tap before advancing', () => {
    expect(STORY_CAPTIVE_FRIENDS).toHaveLength(5);
    expect(STORY.welcome[0].body).toMatch(/Star Shards/i);
    expect(STORY.welcome[0].body).toMatch(/5 friends/i);
    expect(STORY.welcome[0].body).toMatch(/Golden Keys/i);

    const onDone = jest.fn();
    const screen = render(wrap(<StoryIntro fighter="Orange Tabby" onDone={onDone} />));

    // All 5 caged friends render in Beat 1
    for (const friend of STORY_CAPTIVE_FRIENDS) {
      expect(screen.getByTestId(`story-captive-${friend}`)).toBeTruthy();
    }

    // Early body tap before ABDUCTION_WORDS_MS snaps Beat 1 instead of skipping its words
    fireEvent.press(screen.getByTestId('story-body'));
    expect(screen.getByText(STORY.welcome[0].title)).toBeTruthy();

    // Second body tap advances cleanly to Beat 2
    fireEvent.press(screen.getByTestId('story-body'));
    expect(screen.getByText(STORY.welcome[1].title)).toBeTruthy();

    // Pause toggles cleanly and shows the paused pill
    fireEvent.press(screen.getByTestId('story-pause'));
    expect(screen.getByTestId('story-paused-pill')).toBeTruthy();
    fireEvent.press(screen.getByTestId('story-paused-pill'));
    expect(screen.queryByTestId('story-paused-pill')).toBeNull();
  });

  it('lets players tap all 3 Beat-3 Orange cards to complete the micro-Set and keeps Skip visible on Beat 3', () => {
    const onDone = jest.fn();
    const screen = render(wrap(<StoryIntro fighter="Orange Tabby" onDone={onDone} />));

    fireEvent.press(screen.getByTestId('story-next')); // Beat 2
    fireEvent.press(screen.getByTestId('story-next')); // Beat 3

    // Skip stays visible on Beat 3 too
    expect(screen.getByTestId('story-skip')).toBeTruthy();

    // Tap all 3 live cards (Orange Triangle, Orange Circle, Orange Bolt)
    fireEvent.press(screen.getByTestId('story-hero-card-0'));
    fireEvent.press(screen.getByTestId('story-hero-card-1'));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('story-hero-card-2'));

    expect(screen.getByTestId('story-hero-set-complete')).toBeTruthy();
    expect(mockSfx).toHaveBeenCalledWith('match');
    act(() => { jest.advanceTimersByTime(300); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 3B: [OB-06] UnlockReveal immediate CTA responsiveness & Claim All', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => { jest.clearAllTimers(); });
    jest.useRealTimers();
  });

  it('unlocks primary CTA right at SWAP_MS (~256ms, zero 340-420ms dead lock) and trims starsLandedMs', () => {
    expect(starsLandedMs(3)).toBe(1320);

    const onDone = jest.fn();
    const save = createSaveBefore('1-2');
    const screen = render(wrap(
      <UnlockReveal
        unlocks={[{ kind: 'weapon', id: 'rainbow-charm', star: 2, firstWeapon: false }]}
        save={save}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onDone={onDone}
      />
    ));

    fireEvent.press(screen.getByTestId('unlock-reveal'));
    // Advance only 300ms (just past SWAP_MS = 256ms, well before the old 976ms ACT_MS lock!)
    act(() => { jest.advanceTimersByTime(300); });
    expect(screen.getByTestId('unlock-primary')).toBeTruthy();
    fireEvent.press(screen.getByTestId('unlock-primary'));
    act(() => { jest.advanceTimersByTime(500); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('renders Claim All on multi-unlock queues and finishes immediately on tap', () => {
    const onDone = jest.fn();
    const save = createSaveBefore('1-10');
    const screen = render(wrap(
      <UnlockReveal
        unlocks={[
          { kind: 'evolution', id: 'phoenix-pyre', star: 1, firstEvolution: true },
          { kind: 'weapon', id: 'war-drum', star: 2, firstWeapon: false },
          { kind: 'summit', star: 1 },
        ]}
        save={save}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onDone={onDone}
      />
    ));

    const claimAll = screen.getByTestId('unlock-claim-all');
    expect(screen.getByText('Claim All (3)')).toBeTruthy();
    fireEvent.press(claimAll);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 3B: [OB-08] + [AU-13] Repeat/post-pick EvolutionBanner, 200ms guard & mount audio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBandCue.mockClear();
    mockBandEvolve.mockClear();
  });
  afterEach(() => {
    act(() => { jest.clearAllTimers(); });
    jest.useRealTimers();
  });

  it('emits non-blocking banner segment for repeat/post-pick evolutions while keeping first-time cutIn blocking', () => {
    const recipe = EVOLUTION_RECIPES[0];
    const ev: RunEvent = { id: 1, type: 'evolution_start', text: recipe.name };

    const firstScript = scriptFor([ev], { weapons: [] });
    expect(firstScript.segments.some(s => s.kind === 'cutIn')).toBe(true);

    const repeatScript = scriptFor([ev], { weapons: [], bannerOnlyRecipes: new Set([recipe.id]) });
    expect(repeatScript.segments.some(s => s.kind === 'banner')).toBe(true);
    expect(repeatScript.segments.some(s => s.kind === 'cutIn')).toBe(false);

    // Non-blocking banner never sets fx.busy = true
    const { result } = renderHook(() => {
      const anchors = useAnchors();
      return useFightFx({ anchors });
    });
    act(() => result.current.play(repeatScript));
    expect(result.current.banner?.recipes).toEqual([recipe.id]);
    expect(result.current.cutIn).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('tightens EvolutionCutIn guard to 200ms and fires mount audio cues on CutIn & EvolutionPickOverlay', () => {
    const recipe = EVOLUTION_RECIPES[0];
    const onDone = jest.fn();
    const view = render(
      <EvolutionCutIn recipes={[recipe]} weapons={[]} seconds={30} size={{ w: 375, h: 700 }} onDone={onDone} />
    );
    expect(mockBandEvolve).toHaveBeenCalledWith(recipe.id);

    // Tap at 0ms is ignored (< 200ms guard)
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => { jest.advanceTimersByTime(150); });
    expect(onDone).not.toHaveBeenCalled();

    // Tap at 220ms (>= 200ms guard!) closes briskly in 110ms
    act(() => { jest.advanceTimersByTime(70); });
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => { jest.advanceTimersByTime(120); });
    expect(onDone).toHaveBeenCalledTimes(1);

    // EvolutionPickOverlay fires 3 staggered reelStop cues on mount
    const pick = render(
      <EvolutionPickOverlay
        optionIds={[EVOLUTION_RECIPES[0].id, EVOLUTION_RECIPES[1].id]}
        totalIdle={2}
        onPick={() => {}}
      />
    );
    act(() => { jest.advanceTimersByTime(200); });
    expect(mockBandCue.mock.calls.filter(c => c[0] === 'reelStop')).toHaveLength(3);
    pick.unmount();
  });
});

describe('Wave 3B: [OB-09] & [OB-12] 2-2 taughtOnPreview, MechanicIntro Skip & 3 stale mechanics.ts copy fixes', () => {
  it('unifies 2-2 evolutions into taughtOnPreview so Fight launches with zero double-modal', () => {
    const save22 = createSaveBefore('2-2');
    const lvl22 = getLevel('2-2');
    const due = lessonsDueBefore(lvl22, save22);
    expect(due.length).toBeGreaterThanOrEqual(1);
    expect(due.every(p => taughtOnPreview(p, lvl22))).toBe(true);
  });

  it('always renders Skip on MechanicIntro and Skip check on quiz steps', () => {
    const onClose = jest.fn();
    const mechWithQuiz = Object.values(MECHANICS).find(m => (m.quiz?.length ?? 0) > 0)!;
    const view = render(<MechanicIntro mechanic={mechWithQuiz} onClose={onClose} />);
    expect(view.getByTestId('mechanic-intro-skip')).toBeTruthy();

    // Step to a quiz step and verify "Skip check ›" advances cleanly
    let guard = 0;
    while (!view.queryByTestId('quiz-skip') && view.queryByTestId('mechanic-intro-ok') && guard++ < 10) {
      fireEvent.press(view.getByTestId('mechanic-intro-ok'));
    }
    expect(view.getByTestId('quiz-skip')).toBeTruthy();
    fireEvent.press(view.getByTestId('quiz-skip'));
    // Still works; now press top-right Skip pill to exit immediately
    fireEvent.press(view.getByTestId('mechanic-intro-skip'));
    expect(onClose).toHaveBeenCalled();
  });

  it('fixes all 3 stale copy bugs in mechanics.ts', () => {
    const evoDemo = MECHANICS.evolutions.demo;
    expect(evoDemo?.type).toBe('icons');
    if (evoDemo?.type === 'icons') {
      expect(evoDemo.items.some(it => it.label === '30s of power')).toBe(true);
      expect(evoDemo.items.some(it => it.label === '20s of power')).toBe(false);
    }
    expect(MECHANICS.bounty_board.body.join(' ')).toContain('Bounty Board at Camp');
    expect(MECHANICS.bounty_board.body.join(' ')).not.toContain('Bounty Board on the map');
    expect(MECHANICS.waves.fightTips?.[0]?.text).toContain('clock pauses briefly');
    expect(MECHANICS.waves.fightTips?.[0]?.text).not.toContain('clock keeps running');
  });
});

describe('Wave 3B: [OB-10] & [OB-11] Parry onboarding, dynamic 1-4D & 3-1 Shading Surge safety net', () => {
  it('moves Timing Parry debut to 1-6, keeps 1-10 ANY timing, and introduces Counter-Parry on 2-4', () => {
    expect(LEVELS).toHaveLength(59);
    expect(PRACTICE_LEVELS.map(l => l.id)).toEqual(['1-4D']);

    expect(resolveParrySpec(getLevel('1-5'))).toBeNull();
    expect(getParryArchetype('1-5')).toBeNull();
    expect(resolveParrySpec(getLevel('1-6'))?.counter).toEqual({ kind: 'any' });
    expect(resolveParrySpec(getLevel('1-10'))?.counter).toEqual({ kind: 'any' });
    expect(resolveParrySpec(getLevel('2-4'))?.counter).toEqual({ kind: 'color', color: 'red' });

    expect(MECHANICS.set_parry).toBeDefined();
    expect(MECHANICS.counter_parry).toBeDefined();

    // Live parry onboarding callouts (including colorblind ALL ORANGE (O) for 2-4!)
    const spec16 = resolveParrySpec(getLevel('1-6'))!;
    const windup = parryOnboardingCallout(
      { spec: spec16, phase: 'windup', msLeft: 9000, durationMs: 15500, warned: false, stallsUsed: 0, parries: 0, perfectParries: 0 },
      { seenWindup: false, seenPerfect: false, seenCounter: false }
    );
    expect(windup?.key).toBe(COACH_KEYS.parryFirstWindup);
    expect(windup?.text).toContain('Prism Dive');

    const perfect = parryOnboardingCallout(
      { spec: spec16, phase: 'windup', msLeft: 2500, durationMs: 15500, warned: true, stallsUsed: 0, parries: 0, perfectParries: 0 },
      { seenWindup: true, seenPerfect: false, seenCounter: false }
    );
    expect(perfect?.key).toBe(COACH_KEYS.parryFirstPerfect);
    expect(perfect?.text).toContain('PERFECT PARRY');

    const spec24 = resolveParrySpec(getLevel('2-4'))!;
    const counterCb = parryOnboardingCallout(
      { spec: spec24, phase: 'windup', msLeft: 8000, durationMs: 12000, warned: false, stallsUsed: 0, parries: 0, perfectParries: 0 },
      { colorblind: true, seenWindup: true, seenPerfect: true, seenCounter: false }
    );
    expect(counterCb?.key).toBe(COACH_KEYS.counterParryFirst);
    expect(counterCb?.text).toContain('ALL ORANGE (O)');

    const card = render(<ParryPreviewCard spec={spec16} isNew />);
    expect(card.getByTestId('parry-new-badge')).toBeTruthy();
  });

  it('resolves 1-4D dynamically from unlocked traits/features and adds 3-1 Shading Surge 5s nudge', () => {
    const practice = getLevel('1-4D');
    const after14 = createSaveBefore('1-5');
    const resolvedEarly = resolvePracticeLevel(practice, after14);
    expect(resolvedEarly.rules.attributes).toEqual(['shape', 'color']);
    expect(resolvedEarly.rules.boardSize).toBe(9);
    expect(resolvedEarly.rules.startingHints).toBe(0);
    expect(resolvedEarly.rules.startingGraces).toBe(0);
    expect(resolvedEarly.rules.evolutionLikelihood).toBe(0);
    expect(resolvePracticeFeatures(practice, after14)?.has('hints')).toBe(false);

    const after28 = createSaveBefore('2-9');
    const resolvedLate = resolvePracticeLevel(practice, after28);
    expect(resolvedLate.rules.attributes).toEqual(['shape', 'color', 'number']);
    expect(resolvedLate.rules.boardSize).toBe(12);
    expect(resolvedLate.rules.startingHints).toBe(3);
    expect(resolvedLate.rules.startingGraces).toBe(2);
    expect(resolvedLate.rules.evolutionLikelihood).toBe(15);

    // 1-4 unlocks Damage Numbers (splitting 1-7's 5-system dump)
    expect(shouldShowDamageNumbers(getLevel('1-3'), createNewSave())).toBe(false);
    expect(shouldShowDamageNumbers(getLevel('1-4'), createNewSave())).toBe(true);

    // 3-1 Shading Surge safety net: 28s base assist + 5s 1-card glow during first 2 Surges
    expect(assistStepsFor(getLevel('3-1'))).toEqual(THIRD_WORLD_INTRO_ASSIST_STEPS);
    const save31 = createSaveBefore('3-1');
    let run31 = createRun(getLevel('3-1'), save31, { seed: 31 });
    run31 = {
      ...run31,
      attributes: ['shape', 'color', 'number', 'shading'],
      elapsedMs: 52000,
      lastMatchAtMs: 45000,
      surge: { active: true, msLeft: SURGE_RULES.surgeMs - 6000, count: 1, sets: 0 },
    };
    const surgeNudge = computeLiveGuidance(run31, { seenIntro: true, surgeGuidedCount: 0 });
    expect(surgeNudge?.kind).toBe('rescue');
    expect(surgeNudge?.glowIds).toHaveLength(1);
    expect(surgeNudge?.message).toContain('Shading Surge');
  });
});

describe('Wave 3B: [OB-13] & [OB-17] DefeatOverlay instant retry, Closest Yet! bar & context-aware tips', () => {
  it('never recommends Number on 2-trait levels, Skill Tree before 1-7, or unowned Rainbow Charm', () => {
    const save12 = createSaveBefore('1-2');
    const lvl12 = getLevel('1-2');
    const base12 = createRun(lvl12, save12, { seed: 12 });

    // Priority 1: mistakes > 3 on 2-trait 1-2 lists ONLY Color & Shape (NEVER Number!)
    const mistakeTip = diagnoseResultTip(lvl12, { ...base12, mistakes: 5 }, 0, save12);
    expect(mistakeTip?.text).toContain('Color');
    expect(mistakeTip?.text).toContain('Shape');
    expect(mistakeTip?.text).not.toContain('Number');

    // Clean defeat on 1-2 (before 1-7): NEVER mentions Skill Tree!
    const cleanLoss12 = diagnoseResultTip(lvl12, { ...base12, mistakes: 0 }, 0, save12);
    expect(cleanLoss12?.text).not.toContain('Skill Tree');

    // 1★ survival on 1-2 before owning Rainbow Charm: NEVER mentions Rainbow Charm!
    const survival12 = diagnoseResultTip(lvl12, { ...base12, mistakes: 0 }, 1, save12);
    expect(survival12?.text ?? '').not.toContain('Rainbow Charm');

    // World 2+ defeat with unarmed evolution offers 1-tap "Arm <Recipe> & Retry"
    const maxed = { ...createMaxedSave(), charms: [] };
    const lvl22 = getLevel('2-2');
    const run22 = { ...createRun(lvl22, maxed, { seed: 22 }), armedRecipes: [], mistakes: 0 };
    const evoTip = diagnoseResultTip(lvl22, run22, 0, maxed);
    expect(evoTip?.quickAction?.kind).toBe('arm_recipe');
    expect(evoTip?.quickAction?.label).toMatch(/^Arm .+ & Retry$/);
    expect(armableRecipesFromArmory(maxed).length).toBeGreaterThan(0);
  });

  it('renders DefeatOverlay with Closest Yet! bar, hidden purse, 1-tap Arm & Retry, Tailwind toggle, and instant RETRY', () => {
    const lvl12 = getLevel('1-2');
    const save12 = { ...createSaveBefore('1-2'), consecutiveLosses: { '1-2': 1 } };
    const run12: RunState = {
      ...createRun(lvl12, save12, { seed: 12 }),
      status: 'lost',
      endReason: 'hearts',
      hearts: 0,
      foeHp: 4,
      foeMaxHp: 42,
      matches: 4,
    };
    const res = applyLevelResult(save12, lvl12, 0, 0, run12);
    expect(res.isClosestYet).toBe(true);
    expect(res.hiddenPurseDeposited).toBeGreaterThanOrEqual(5);

    const onRetry = jest.fn();
    const onFullBreakdown = jest.fn();
    const onToggleTailwind = jest.fn();
    const screen = render(wrap(
      <DefeatOverlay
        level={lvl12}
        run={run12}
        result={res}
        onRetry={onRetry}
        onFullBreakdown={onFullBreakdown}
        onCamp={() => {}}
        onMap={() => {}}
        onToggleTailwind={onToggleTailwind}
      />
    ));

    expect(screen.getByTestId('defeat-overlay')).toBeTruthy();
    expect(screen.getByTestId('defeat-near-miss')).toBeTruthy();
    expect(screen.getByTestId('defeat-closest-bar')).toBeTruthy();
    expect(screen.getByTestId('defeat-hidden-purse')).toBeTruthy();
    expect(screen.getByTestId('defeat-tailwind-toggle')).toBeTruthy();

    fireEvent.press(screen.getByTestId('defeat-tailwind-toggle'));
    expect(onToggleTailwind).toHaveBeenCalledWith(true);
    fireEvent.press(screen.getByTestId('defeat-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('defeat-breakdown'));
    expect(onFullBreakdown).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 3B: [OB-15], [OB-16], [OB-19], [OB-20] & [TP-17] Voiced quips, auto-wave, 5-5 Ending & Overlay Mutex', () => {
  beforeEach(() => {
    mockKvStore.clear();
    jest.useFakeTimers();
    mockBandFinale.mockClear();
  });
  afterEach(() => {
    act(() => { jest.clearAllTimers(); });
    jest.useRealTimers();
  });

  it('gives every fighter distinct mid-fight combat quips and boss barks, plus Raider/Boss story callbacks', () => {
    const fighters = ['Orange Tabby', 'Sly Fox', 'Emperor Penguin', 'Badger', 'Corgi', 'Pelican'] as const;
    const halfwaySet = new Set(fighters.map(f => companionVoice(f).halfway));
    expect(halfwaySet.size).toBe(6);

    const run12 = createRun(getLevel('1-2'), { ...createSaveBefore('1-2'), selectedFighter: 'Corgi' }, { seed: 2 });
    expect(fightRemarks({ ...run12, foeHp: run12.foeMaxHp / 2 }, false)[0].text).toBe(companionVoice('Corgi').halfway);

    const bossRun = createRun(getLevel('1-10'), createMaxedSave(), { seed: 10 });
    expect(foeMidFightBark({ ...bossRun, foeHp: bossRun.foeMaxHp / 2 })?.key).toBe('foe-half-0');

    expect(STORY_RAIDER_TAUNTS['1-10']).toContain('Golden Keys');
    expect(STORY_RAIDER_TAUNTS['2-4']).toContain('keys');
    expect(STORY_BOSS_CALLBACKS['5-5']).toContain('Hydra');
  });

  it('caps mechanic-intro opening taunt at 900ms on 1-2 and auto-advances shopless 3-3 waves', () => {
    const save12 = createSaveBefore('1-2');
    const screen12 = render(wrap(
      <AdventureRun
        level={getLevel('1-2')}
        save={save12}
        seed={12}
        onFinish={() => {}}
        onQuit={() => {}}
        onRestart={() => {}}
        onCoachMarkSeen={() => {}}
      />
    ));
    expect(screen12.getByTestId('run-foe-taunt')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(950); });
    expect(screen12.queryByTestId('run-foe-taunt')).toBeNull();
    screen12.unmount();

    // 3-3 has 3 waves and no shop: clearing wave 1 enters intermission and auto-advances without blocking modal
    const save33 = createSaveBefore('3-3');
    const run33 = createRun(getLevel('3-3'), save33, { seed: 33 });
    expect(run33.features.has('shop')).toBe(false);
    const clearedWave = runReducer({ ...run33, foeHp: 0 }, { type: 'TICK', ms: 250 });
    expect(clearedWave.status).toBe('intermission');
  });

  it('renders 5-5 StoryEndingModal through all 3 beats (Star Restored, Reunion, Credits + Summit torch-pass)', () => {
    const save = createMaxedSave();
    const onDone = jest.fn();
    const onOpenSummit = jest.fn();
    const view = render(wrap(
      <StoryEndingModal visible save={save} onDone={onDone} onOpenSummit={onOpenSummit} />
    ));

    expect(view.getByTestId('story-ending-modal')).toBeTruthy();
    expect(mockBandFinale).toHaveBeenCalledWith(true);

    // Beat 1 → Beat 2 (Full Crew Reunion + stats)
    fireEvent.press(view.getByTestId('ending-next'));
    expect(view.getByTestId('ending-crew-grid')).toBeTruthy();
    expect(view.getByTestId('ending-stat-stars')).toBeTruthy();
    expect(view.getByTestId('ending-stat-favorite')).toBeTruthy();
    expect(view.getByTestId('ending-stat-sets')).toBeTruthy();
    for (const f of save.unlockedFighters) {
      expect(view.getByTestId(`ending-crew-${f}`)).toBeTruthy();
    }

    // Beat 2 → Beat 3 (Credits + Climb Starfall Summit torch-pass)
    fireEvent.press(view.getByTestId('ending-next'));
    expect(view.getByTestId('ending-credits-card')).toBeTruthy();
    fireEvent.press(view.getByTestId('ending-summit'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpenSummit).toHaveBeenCalledTimes(1);
    expect(markEndingSeen({ ...save, endingSeen: false }).endingSeen).toBe(true);
  });

  it('[TP-17] cancels pending UnlockReveal timer on rapid Results → Map tap and triggers 5-5 ending on Results', () => {
    // 1. Rapid tap Results → Map while UnlockReveal timer is armed never pops unlock-modal onto Map!
    const save11 = createNewSave();
    const lvl11 = getLevel('1-1');
    const won11: RunState = {
      ...createRun(lvl11, save11, { seed: 1 }),
      status: 'won',
      endReason: 'defeated',
      foeHp: 0,
      challengeMet: true,
    };
    const screen = render(wrap(
      <AdventureMode
        initialSave={save11}
        devResult={{ levelId: '1-1', run: won11, stars: 3 }}
        onExit={() => {}}
      />
    ));

    // Immediately tap Map before starsLandedMs(3) = 1320ms elapses!
    fireEvent.press(screen.getByTestId('results-map'));
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('unlock-modal')).toBeNull();
    expect(screen.getByTestId('map-guide-banner')).toBeTruthy();
    screen.unmount();

    // 2. LevelResults 5-5 boss clear displays Hydra story callback + Watch Ending Ceremony button
    const save55 = createSaveBefore('5-5');
    const lvl55 = getLevel('5-5');
    const won55: RunState = {
      ...createRun(lvl55, save55, { seed: 55 }),
      status: 'won',
      endReason: 'defeated',
      foeHp: 0,
      challengeMet: true,
    };
    const onWatchEnding = jest.fn();
    const res55 = render(wrap(
      <LevelResults
        level={lvl55}
        run={won55}
        stars={3}
        result={applyLevelResult(save55, lvl55, 3, 0, won55)}
        unlocksRevealed
        nextLevel={null}
        nextUnlocked={false}
        onRetry={() => {}}
        onNext={() => {}}
        onMap={() => {}}
        onCamp={() => {}}
        onWatchEnding={onWatchEnding}
      />
    ));
    expect(res55.getByText(STORY_BOSS_CALLBACKS['5-5'])).toBeTruthy();
    fireEvent.press(res55.getByTestId('results-watch-ending'));
    expect(onWatchEnding).toHaveBeenCalledTimes(1);
  });
});
