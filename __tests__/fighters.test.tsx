import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { FighterAvatar } from '@/components/fighters';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { CHARACTERS } from '@/utils/gameDefinitions';
import {
  getFighterHealthState,
  getFighterPersonality,
  resolveFighterAmbientMood,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
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

    it('escalates matches into ecstatic on 3x streak and resets on mistake', () => {
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
      expect(getByTestId('reaction').props.children).toBe('ecstatic');
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
          <Camp save={save} onChange={() => {}} onClose={() => {}} />
        </SafeAreaProvider>
      );

      expect(getByTestId('camp-fighter-avatar-Orange Tabby')).toBeTruthy();
      expect(queryByTestId('camp-fighter-avatar-Sly Fox')).toBeNull();
    });

    it('keeps silhouette before reveal and showcases living FighterAvatar upon reveal in UnlockReveal', () => {
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
      fireEvent.press(getByTestId('unlock-reveal'));
      const revealed = getByTestId('unlock-revealed-fighter');
      expect(revealed).toBeTruthy();
      expect(revealed.props.accessibilityLabel).toContain('Sly Fox');
      expect(getByTestId('fighter-fx-ecstatic')).toBeTruthy();
    });
  });
});
