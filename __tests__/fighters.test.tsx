import React from 'react';
import { render, renderHook, fireEvent, act } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { FighterAvatar, FIGHTER_MOTION } from '@/components/fighters/FighterAvatar';
import { EnemyAvatar, ENEMY_MOTION } from '@/components/enemies/EnemyAvatar';
import { getEnemyPersonality, getEnemyRigPivots } from '@/components/enemies/enemyRegistry';
import { ReactionChannels, useCreatureMotion } from '@/components/creatures/useCreatureMotion';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { BLINK, CREATURE_ACTING, ENEMY_ATTACK, HIT, THROW, hitstopHoldMs } from '@/utils/motion';

const mockWithTiming = jest.fn();
const mockWithDelay = jest.fn();
const mockWithRepeat = jest.fn();
const mockCancelAnimation = jest.fn();

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default ?? actual,
    withTiming: (...args: unknown[]) => {
      mockWithTiming(...args);
      return actual.withTiming(...args);
    },
    withDelay: (...args: unknown[]) => {
      mockWithDelay(...args);
      return actual.withDelay(...args);
    },
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args);
      return actual.withRepeat(...args);
    },
    cancelAnimation: (...args: unknown[]) => {
      mockCancelAnimation(...args);
      return actual.cancelAnimation(...args);
    },
    useFrameCallback: (cb: unknown, autostart = true) => ({
      setActive: jest.fn(),
      callbackId: 0,
      isActive: Boolean(autostart),
      cb,
    }),
  };
});
import { CHARACTERS } from '@/utils/gameDefinitions';
import {
  getFighterHealthState,
  FIGHTER_MOOD_MOTION,
  resolveFighterAmbientMood,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
import {
  TAU,
  advancePhase,
  computeVolumePreservedScale,
  createSecondOrderState,
  sampleOrganicBreath,
  sampleOverlappingWave,
  stepSecondOrder,
} from '@/utils/proceduralMotion';
import { getFighterPersonality } from '@/components/fighters/fighterRegistry';
import { computeMoodLoopRates, computeMoodPoseTargets } from '@/utils/creatureAnimations';
import { createNewSave } from '@/adventure/progress';
import { getLevel } from '@/adventure/data/levels';
import AdventureRun from '@/adventure/components/AdventureRun';
import Camp from '@/adventure/components/Camp';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

jest.mock('@/components/Icon', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return (
      <RNView testID={`fallback-icon-${name}`}>
        <RNText>{name}</RNText>
      </RNView>
    );
  };
});

jest.mock('@/components/GameBoard', () => {
  const { View: RNView, Pressable: RNPressable } = require('react-native');
  return function MockGameBoard({
    cards,
    onMatch,
    onInvalidSelection,
  }: {
    cards: unknown[];
    onMatch: (cards: unknown[], rewards: { points: number }[]) => void;
    onInvalidSelection: (cards: unknown[]) => void;
  }) {
    return (
      <RNView testID="mock-game-board">
        <RNPressable
          testID="mock-board-match"
          onPress={() => onMatch(cards.slice(0, 3), [{ points: 3 }])}
        />
        <RNPressable
          testID="mock-board-mistake"
          onPress={() => onInvalidSelection(cards.slice(0, 3))}
        />
      </RNView>
    );
  };
});

describe('Fighter Animation System', () => {
  describe('getFighterHealthState (progressive wear-and-tear)', () => {
    it('maps standard 3-heart fighter health cleanly', () => {
      expect(getFighterHealthState(3, 3)).toBe('pristine');
      expect(getFighterHealthState(2, 3)).toBe('scuffed');
      expect(getFighterHealthState(1, 3)).toBe('critical');
      expect(getFighterHealthState(0, 3)).toBe('knocked_out');
      expect(getFighterHealthState(-1, 3)).toBe('knocked_out');
    });

    it('maps 4+ heart fighters through all 5 wear tiers (including battered)', () => {
      // Orange Tabby starts with 4/4 HP
      expect(getFighterHealthState(4, 4)).toBe('pristine');
      expect(getFighterHealthState(3, 4)).toBe('scuffed');
      expect(getFighterHealthState(2, 4)).toBe('battered');
      expect(getFighterHealthState(1, 4)).toBe('critical');
      expect(getFighterHealthState(0, 4)).toBe('knocked_out');

      // High maxHealth tank build (8 HP)
      expect(getFighterHealthState(8, 8)).toBe('pristine');
      expect(getFighterHealthState(6, 8)).toBe('scuffed');
      expect(getFighterHealthState(4, 8)).toBe('battered');
      expect(getFighterHealthState(2, 8)).toBe('critical');
    });

    it('defaults omitted health to pristine', () => {
      expect(getFighterHealthState(undefined, 3)).toBe('pristine');
    });
  });

  describe('resolveFighterAmbientMood', () => {
    it('prioritizes defeat at 0 HP and urgent clock-panic at <=10s', () => {
      expect(
        resolveFighterAmbientMood({ health: 0, remainingTime: 50, selectedCount: 2 })
      ).toBe('defeat');

      expect(
        resolveFighterAmbientMood({
          health: 2,
          remainingTime: 8,
          score: 5,
          targetScore: 15,
          selectedCount: 2,
        })
      ).toBe('urgent');

      // Not urgent if target score already met!
      expect(
        resolveFighterAmbientMood({
          health: 2,
          remainingTime: 8,
          score: 15,
          targetScore: 15,
          selectedCount: 0,
        })
      ).toBe('idle');
    });

    it('responds to card selection curiosity (1) and anticipation (2)', () => {
      expect(resolveFighterAmbientMood({ health: 3, selectedCount: 1 })).toBe('curious');
      expect(resolveFighterAmbientMood({ health: 3, selectedCount: 2 })).toBe('anticipation');
    });

    it('enters streak at 3+ consecutive matches and sleepy when board is idle', () => {
      expect(resolveFighterAmbientMood({ health: 3, streak: 3, isBoardIdle: true })).toBe('streak');
      expect(resolveFighterAmbientMood({ health: 3, streak: 2, isBoardIdle: true })).toBe('sleepy');
      expect(resolveFighterAmbientMood({ health: 3 })).toBe('idle');
    });
  });

  describe('resolveFighterExpression', () => {
    it('gives one-shot reactions priority over resting states', () => {
      expect(
        resolveFighterExpression({
          healthState: 'critical',
          mood: 'idle',
          activeReaction: 'joy',
          isBlinking: false,
        })
      ).toBe('happy');

      expect(
        resolveFighterExpression({
          healthState: 'pristine',
          mood: 'idle',
          activeReaction: 'pain',
          isBlinking: true,
        })
      ).toBe('wince');

      expect(
        resolveFighterExpression({
          healthState: 'scuffed',
          mood: 'idle',
          activeReaction: 'relief',
          isBlinking: false,
        })
      ).toBe('relieved');
    });

    it('reflects progressive grit expressions as health drops when idle', () => {
      expect(
        resolveFighterExpression({
          healthState: 'pristine',
          mood: 'idle',
          activeReaction: null,
          isBlinking: false,
        })
      ).toBe('normal');

      expect(
        resolveFighterExpression({
          healthState: 'scuffed',
          mood: 'idle',
          activeReaction: null,
          isBlinking: false,
        })
      ).toBe('determined');

      expect(
        resolveFighterExpression({
          healthState: 'battered',
          mood: 'idle',
          activeReaction: null,
          isBlinking: false,
        })
      ).toBe('bruised_grit');

      expect(
        resolveFighterExpression({
          healthState: 'critical',
          mood: 'idle',
          activeReaction: null,
          isBlinking: false,
        })
      ).toBe('bruised_grit');

      expect(
        resolveFighterExpression({
          healthState: 'knocked_out',
          mood: 'idle',
          activeReaction: 'joy',
          isBlinking: false,
        })
      ).toBe('ko');
    });
  });

  describe('FighterAvatar component & bespoke creature rigs', () => {
    it('renders all 6 playable characters plus fallback character cleanly', () => {
      for (const character of CHARACTERS) {
        const { getByTestId, unmount } = render(
          <FighterAvatar
            character={character}
            size={64}
            testID={`avatar-${character.name}`}
          />
        );
        expect(getByTestId(`avatar-${character.name}`)).toBeTruthy();
        expect(getFighterPersonality(character.name).name).toBe(character.name);
        unmount();
      }

      // Fallback character rig
      const { getByTestId } = render(
        <FighterAvatar character="Mystery Capybara" size={64} testID="avatar-fallback" />
      );
      expect(getByTestId('avatar-fallback')).toBeTruthy();
    });

    it('progressively adds battle wear-and-tear overlays as health decreases', () => {
      const { queryByTestId, rerender } = render(
        <FighterAvatar character="Badger" health={4} maxHealth={4} />
      );
      expect(queryByTestId('fighter-damage-pristine')).toBeNull();
      expect(queryByTestId('fighter-damage-scuffed')).toBeNull();

      rerender(<FighterAvatar character="Badger" health={3} maxHealth={4} />);
      expect(queryByTestId('fighter-damage-scuffed')).toBeTruthy();

      rerender(<FighterAvatar character="Badger" health={2} maxHealth={4} />);
      expect(queryByTestId('fighter-damage-battered')).toBeTruthy();

      rerender(<FighterAvatar character="Badger" health={1} maxHealth={4} />);
      expect(queryByTestId('fighter-damage-critical')).toBeTruthy();

      rerender(<FighterAvatar character="Badger" health={0} maxHealth={4} />);
      expect(queryByTestId('fighter-damage-knocked_out')).toBeTruthy();
    });

    it('renders match joy, mistake pain, grace relief, and streak badge overlays', () => {
      const { getByTestId, rerender } = render(
        <FighterAvatar
          character="Sly Fox"
          framed
          streak={3}
          reaction={{ type: 'joy', id: 1 }}
        />
      );
      expect(getByTestId('fighter-fx-joy')).toBeTruthy();
      expect(getByTestId('fighter-streak-badge')).toBeTruthy();

      rerender(
        <FighterAvatar
          character="Emperor Penguin"
          framed
          streak={0}
          reaction={{ type: 'pain', id: 2 }}
        />
      );
      expect(getByTestId('fighter-fx-pain')).toBeTruthy();

      rerender(
        <FighterAvatar
          character="Pelican"
          framed
          reaction={{ type: 'relief', id: 3 }}
        />
      );
      expect(getByTestId('fighter-fx-relief')).toBeTruthy();
    });

    it('supports tap-to-pet blush and 5-tap dizzy_joy zoomie easter egg', () => {
      const onPet = jest.fn();
      const { getByTestId } = render(
        <FighterAvatar character="Corgi" interactive onPet={onPet} testID="corgi" />
      );

      const pressable = getByTestId('corgi-pressable');
      fireEvent.press(pressable);
      expect(onPet).toHaveBeenLastCalledWith('pet');
      expect(getByTestId('fighter-fx-pet')).toBeTruthy();

      // 4 more rapid taps -> 5 total -> zoomie spin!
      fireEvent.press(pressable);
      fireEvent.press(pressable);
      fireEvent.press(pressable);
      fireEvent.press(pressable);
      expect(onPet).toHaveBeenLastCalledWith('dizzy_joy');
      expect(getByTestId('fighter-fx-dizzy_joy')).toBeTruthy();
    });
  });

  describe('useFighterConductor gameplay hook', () => {
    function ConductorHarness({
      health,
      maxHealth = 3,
      onReady,
    }: {
      health: number;
      maxHealth?: number;
      onReady: (api: ReturnType<typeof useFighterConductor>) => void;
    }) {
      const api = useFighterConductor({
        health,
        maxHealth,
        remainingTime: 45,
        score: 3,
        targetScore: 12,
        isActiveRound: true,
      });
      onReady(api);
      return (
        <View>
          <Text testID="mood">{api.mood}</Text>
          <Text testID="reaction">{api.reaction?.type ?? 'none'}</Text>
          <Text testID="streak">{String(api.streak)}</Text>
        </View>
      );
    }

    it('cheers every Set the same way (a streak raises it, never a spin) and resets on mistake', () => {
      let latest!: ReturnType<typeof useFighterConductor>;
      const { getByTestId } = render(
        <ConductorHarness health={3} onReady={(api) => { latest = api; }} />
      );

      act(() => {
        latest.triggerMatch();
      });
      expect(getByTestId('reaction').props.children).toBe('joy');
      expect(getByTestId('streak').props.children).toBe('1');

      act(() => {
        latest.triggerMatch();
      });
      expect(getByTestId('reaction').props.children).toBe('joy');
      expect(getByTestId('streak').props.children).toBe('2');

      act(() => {
        latest.triggerMatch();
      });
      expect(getByTestId('reaction').props.children).toBe('joy');
      expect(getByTestId('streak').props.children).toBe('3');
      expect(getByTestId('mood').props.children).toBe('streak');

      // Mistake resets streak and triggers pain
      act(() => {
        latest.triggerMistake();
      });
      expect(getByTestId('reaction').props.children).toBe('pain');
      expect(getByTestId('streak').props.children).toBe('0');

      // Mistake saved by Grace triggers relief
      act(() => {
        latest.triggerMistake({ savedByGrace: true });
      });
      expect(getByTestId('reaction').props.children).toBe('relief');
    });

    it('automatically triggers pain on external HP loss and heal on HP gain', () => {
      let latest!: ReturnType<typeof useFighterConductor>;
      const { getByTestId, rerender } = render(
        <ConductorHarness health={3} maxHealth={4} onReady={(api) => { latest = api; }} />
      );

      // Simulate bomb / enemy tick damage (3 -> 2)
      rerender(
        <ConductorHarness health={2} maxHealth={4} onReady={(api) => { latest = api; }} />
      );
      expect(getByTestId('reaction').props.children).toBe('pain');

      // Advance Date.now past debounce window for passive heal (2 -> 3)
      const realNow = Date.now;
      Date.now = () => realNow() + 500;
      try {
        rerender(
          <ConductorHarness health={3} maxHealth={4} onReady={(api) => { latest = api; }} />
        );
        expect(getByTestId('reaction').props.children).toBe('heal');
      } finally {
        Date.now = realNow;
      }

      // Card selection anticipation
      act(() => {
        latest.setSelectedCount(2);
      });
      expect(getByTestId('mood').props.children).toBe('anticipation');
    });
  });

  describe('Adventure Mode v2 integration', () => {
    const SAFE_AREA_METRICS = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    };

    it('renders pristine FighterAvatar in heartless tutorial level 1-1', () => {
      const save = createNewSave();
      const level11 = getLevel('1-1');
      const { getByTestId, queryByTestId } = render(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <AdventureRun
            level={level11}
            save={save}
            seed={12345}
            onFinish={() => {}}
            onQuit={() => {}}
            onRestart={() => {}}
            onCoachMarkSeen={() => {}}
          />
        </SafeAreaProvider>
      );

      const avatar = getByTestId('adventure-run-fighter');
      expect(avatar).toBeTruthy();
      expect(avatar.props.accessibilityLabel).toContain('pristine');
      expect(queryByTestId('fighter-damage-knocked_out')).toBeNull();

      // Match triggers joy reaction on the HUD fighter
      fireEvent.press(getByTestId('mock-board-match'));
      expect(getByTestId('fighter-fx-joy')).toBeTruthy();

      // Mistake triggers pain reaction on the HUD fighter
      fireEvent.press(getByTestId('mock-board-mistake'));
      expect(getByTestId('fighter-fx-pain')).toBeTruthy();
    });

    it('renders FighterAvatar for unlocked fighters at Camp while keeping locked fighters secret', () => {
      const save = createNewSave(); // Orange Tabby unlocked, others locked
      const { getByTestId, queryByTestId } = render(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <Camp save={save} initialTab="fighters" onChange={() => {}} onClose={() => {}} />
        </SafeAreaProvider>
      );

      expect(getByTestId('camp-fighter-avatar-Orange Tabby')).toBeTruthy();
      expect(queryByTestId('camp-fighter-avatar-Sly Fox')).toBeNull();
    });

    it('keeps silhouette before reveal and showcases living FighterAvatar upon reveal in UnlockReveal', () => {
      jest.useFakeTimers();
      try {
        const save = createNewSave();
        const { getByTestId, queryByTestId } = render(
          <UnlockReveal
            unlocks={[{ kind: 'fighter', name: 'Sly Fox', star: 1 }]}
            save={save}
            onUseFighter={() => {}}
            onEquipCharm={() => {}}
            onDone={() => {}}
          />
        );

        expect(queryByTestId('unlock-revealed-fighter')).toBeNull();
        // The reward turns into view (UnlockReveal: about 0.8 s from the tap to the buttons)
        fireEvent.press(getByTestId('unlock-reveal'));
        act(() => { jest.advanceTimersByTime(1000); });
        const revealed = getByTestId('unlock-revealed-fighter');
        expect(revealed).toBeTruthy();
        expect(revealed.props.accessibilityLabel).toContain('Sly Fox');
        expect(getByTestId('fighter-fx-ecstatic')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Procedural Motion & Seamless State Transition Engine', () => {
    it('maintains strict C0 phase continuity across abrupt loop frequency changes', () => {
      let phase = 1.234;
      const dt = 1 / 60;

      // Advance at calm sleepy rate (0.3 Hz), then abruptly switch to urgent rate (2.4 Hz)
      const beforeSwitch = advancePhase(phase, 0.3, dt);
      const afterSwitch = advancePhase(beforeSwitch, 2.4, dt);

      // Phase delta over a single 16.7ms frame is tiny and continuous (never snaps to 0!)
      const delta = Math.abs(afterSwitch - beforeSwitch);
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(TAU * 2.4 * dt + 1e-6);

      // Wraps cleanly across 2π boundary without negative values or NaN
      const wrapped = advancePhase(TAU - 0.01, 1.0, 0.02);
      expect(wrapped).toBeGreaterThanOrEqual(0);
      expect(wrapped).toBeLessThan(TAU);
    });

    it('produces asymmetric organic breathing and phase-lagged overlapping waves', () => {
      const inhale = sampleOrganicBreath(Math.PI * 0.45, 0.5);
      const exhale = sampleOrganicBreath(Math.PI * 1.45, 0.5);
      expect(inhale).toBeGreaterThan(0);
      expect(exhale).toBeLessThan(0);
      // Asymmetric skew + second harmonic means waveform is not a symmetric mirror
      expect(Math.abs(inhale + exhale)).toBeGreaterThan(0.01);

      // Hierarchical lag: torso (0 rad), head (0.68 rad), ear (1.28 rad) are distinct at same instant
      const tPhase = 1.1;
      const torso = sampleOverlappingWave(tPhase, 0);
      const head = sampleOverlappingWave(tPhase, 0.68);
      const ear = sampleOverlappingWave(tPhase, 1.28);
      expect(torso).not.toBeCloseTo(head, 2);
      expect(head).not.toBeCloseTo(ear, 2);
    });

    it('preserves momentum across mid-flight reversals and remains stable on frame hitches', () => {
      let state = createSecondOrderState(0);
      // Accelerate partway toward +12 degrees
      for (let i = 0; i < 8; i++) {
        state = stepSecondOrder(state, 12, 1 / 60, 3.0, 0.65, 0.2);
      }
      const posBeforeReversal = state.y;
      const velBeforeReversal = state.yd;
      expect(posBeforeReversal).toBeGreaterThan(1);
      expect(velBeforeReversal).toBeGreaterThan(0);

      // Abruptly flip target to -10 degrees mid-flight: position does NOT snap in 1 frame!
      const nextFrame = stepSecondOrder(state, -10, 1 / 60, 3.0, 0.65, 0.2);
      expect(Math.abs(nextFrame.y - posBeforeReversal)).toBeLessThan(2.5);

      // Settles accurately to -10 over 1.5s
      let settled = nextFrame;
      for (let i = 0; i < 90; i++) {
        settled = stepSecondOrder(settled, -10, 1 / 60, 3.0, 0.65, 0.2);
      }
      expect(settled.y).toBeCloseTo(-10, 1);

      // Unconditional stability under huge 250ms frame hitch
      const hitched = stepSecondOrder(createSecondOrderState(0), 100, 0.25, 4.0, 0.5, 0.5);
      expect(Number.isFinite(hitched.y)).toBe(true);
      expect(Number.isFinite(hitched.yd)).toBe(true);
    });

    it('enforces constant-area volume conservation (scaleX * scaleY === 1)', () => {
      const squash = computeVolumePreservedScale(0.8);
      expect(squash.scaleY).toBeCloseTo(0.8, 5);
      expect(squash.scaleX).toBeCloseTo(1.25, 5);
      expect(squash.scaleX * squash.scaleY).toBeCloseTo(1, 5);

      const stretch = computeVolumePreservedScale(1.2);
      expect(stretch.scaleX * stretch.scaleY).toBeCloseTo(1, 5);

      // Clamps extreme inputs safely
      const clamped = computeVolumePreservedScale(0.2);
      expect(clamped.scaleY).toBe(0.72);
      expect(clamped.scaleX * clamped.scaleY).toBeCloseTo(1, 5);
    });

    it('renders grounded contact shadow and transitions rapidly across moods & reactions cleanly', () => {
      const rates = computeMoodLoopRates(FIGHTER_MOOD_MOTION, 'anticipation', 'pristine', 2400, 1400);
      const idleRates = computeMoodLoopRates(FIGHTER_MOOD_MOTION, 'idle', 'pristine', 2400, 1400);
      expect(rates.wagHz).toBeGreaterThan(idleRates.wagHz);

      const curiousPose = computeMoodPoseTargets(FIGHTER_MOOD_MOTION, 'curious', 'pristine', 64, 0.65, -0.32);
      expect(curiousPose.headTiltDeg).toBeGreaterThan(5);

      const { getByTestId, rerender } = render(
        <FighterAvatar character="Orange Tabby" size={72} mood="idle" testID="smooth-tabby" />
      );
      expect(getByTestId('fighter-ground-shadow')).toBeTruthy();

      // Rapidly transition through moods and interrupt mid-reaction without errors
      rerender(
        <FighterAvatar
          character="Orange Tabby"
          size={72}
          mood="curious"
          reaction={{ type: 'joy', id: 1 }}
          testID="smooth-tabby"
        />
      );
      expect(getByTestId('fighter-fx-joy')).toBeTruthy();

      rerender(
        <FighterAvatar
          character="Orange Tabby"
          size={72}
          mood="anticipation"
          health={1}
          maxHealth={3}
          reaction={{ type: 'ecstatic', id: 2 }}
          testID="smooth-tabby"
        />
      );
      expect(getByTestId('fighter-fx-ecstatic')).toBeTruthy();
      expect(getByTestId('fighter-damage-critical')).toBeTruthy();
    });
  });

  describe('Wave 4 Game Feel & Creature Acting ([FX-02..13])', () => {
    const makeChannels = (): ReactionChannels => {
      const sv = (initial: number) => ({ value: initial }) as unknown as SharedValue<number>;
      return {
        bodyTx: sv(0),
        bodyTy: sv(0),
        reactionScaleY: sv(1),
        bodyRotate: sv(0),
        headRotate: sv(0),
        headTy: sv(0),
        leftEarExtra: sv(0),
        rightEarExtra: sv(0),
        tailExtra: sv(0),
        pawBounce: sv(0),
      };
    };

    beforeEach(() => {
      mockWithTiming.mockClear();
      mockWithDelay.mockClear();
      mockWithRepeat.mockClear();
      mockCancelAnimation.mockClear();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('gives FighterAvatar a subtle combat gaze bias facing right and dedicated throw lunge pose ([FX-09], [FX-02])', () => {
      const idleGaze = FIGHTER_MOTION.resolveGaze({
        mood: 'idle',
        healthState: 'pristine',
        activeReaction: null,
        idleGaze: { x: 0, y: 0 },
      });
      expect(idleGaze.x).toBeCloseTo(CREATURE_ACTING.fighterCombatGazeX, 3);
      expect(idleGaze.x).toBeGreaterThan(0);

      const throwGaze = FIGHTER_MOTION.resolveGaze({
        mood: 'idle',
        healthState: 'pristine',
        activeReaction: 'throw',
        idleGaze: { x: 0, y: 0 },
      });
      expect(throwGaze.x).toBeGreaterThan(idleGaze.x);

      // Render FighterAvatar with the dedicated 'throw' reaction
      const { getByTestId } = render(
        <FighterAvatar
          character="Orange Tabby"
          size={64}
          reaction={{ type: 'throw', id: 1 }}
          testID="throw-tabby"
        />
      );
      expect(getByTestId('throw-tabby')).toBeTruthy();
      expect(getByTestId('fighter-fx-throw')).toBeTruthy();

      // Verify throw choreography: grounded bodyTy=0, wind-up coil back -> forward lunge -> light launch recoil
      mockWithTiming.mockClear();
      const ch = makeChannels();
      ch.bodyTy.value = 5;
      FIGHTER_MOTION.playReaction('throw', ch, 64, { chain: 0, intensity: 0, compact: false });
      expect(ch.bodyTy.value).toBe(0);

      const timingCalls = mockWithTiming.mock.calls.map(([toValue, cfg]) => ({
        toValue,
        duration: (cfg as { duration?: number } | undefined)?.duration,
      }));
      // Wind-up coil back (32ms) and forward centerline lunge (32ms) + 16ms light launch recoil
      expect(timingCalls.some(c => c.toValue === 64 * THROW.windTxRatio && c.duration === THROW.windMs)).toBe(true);
      expect(timingCalls.some(c => c.toValue === 64 * THROW.lungeTxRatio && c.duration === THROW.lungeMs)).toBe(true);
      expect(timingCalls.some(c => c.duration === HIT.snapMs)).toBe(true);
    });

    it('migrates FighterAvatar pain to Sakurai HIT 1-frame snap, hitstop hold, micro-vibration, and single directional recoil ([FX-07])', () => {
      const ch = makeChannels();
      ch.bodyTy.value = 4;

      FIGHTER_MOTION.playReaction('pain', ch, 64, { chain: 0, intensity: 0, hitTier: 0, compact: false });
      expect(ch.bodyTy.value).toBe(0);

      const recoilPx = Math.max(4, 64 * 0.14);
      const peakTx = -recoilPx * HIT.fighterPainRecoilMult;
      const timingCalls = mockWithTiming.mock.calls;
      // Frame-1 snap to left recoil peak, squash, and negative tilt
      expect(timingCalls.some(([v, cfg]) => v === peakTx && (cfg as { duration?: number })?.duration === HIT.snapMs)).toBe(true);
      expect(timingCalls.some(([v, cfg]) => v === HIT.fighterPainSquash && (cfg as { duration?: number })?.duration === HIT.snapMs)).toBe(true);
      expect(timingCalls.some(([v, cfg]) => v === HIT.fighterPainRotateDeg && (cfg as { duration?: number })?.duration === HIT.snapMs)).toBe(true);

      // Zero reverse-wobble positive bodyTx swings: all horizontal micro-vibration stays strictly negative (left of rest)
      const txSteps = timingCalls
        .map(([v]) => v as number)
        .filter(v => Math.abs(v - peakTx) <= recoilPx * 0.5);
      expect(txSteps.length).toBeGreaterThanOrEqual(4); // 1f snap + 3f hitstop vibration steps
      expect(txSteps.every(v => v < 0)).toBe(true);

      // Hitstop hold (48ms) and 1-frame head whiplash lag (16ms)
      const delays = mockWithDelay.mock.calls.map(([ms]) => ms);
      expect(delays).toContain(HIT.holdMs);
      expect(delays).toContain(HIT.snapMs);
    });

    it('honors optional cheerReleaseMs on FighterAvatar and FighterEffectsOverlay ([FX-23])', () => {
      const ch = makeChannels();
      FIGHTER_MOTION.playReaction('joy', ch, 64, {
        chain: 0,
        intensity: 0.5,
        cheerReleaseMs: 300,
      });
      // Crouch hold = 300 - 60 = 240ms
      expect(mockWithDelay.mock.calls.map(([ms]) => ms)).toContain(240);

      const { getByTestId } = render(
        <FighterAvatar
          character="Corgi"
          size={64}
          cheerReleaseMs={300}
          reaction={{ type: 'joy', id: 1 }}
          testID="synced-cheer-corgi"
        />
      );
      expect(getByTestId('synced-cheer-corgi')).toBeTruthy();
      expect(getByTestId('fighter-fx-joy')).toBeTruthy();
    });

    it('enforces grounded bodyTy=0 on throw/zap enemy hits, airborne lift on blast, and tier-scaled hitstop ([FX-02], [FX-04], [FX-06], [FX-12])', () => {
      // 1) Grounded 'throw' hit at tier 3 (136ms hitstop) keeps bodyTy === 0
      const chThrow = makeChannels();
      chThrow.bodyTy.value = 6;
      ENEMY_MOTION.playReaction('pain', chThrow, 64, {
        chain: 0,
        intensity: 0,
        hitTier: 3,
        hitKind: 'throw',
        compact: false,
      });
      expect(chThrow.bodyTy.value).toBe(0);
      expect(mockWithDelay.mock.calls.map(([ms]) => ms)).toContain(hitstopHoldMs(3));

      // 2) Airborne 'blast' hit lifts bodyTy upward (< 0) with wide back-tumble
      mockWithTiming.mockClear();
      mockWithDelay.mockClear();
      const chBlast = makeChannels();
      ENEMY_MOTION.playReaction('pain', chBlast, 64, {
        chain: 0,
        intensity: 0,
        hitTier: 2,
        hitKind: 'blast',
        compact: false,
      });
      const jumpPx = Math.max(6, 64 * 0.16);
      const expectedLift = -jumpPx * HIT.blastLiftMult * (1 + 2 * 0.1);
      expect(mockWithTiming.mock.calls.some(([v]) => typeof v === 'number' && Math.abs(v - expectedLift) < 0.01)).toBe(true);

      // 3) Electric 'zap' hit stays grounded (bodyTy === 0) and stretches upright (scaleY > 1)
      mockWithTiming.mockClear();
      const chZap = makeChannels();
      chZap.bodyTy.value = 3;
      ENEMY_MOTION.playReaction('pain', chZap, 64, {
        chain: 0,
        intensity: 0,
        hitTier: 1,
        hitKind: 'zap',
        compact: false,
      });
      expect(chZap.bodyTy.value).toBe(0);
      expect(mockWithTiming.mock.calls.some(([v]) => v === HIT.zapStretchY + 0.02)).toBe(true);

      // 4) Small-screen acting boost (size <= 52) amplifies bodyRotate by +25%
      mockWithTiming.mockClear();
      const chCompact = makeChannels();
      ENEMY_MOTION.playReaction('pain', chCompact, 48, {
        chain: 0,
        intensity: 0,
        hitTier: 0,
        hitKind: 'throw',
        compact: true,
      });
      const boostedRot = HIT.tierRotateDeg[0] * CREATURE_ACTING.compactRotateBoost;
      expect(mockWithTiming.mock.calls.some(([v]) => v === boostedRot)).toBe(true);

      // 5) Spring-aligned pain expression hold: 540ms at tier 0, expands with tier 3 hitstop
      expect(ENEMY_MOTION.resolveReactionHoldMs?.('pain', { chain: 0, intensity: 0, hitTier: 0 })).toBe(540);
      expect(ENEMY_MOTION.resolveReactionHoldMs?.('pain', { chain: 0, intensity: 0, hitTier: 3 })).toBe(
        540 + (136 - 48)
      );
    });

    it('rebuilds EnemyAvatar attack and regen with snap anticipation, holds, and follow-through ([FX-10])', () => {
      const chAttack = makeChannels();
      ENEMY_MOTION.playReaction('attack', chAttack, 64, { chain: 0, intensity: 0, compact: false });
      const attackDurations = mockWithTiming.mock.calls.map(([, cfg]) => (cfg as { duration?: number })?.duration);
      expect(attackDurations).toContain(ENEMY_ATTACK.windMs);
      expect(attackDurations).toContain(ENEMY_ATTACK.strikeMs);
      expect(mockWithDelay.mock.calls.map(([ms]) => ms)).toContain(ENEMY_ATTACK.coilHoldMs);
      expect(mockWithDelay.mock.calls.map(([ms]) => ms)).toContain(ENEMY_ATTACK.apexHoldMs);

      mockWithTiming.mockClear();
      mockWithDelay.mockClear();
      const chRegen = makeChannels();
      ENEMY_MOTION.playReaction('regen', chRegen, 64, { chain: 0, intensity: 0, compact: false });
      expect(mockWithTiming.mock.calls.some(([v]) => v === 0.87)).toBe(true);
      expect(mockWithTiming.mock.calls.some(([v]) => v === 1.13)).toBe(true);
    });

    it('supports hideImpactStars, zap rim overlay, lightweight GPU breathing, and smooth 3-step blinks ([FX-12], [FX-13], [FX-15])', () => {
      // hideImpactStars suppresses built-in EnemyEffectsOverlay hit stars; zap renders electric rim when shown
      const { queryByTestId, rerender } = render(
        <EnemyAvatar
          enemy="Junk Rat"
          size={64}
          hitKind="zap"
          reaction={{ type: 'pain', id: 1 }}
        />
      );
      expect(queryByTestId('enemy-fx-pain')).toBeTruthy();
      expect(queryByTestId('enemy-fx-zap-rim')).toBeTruthy();

      rerender(
        <EnemyAvatar
          enemy="Junk Rat"
          size={64}
          hitKind="zap"
          hideImpactStars
          reaction={{ type: 'pain', id: 2 }}
        />
      );
      expect(queryByTestId('enemy-fx-pain')).toBeNull();

      // [FX-13] Lightweight enemy rig attaches gentle GPU-only withRepeat breathing & cancels on unmount
      mockWithRepeat.mockClear();
      mockCancelAnimation.mockClear();
      const lw = render(<EnemyAvatar enemy="Dozy Bunny" size={44} lightweight testID="lw-bunny" />);
      expect(lw.getByTestId('lw-bunny')).toBeTruthy();
      expect(mockWithRepeat).toHaveBeenCalled();
      lw.unmount();
      expect(mockCancelAnimation).toHaveBeenCalled();

      // [FX-12] Smooth 3-step blink lid travel (0 -> 1 -> 2 -> 1 -> 0) in useCreatureMotion
      jest.useFakeTimers();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const hook = renderHook(() =>
        useCreatureMotion(ENEMY_MOTION, {
          name: 'Junk Rat',
          size: 48,
          mood: 'menacing',
          healthState: 'pristine',
          personality: getEnemyPersonality('Junk Rat', 1),
          pivots: getEnemyRigPivots('Junk Rat'),
          reaction: null,
          animate: true,
          lively: true,
          interactive: false,
        })
      );
      expect(hook.result.current.blinkStage).toBe(0);
      expect(hook.result.current.gaze.x).toBeLessThan(0);

      // Advance past initial blink wait (2600 + 0.5*3000 = 4100ms) -> closing stage 1
      act(() => { jest.advanceTimersByTime(4100); });
      expect(hook.result.current.blinkStage).toBe(1);
      expect(hook.result.current.isBlinking).toBe(false);

      // Advance BLINK.closeMs (32ms) -> fully closed stage 2
      act(() => { jest.advanceTimersByTime(BLINK.closeMs); });
      expect(hook.result.current.blinkStage).toBe(2);
      expect(hook.result.current.isBlinking).toBe(true);

      // Advance BLINK.holdMs (48ms) -> opening stage 1
      act(() => { jest.advanceTimersByTime(BLINK.holdMs); });
      expect(hook.result.current.blinkStage).toBe(1);
      expect(hook.result.current.isBlinking).toBe(false);

      // Advance BLINK.openMs (48ms) -> open stage 0
      act(() => { jest.advanceTimersByTime(BLINK.openMs); });
      expect(hook.result.current.blinkStage).toBe(0);
      hook.unmount();
    });
  });
});
