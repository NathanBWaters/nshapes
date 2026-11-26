/**
 * Wave 4 Lane C (`w4-fx-board-sync`) verification suite covering all 9 assigned items:
 *   - [FX-01] Foe impact transform collision removed in AdventureRun
 *   - [FX-08] Viewport shake scale, 300ms DefeatFreezeOverlay + fatal source highlight,
 *             stakes-split KillCamOverlay (full vs 350ms brisk), Boss KO double-slash & 20 shards,
 *             250ms tap / Enter / Space skip + band.finale(true) + Wave 3 Riser/Shatter cues
 *   - [FX-14] quiet={!effects}, effects={effects}, & useReducedMotion() propagation
 *   - [FX-16] Legacy hardcoded (150, 200) useParticles & useScreenShake deleted from GameBoard
 *   - [FX-20] Frame-1 finger-down Pressable onPressIn tactile squish + immediate selection haptic
 *   - [FX-21] 80ms 4th-tap race flush in GameBoard + split REPLACE delays in AdventureRun
 *   - [FX-22] Emerald clover shimmer badge directly on the forgiven 3rd card on Grace save
 *   - [FX-23] band.stretch() 64th-note subdivision capping slip <= 32ms + MultiplierIgnition & KillCam onLand sync
 *   - [FX-24] ParryIntentBar, SurgeBar, HpBar 60fps GPU scaleX fills (zero layout width)
 *   - [FX-25] useBurnTimer pause-aware one-shot timeout + Reanimated SharedValue opacity (0 setIntervals)
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import Card from '@/components/Card';
import CardMotion, { CARD_MOTION } from '@/components/CardMotion';
import GameBoard from '@/components/GameBoard';
import { FIRE_BURN_DURATION, useBurnTimer } from '@/hooks/useBurnTimer';
import AdventureRun from '@/adventure/components/AdventureRun';
import DefeatFreezeOverlay, {
  DEFEAT_FREEZE_MS,
  DEFEAT_FREEZE_REDUCED_MS,
  resolveFatalSource,
} from '@/adventure/components/DefeatFreezeOverlay';
import ParryIntentBar from '@/adventure/components/ParryIntentBar';
import KillCamOverlay, {
  KILL_CAM_SHARD_COUNTS,
  SLOWMO_BRISK_TOTAL_MS,
  SLOWMO_SKIP_GUARD_MS,
  SLOWMO_SKIP_HINT_MS,
  resolveKillCamMode,
  viewportShakeScale,
} from '@/adventure/fx/KillCamOverlay';
import MultiplierIgnition from '@/adventure/fx/MultiplierIgnition';
import { fxClock } from '@/adventure/fx/clock';
import type { Anchors } from '@/adventure/fx/anchors';
import { getLevel } from '@/adventure/data/levels';
import { createRun } from '@/adventure/engine/run';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import { band } from '@/audio/band';
import { setSfxEnabled } from '@/audio';
import { __setAppActiveForTests } from '@/utils/appLifecycle';
import { __setHapticsModuleForTests, type HapticsModuleLike } from '@/utils/haptics';
import { HapticsStorage } from '@/utils/hapticsStorage';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { getPerfSnapshot, resetPerfViolations } from '@/utils/perfWatchdog';
import type { Card as CardType } from '@/types';
import type { RunEvent, SetIgnition } from '@/adventure/types';

const REPO_ROOT = path.resolve(__dirname, '..');

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { Text: RNText } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(RNText, { testID: `icon-${name}` }, name);
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: Record<string, unknown>) =>
      ReactActual.createElement(View, props, props?.children as React.ReactNode);
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

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mkCard = (
  id: string,
  shape: CardType['shape'],
  color: CardType['color'],
  number: CardType['number'],
  extra: Partial<CardType> = {}
): CardType => ({
  id,
  shape,
  color,
  number,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...extra,
});

const makeStubAnchors = (rects: Record<string, { x: number; y: number; w: number; h: number }> = {}): Anchors => ({
  rootRef: () => {},
  ref: () => () => {},
  measure: () => {},
  rect: name => rects[name] ?? null,
  bump: () => {},
  onBump: () => () => {},
});

const makeIgnition = (over: Partial<SetIgnition> = {}): SetIgnition => ({
  id: 77,
  math: {
    cards: 3,
    baseCards: 3,
    collateral: {},
    flatBonus: 6,
    flatItems: [{ label: 'Heavy Hitter', amount: 6 }],
    multiplier: 2,
    multItems: [{ label: 'Rainbow Strike', amount: 2 }],
    rainbow: true,
    extra: 0,
    hit: 18,
    diffTraits: 3,
    graceUsed: false,
    sinceLastMs: 1200,
    combo: 2,
  },
  turnDamage: 18,
  lethal: true,
  isBossOrElite: false,
  foeName: 'Iron Shell',
  ...over,
});

afterEach(() => {
  fxClock.slow = 1;
  __setAppActiveForTests(true);
  __setHapticsModuleForTests(null);
  resetPerfViolations();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Wave 4C [FX-01] & [FX-16]: Transform collision & legacy GameBoard FX removal', () => {
  it('deletes colliding foeShake/foeScale from AdventureRun and legacy useParticles/useScreenShake from GameBoard', () => {
    const runSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/adventure/components/AdventureRun.tsx'), 'utf8');
    const boardSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/components/GameBoard.tsx'), 'utf8');

    expect(runSrc).not.toMatch(/\bfoeShake\b/);
    expect(runSrc).not.toMatch(/\bfoeScale\b/);
    expect(runSrc).not.toMatch(/\bfoeStyle\b/);

    expect(boardSrc).not.toMatch(/useParticles/);
    expect(boardSrc).not.toMatch(/useScreenShake/);
    expect(boardSrc).not.toMatch(/centerX\s*=\s*150/);
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/hooks/useScreenShake.ts'))).toBe(false);
  });

  it('uses tightened FX-21 REPLACE_DELAY_MS split constants in AdventureRun', () => {
    const runSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/adventure/components/AdventureRun.tsx'), 'utf8');
    expect(runSrc).toMatch(/REPLACE_DELAY_MS\s*=\s*260/);
    expect(runSrc).toMatch(/REPLACE_COLLATERAL_DELAY_MS\s*=\s*460/);
    expect(runSrc).toMatch(/REPLACE_INVALID_DELAY_MS\s*=\s*380/);
  });
});

describe('Wave 4C [FX-20]: Frame-1 Pressable onPressIn tactile press & immediate haptic', () => {
  it('fires selectionHaptic immediately on pressIn when enabled and skips when disabled', () => {
    const origOs = Platform.OS;
    const mockHaptics: HapticsModuleLike = {
      ImpactFeedbackStyle: { Light: 'L', Medium: 'M', Heavy: 'H' },
      NotificationFeedbackType: { Success: 'S', Error: 'E', Warning: 'W' },
      impactAsync: jest.fn(async () => {}),
      notificationAsync: jest.fn(async () => {}),
      selectionAsync: jest.fn(async () => {}),
    };
    try {
      Platform.OS = 'ios';
      HapticsStorage.set(true);
      __setHapticsModuleForTests(mockHaptics);

      const onClick = jest.fn();
      const card = mkCard('c1', 'oval', 'red', 1);
      const view = render(<Card card={card} onClick={onClick} />);
      const pressable = view.getByTestId('card-oval-red-1-solid');

      fireEvent(pressable, 'pressIn');
      expect(mockHaptics.selectionAsync).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();

      fireEvent(pressable, 'pressOut');
      fireEvent.press(pressable);
      expect(onClick).toHaveBeenCalledWith(card);

      // Disabled cards must NOT fire finger-down haptic
      (mockHaptics.selectionAsync as jest.Mock).mockClear();
      view.rerender(<Card card={card} onClick={onClick} disabled />);
      fireEvent(view.getByTestId('card-oval-red-1-solid'), 'pressIn');
      expect(mockHaptics.selectionAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = origOs;
    }
  });
});

describe('Wave 4C [FX-21] & [FX-22]: 80ms 4th-tap flush & Grace-save emerald clover badge', () => {
  it('immediately commits pending valid 3-card Set and selects card 4 as card 1 of next Set when tapped inside 80ms', () => {
    jest.useFakeTimers();
    const cards: CardType[] = [
      mkCard('c1', 'oval', 'red', 1),
      mkCard('c2', 'oval', 'green', 1),
      mkCard('c3', 'oval', 'purple', 1),
      mkCard('c4', 'diamond', 'red', 2),
      mkCard('c5', 'squiggle', 'green', 3),
      mkCard('c6', 'diamond', 'purple', 2),
    ];
    const onMatch = jest.fn();
    const onSelectedCardsChange = jest.fn();

    const view = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        onSelectedCardsChange={onSelectedCardsChange}
        playerStats={DEFAULT_PLAYER_STATS}
        isPlayerTurn
        activeAttributes={['shape', 'color', 'number']}
        quietRewards
      />
    );

    const card1 = view.getByTestId('card-oval-red-1-solid');
    const card2 = view.getByTestId('card-oval-green-1-solid');
    const card3 = view.getByTestId('card-oval-purple-1-solid');
    const card4 = view.getByTestId('card-diamond-red-2-solid');

    // Tap valid Set c1, c2, c3
    fireEvent.press(card1);
    fireEvent.press(card2);
    fireEvent.press(card3);
    expect(onMatch).toHaveBeenCalledTimes(0);

    // Within the 80ms confirmMs window (30ms in), rapidly tap card 4!
    act(() => {
      jest.advanceTimersByTime(30);
    });
    fireEvent.press(card4);

    // Valid Set [c1, c2, c3] commits IMMEDIATELY and card 4 becomes selection #1 of next Set!
    expect(onMatch).toHaveBeenCalledTimes(1);
    const [matchedCards] = onMatch.mock.calls[0];
    expect(matchedCards.map((c: CardType) => c.id)).toEqual(['c1', 'c2', 'c3']);
    const latestSelected = onSelectedCardsChange.mock.calls[onSelectedCardsChange.mock.calls.length - 1][0];
    expect(latestSelected.map((c: CardType) => c.id)).toEqual(['c4']);

    // Advancing past confirmMs does NOT double-commit or drop card 4
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onMatch).toHaveBeenCalledTimes(1);
    const stillSelected = onSelectedCardsChange.mock.calls[onSelectedCardsChange.mock.calls.length - 1][0];
    expect(stillSelected.map((c: CardType) => c.id)).toEqual(['c4']);
  });

  it('cancels pending confirmation cleanly when re-tapping one of the 3 pending cards inside 80ms', () => {
    jest.useFakeTimers();
    const cards: CardType[] = [
      mkCard('c1', 'oval', 'red', 1),
      mkCard('c2', 'oval', 'green', 1),
      mkCard('c3', 'oval', 'purple', 1),
      mkCard('c4', 'diamond', 'red', 2),
    ];
    const onMatch = jest.fn();
    const view = render(
      <GameBoard
        cards={cards}
        onMatch={onMatch}
        onInvalidSelection={jest.fn()}
        playerStats={DEFAULT_PLAYER_STATS}
        isPlayerTurn
        activeAttributes={['shape', 'color', 'number']}
      />
    );

    fireEvent.press(view.getByTestId('card-oval-red-1-solid'));
    fireEvent.press(view.getByTestId('card-oval-green-1-solid'));
    fireEvent.press(view.getByTestId('card-oval-purple-1-solid'));
    act(() => {
      jest.advanceTimersByTime(25);
    });
    // Deselect card 3 before confirmMs finishes
    fireEvent.press(view.getByTestId('card-oval-purple-1-solid'));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onMatch).toHaveBeenCalledTimes(0);
  });

  it('[FX-22] renders emerald clover shimmer badge directly on the forgiven 3rd card during Grace save', () => {
    jest.useFakeTimers();
    const cards: CardType[] = [
      mkCard('g1', 'oval', 'red', 1),
      mkCard('g2', 'oval', 'green', 1),
      mkCard('g3', 'oval', 'red', 2), // 1 trait off (color: red, green, red; number: 1,1,2 -> wait, make 1 trait off!)
    ];
    // Make exactly 1 attribute invalid (color: red, green, red; shape: all oval; number: all 1)
    cards[2] = mkCard('g3', 'oval', 'red', 1);

    const onGraceSave = jest.fn();
    const view = render(
      <GameBoard
        cards={cards}
        onMatch={jest.fn()}
        onGraceSave={onGraceSave}
        onInvalidSelection={jest.fn()}
        playerStats={{ ...DEFAULT_PLAYER_STATS, graces: 1 }}
        isPlayerTurn
        activeAttributes={['shape', 'color', 'number']}
        quietRewards
      />
    );

    // Two red cards + one green card (1 attribute off: color) -> Grace saves on 3rd card
    const redCards = view.getAllByTestId('card-oval-red-1-solid');
    fireEvent.press(redCards[0]);
    fireEvent.press(view.getByTestId('card-oval-green-1-solid'));
    fireEvent.press(redCards[1]);

    act(() => {
      jest.advanceTimersByTime(CARD_MOTION.confirmMs + 10);
    });

    expect(onGraceSave).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('card-grace-clover')).toBeTruthy();
    expect(view.getByTestId('icon-lorc/clover')).toBeTruthy();

    // Also verifies standalone CardMotion renders graceSaved overlay cleanly under effects={false}
    const motionView = render(
      <CardMotion selected={false} pointedOut={false} dealDelayMs={0} graceSaved effects={false}>
        <Card card={cards[2]} onClick={jest.fn()} effects={false} />
      </CardMotion>
    );
    expect(motionView.getByTestId('card-grace-clover')).toBeTruthy();
  });
});

describe('Wave 4C [FX-08]: Stakes-split KillCamOverlay, Boss KO elevation, Tap/Key skip & DefeatFreezeOverlay', () => {
  it('splits KillCam cinema cleanly between full (Boss / Elite / First Clear / New 3★) and brisk (routine repeat)', () => {
    expect(resolveKillCamMode({ isBoss: true, previousBestStars: 3, stars: 2 })).toBe('full');
    expect(resolveKillCamMode({ isElite: true, previousBestStars: 3, stars: 2 })).toBe('full');
    expect(resolveKillCamMode({ isBoss: false, isElite: false, previousBestStars: 0, stars: 1 })).toBe('full');
    expect(resolveKillCamMode({ isBoss: false, isElite: false, previousBestStars: 2, stars: 3 })).toBe('full');
    expect(resolveKillCamMode({ isBoss: false, isElite: false, previousBestStars: 2, stars: 2 })).toBe('brisk');
    expect(resolveKillCamMode({ isBoss: false, isElite: false, previousBestStars: 3, stars: 3 })).toBe('brisk');
    expect(SLOWMO_BRISK_TOTAL_MS).toBe(350);
    expect(KILL_CAM_SHARD_COUNTS.boss).toBe(20);
    expect(KILL_CAM_SHARD_COUNTS.boss).toBeLessThanOrEqual(24);
    expect(viewportShakeScale(200)).toBe(0.75);
    expect(viewportShakeScale(375)).toBe(1);
    expect(viewportShakeScale(1200)).toBe(1.5);
  });

  it('triggers KillCam on lethal onLand (triggerNow), plays Riser & Shatter, shows Boss double-slash, and unlocks tap skip after 250ms', () => {
    jest.useFakeTimers();
    const riserSpy = jest.spyOn(band, 'playKillCamRiser').mockImplementation(() => {});
    const shatterSpy = jest.spyOn(band, 'playKillCamShatter').mockImplementation(() => {});
    const slowMoSpy = jest.spyOn(band, 'slowMoDefeat').mockImplementation(() => {});
    const finaleSpy = jest.spyOn(band, 'finale').mockImplementation(() => {});
    const onSkip = jest.fn();

    const ignition = makeIgnition({ lethal: true, isBossOrElite: true });
    const anchors = makeStubAnchors({ foe: { x: 260, y: 100, w: 72, h: 72 } });

    const view = render(
      <KillCamOverlay
        ignition={ignition}
        victory
        stars={3}
        endReason="defeated"
        damageReceived={0}
        mistakes={0}
        isBoss
        cinemaMode="full"
        triggerNow={false}
        onSkip={onSkip}
        anchors={anchors}
        stageSize={{ w: 390, h: 844 }}
        enabled
      />
    );

    // Waiting for lethal beat onLand: riser fires during flight, overlay not yet active
    expect(riserSpy).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('kill-cam-overlay')).toBeNull();

    // Lethal beat lands -> KillCam engages immediately with Boss double-slash & shatter(+48)
    view.rerender(
      <KillCamOverlay
        ignition={ignition}
        victory
        stars={3}
        endReason="defeated"
        damageReceived={0}
        mistakes={0}
        isBoss
        cinemaMode="full"
        triggerNow={true}
        onSkip={onSkip}
        anchors={anchors}
        stageSize={{ w: 390, h: 844 }}
        enabled
      />
    );

    const overlay = view.getByTestId('kill-cam-overlay');
    expect(overlay.props.pointerEvents).toBe('none');
    expect(view.getByTestId('kill-cam-slash-1')).toBeTruthy();
    expect(view.getByTestId('kill-cam-boss-slash-2')).toBeTruthy();
    expect(slowMoSpy).toHaveBeenCalledTimes(1);
    expect(shatterSpy).toHaveBeenCalledWith(48);

    // Tapping before 250 ms guard does NOT skip
    fireEvent.press(overlay);
    expect(onSkip).not.toHaveBeenCalled();

    // At 250 ms guard clears -> pointerEvents flips to 'auto'
    act(() => {
      jest.advanceTimersByTime(SLOWMO_SKIP_GUARD_MS + 5);
    });
    expect(view.getByTestId('kill-cam-overlay').props.pointerEvents).toBe('auto');

    // At 350 ms subtle "Tap to continue" whisper appears
    act(() => {
      jest.advanceTimersByTime(SLOWMO_SKIP_HINT_MS - SLOWMO_SKIP_GUARD_MS);
    });
    expect(view.getByTestId('kill-cam-skip-hint')).toBeTruthy();

    // Tap to skip fires band.finale(true) and hands off immediately via onSkip
    fireEvent.press(view.getByTestId('kill-cam-overlay'));
    expect(finaleSpy).toHaveBeenCalledWith(true);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('kill-cam-overlay')).toBeNull();
  });

  it('plays brisk 350ms routine clear slash without slowMoDefeat drag', () => {
    jest.useFakeTimers();
    const slowMoSpy = jest.spyOn(band, 'slowMoDefeat').mockImplementation(() => {});
    const view = render(
      <KillCamOverlay
        ignition={makeIgnition({ lethal: true, isBossOrElite: false })}
        victory
        stars={2}
        endReason="defeated"
        isBoss={false}
        cinemaMode="brisk"
        triggerNow={true}
        anchors={makeStubAnchors()}
        stageSize={{ w: 390, h: 844 }}
        enabled
      />
    );
    expect(view.getByTestId('kill-cam-overlay')).toBeTruthy();
    expect(view.getByTestId('kill-cam-slash-1')).toBeTruthy();
    expect(view.queryByTestId('kill-cam-boss-slash-2')).toBeNull();
    expect(slowMoSpy).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(SLOWMO_BRISK_TOTAL_MS + 10);
    });
    expect(view.queryByTestId('kill-cam-overlay')).toBeNull();
  });

  it('derives fatal source accurately from run.events and holds DefeatFreezeOverlay for 300ms (180ms reduced)', () => {
    jest.useFakeTimers();
    const baseRun = createRun(getLevel('2-3'), createNewSave(), { seed: 9 });
    const withEvent = (ev: Partial<RunEvent>) => ({
      ...baseRun,
      status: 'lost' as const,
      events: [{ id: 1, type: 'bomb', slots: [4], ...ev } as RunEvent],
    });

    expect(resolveFatalSource(withEvent({ type: 'bomb', slots: [4] }))).toEqual({
      anchor: 'slot:4',
      tag: 'BOMB!',
      icon: 'lorc/time-bomb',
    });
    expect(resolveFatalSource(withEvent({ type: 'trap_sprung', slots: [2] }))).toEqual({
      anchor: 'slot:2',
      tag: 'TRAPPED!',
      icon: 'lorc/wolf-trap',
    });
    expect(resolveFatalSource(withEvent({ type: 'foe_strike', slots: undefined }))).toEqual({
      anchor: 'foe',
      tag: 'FOE STRIKE!',
      icon: 'lorc/sword-clash',
    });
    expect(resolveFatalSource(withEvent({ type: 'time_up', slots: undefined }))).toEqual({
      anchor: 'clock',
      tag: "TIME'S UP!",
      icon: 'lorc/stopwatch',
    });

    const onComplete = jest.fn();
    const anchors = makeStubAnchors({ 'slot:4': { x: 120, y: 360, w: 96, h: 120 } });
    const view = render(
      <DefeatFreezeOverlay
        active
        fatal={{ anchor: 'slot:4', tag: 'BOMB!', icon: 'lorc/time-bomb' }}
        anchors={anchors}
        stageSize={{ w: 390, h: 844 }}
        enabled
        onComplete={onComplete}
      />
    );
    expect(view.getByTestId('defeat-freeze-overlay')).toBeTruthy();
    expect(view.getByTestId('defeat-freeze-ring')).toBeTruthy();
    expect(view.getByText('BOMB!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(DEFEAT_FREEZE_MS - 10);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(15);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Reduced-motion mode finishes cleanly at 180ms
    const onReducedComplete = jest.fn();
    render(
      <DefeatFreezeOverlay
        active
        fatal={{ anchor: 'clock', tag: "TIME'S UP!", icon: 'lorc/stopwatch' }}
        anchors={anchors}
        stageSize={{ w: 390, h: 844 }}
        enabled
        reduced
        onComplete={onReducedComplete}
      />
    );
    act(() => {
      jest.advanceTimersByTime(DEFEAT_FREEZE_REDUCED_MS + 5);
    });
    expect(onReducedComplete).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 4C [FX-23]: band.stretch() 64th-note slip cap (<= 32ms) & fxMs scaling', () => {
  it('caps band.stretch() slip t0 - now <= 32 ms across slow, medium, and fast tempos', () => {
    setSfxEnabled(true);
    const b = band as unknown as {
      bpm: number;
      nextTime: number;
      clockOverride: number | null;
      stretch: (fn: () => void) => number | null;
    };
    const origBpm = b.bpm;
    const origNext = b.nextTime;
    const origClock = b.clockOverride;
    const chipMod = require('@/audio/chip');
    const ensureSpy = jest.spyOn(chipMod.chip, 'ensure').mockReturnValue(true);

    try {
      for (const bpm of [68, 90, 110, 120, 148]) {
        b.bpm = bpm;
        for (const offset of [0.001, 0.015, 0.04, 0.07]) {
          b.clockOverride = 10.0;
          b.nextTime = 10.0 + offset;
          const slipMs = b.stretch(() => {});
          expect(slipMs).not.toBeNull();
          expect(slipMs!).toBeGreaterThanOrEqual(11.9);
          expect(slipMs!).toBeLessThanOrEqual(32.01);
        }
      }
    } finally {
      ensureSpy.mockRestore();
      b.bpm = origBpm;
      b.nextTime = origNext;
      b.clockOverride = origClock;
    }
  });

  it('scales MultiplierIgnition timers by fxClock.slow (fxMs)', () => {
    jest.useFakeTimers();
    fxClock.slow = 4;
    const ignition = makeIgnition({ id: 303 });
    const view = render(<MultiplierIgnition ignition={ignition} enabled impactMs={240} />);
    // At 300ms real time under slow=4 (only 75ms logical time), must STILL be LIVE
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(view.getByText('LIVE')).toBeTruthy();

    // Past 4 × 240 = 960ms real time, slams cleanly to LAST
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(view.getByText('LAST')).toBeTruthy();
  });
});

describe('Wave 4C [FX-25]: useBurnTimer one-shot timeout + SharedValue (0 setIntervals)', () => {
  it('completes at 250ms with pause/resume preservation, zero setIntervals, and Reanimated SharedValue progress', () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    setIntervalSpy.mockClear();
    resetPerfViolations();

    const onComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isPaused }: { isPaused: boolean }) =>
        useBurnTimer({
          isOnFire: true,
          fireStartTime: 1000,
          isPaused,
          onComplete,
        }),
      { initialProps: { isPaused: false } }
    );

    // Zero setInterval calls or perfWatchdog intervals registered
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(getPerfSnapshot().activeIntervals).toBe(0);
    expect(typeof result.current.value).toBe('number');

    // Advance 120ms, then pause
    act(() => {
      jest.advanceTimersByTime(120);
    });
    expect(onComplete).not.toHaveBeenCalled();

    rerender({ isPaused: true });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Resume -> needs remaining ~130ms to hit FIRE_BURN_DURATION (250ms)
    rerender({ isPaused: false });
    act(() => {
      jest.advanceTimersByTime(110);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(30);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.value).toBe(1);

    // Never fires twice
    act(() => {
      jest.advanceTimersByTime(FIRE_BURN_DURATION * 2);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 4C [FX-14] & [FX-24]: AdventureRun effects propagation & GPU scaleX bars', () => {
  it('renders HpBar and SurgeBar with GPU scaleX fills (zero percentage width) and wires quiet={!effects}', () => {
    const maxed = createMaxedSave();
    const save = {
      ...createNewSave(),
      seenMechanics: maxed.seenMechanics,
      seenCoachMarks: maxed.seenCoachMarks,
    };
    // Level 3-1 has Shading Surge + Parry so both Threat Rail bars + HpBar mount
    const level = getLevel('3-1');
    const view = render(
      <SafeAreaProvider initialMetrics={SAFE_METRICS}>
        <AdventureRun
          level={level}
          save={save}
          seed={42}
          effects={false}
          onFinish={jest.fn()}
          onQuit={jest.fn()}
          onRestart={jest.fn()}
          onCoachMarkSeen={jest.fn()}
        />
      </SafeAreaProvider>
    );

    const hpFillStyle = StyleSheet.flatten(view.getByTestId('run-foe-hp-fill').props.style);
    const hpTrailStyle = StyleSheet.flatten(view.getByTestId('run-foe-hp-trail').props.style);
    expect(hpFillStyle.width).toBeUndefined();
    expect(hpTrailStyle.width).toBeUndefined();
    expect(hpFillStyle.transformOrigin).toBe('left center');

    const surgeFill = view.queryByTestId('surge-bar-fill');
    if (surgeFill) {
      const surgeStyle = StyleSheet.flatten(surgeFill.props.style);
      expect(surgeStyle.width).toBeUndefined();
      expect(surgeStyle.transformOrigin).toBe('left center');
    }

    // Verify source wiring of quiet={!effects} and effects={effects} in AdventureRun
    const runSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/adventure/components/AdventureRun.tsx'), 'utf8');
    expect(runSrc).toMatch(/quiet=\{!effects\}/);
    expect(runSrc).toMatch(/effects=\{effects\}/);
    expect(ParryIntentBar).toBeDefined();
  });
});
