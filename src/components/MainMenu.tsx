import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Linking } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { DISCORD_URL } from '@/utils/storeUrls';
import { triggerHaptic } from '@/utils/haptics';
import { playSound } from '@/utils/sounds';
import { band } from '@/audio';
import { useKeyboardActive } from '@/utils/keybindings';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  ACCESSIBLE,
  BTN_PRESS,
  EASE,
  MS,
  OVERLAP,
  SCALE,
  SPRING,
  SPRITE_TX,
  STAYS,
  reducedMs,
} from '@/utils/motion';
import { LivingBreath } from '@/adventure/components/CompanionBubble';
import Icon, { IconName } from './Icon';
import { FighterAvatar } from './fighters';
import type { FighterReactionEvent } from '@/utils/fighterAnimations';
import { EnemyAvatar } from './enemies';
import { CHARACTERS } from '@/utils/gameDefinitions';
import { LabsStorage } from '@/utils/freePlayStorage';
import { loadAdventureSave } from '@/adventure/save';
import { SUMMIT_UNLOCK_LEVEL_ID, isSummitUnlocked } from '@/adventure/data/features';
import { MAIN_LEVELS } from '@/adventure/data/levels';
import { getFrontierLevel, totalStars } from '@/adventure/progress';
import { levelFoe } from '@/adventure/data/foes';
import { STORY_TAGLINE } from '@/adventure/data/story';
import { loadSpireMeta, loadSpireRun } from '@/spire/save';
import { loadPrismMeta, loadPrismRun } from '@/prism/save';
import { version } from '../../package.json';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const UNIFIED_ELEVATOR_PITCH =
  'Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike.';

const DOJO_WEB_PATH = '/dojo/index.html';
const DOJO_PUBLIC_URL = 'https://nathanbwaters.github.io/nshapes/dojo/index.html';

interface MainMenuProps {
  onSelectAdventure: () => void;
  onSelectSpire?: () => void;
  onSelectPrism?: () => void;
  /** When true (e.g. `?labs=1` or Labs opt-in), shows experimental Prism Deck entry */
  showPrismLabs?: boolean;
  onSelectFreeplay: () => void;
  onSelectOptions: () => void;
}

function ModeCard({
  onPress,
  variant,
  icon,
  title,
  subtitle,
  badge,
  disabled = false,
  accessibilityLabel,
}: {
  onPress?: () => void;
  variant: 'spire' | 'spire_locked' | 'prism' | 'freeplay';
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const reducedMotion = useReducedMotion();
  const pressedSV = useSharedValue(0);

  useEffect(() => () => cancelAnimation(pressedSV), [pressedSV]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    pressedSV.value = withTiming(1, {
      duration: BTN_PRESS.pressInMs,
      easing: EASE.ui,
      ...(reducedMotion ? STAYS : {}),
    });
  }, [disabled, pressedSV, reducedMotion]);

  const handlePressOut = useCallback(() => {
    if (reducedMotion) {
      pressedSV.value = withTiming(0, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...STAYS });
    } else {
      pressedSV.value = withSpring(0, SPRING.snappy);
    }
  }, [pressedSV, reducedMotion]);

  const pressStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: 1 - pressedSV.value * (1 - BTN_PRESS.reducedOpacity),
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }
    return {
      transform: [
        { translateY: pressedSV.value * BTN_PRESS.translateY },
        { scale: 1 - pressedSV.value * (1 - BTN_PRESS.scale) },
      ],
    };
  });

  const handlePress = () => {
    if (disabled || !onPress) return;
    triggerHaptic('light');
    playSound('click');
    onPress();
  };

  const variantStyles = {
    spire: {
      button: styles.spireButton,
      iconBg: 'rgba(255, 255, 255, 0.16)',
      iconColor: COLORS.canvasWhite,
      textColor: COLORS.canvasWhite,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    spire_locked: {
      button: styles.spireLockedButton,
      iconBg: '#E6E0D6',
      iconColor: '#6B655D',
      textColor: COLORS.slateCharcoal,
      badgeBg: '#DDD6CA',
      badgeColor: COLORS.slateCharcoal,
    },
    prism: {
      button: styles.prismButton,
      iconBg: '#1E4C46',
      iconColor: '#FFDE00',
      textColor: COLORS.canvasWhite,
      badgeBg: '#FFDE00',
      badgeColor: '#121212',
    },
    freeplay: {
      button: styles.freeplayButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
  };

  const v = variantStyles[variant];
  const testIdVariant = variant === 'spire_locked' ? 'spire' : variant;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={`menu-${testIdVariant}`}
      style={[
        styles.menuButton,
        v.button,
        Platform.OS === 'web' && !disabled && { cursor: 'pointer' as any },
        pressStyle,
      ]}
    >
      <View
        style={[
          styles.buttonIconContainer,
          { backgroundColor: v.iconBg },
          variant === 'prism' && styles.prismIconContainer,
          variant === 'spire' && styles.spireIconContainer,
          variant === 'spire_locked' && styles.lockedIconContainer,
        ]}
      >
        <Icon name={icon} size={22} color={v.iconColor} noShadow />
      </View>
      <View style={styles.buttonTextContainer}>
        <View style={styles.buttonTitleRow}>
          <Text style={[styles.menuButtonText, { color: v.textColor }]}>{title}</Text>
          {badge && (
            <View style={[styles.menuBadge, { backgroundColor: v.badgeBg }]}>
              <Text style={[styles.menuBadgeText, { color: v.badgeColor }]}>{badge}</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.menuButtonSubtext,
            { color: v.textColor, opacity: variant === 'spire' || variant === 'prism' ? 0.92 : 0.78 },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSelectAdventure,
  onSelectSpire,
  onSelectPrism,
  showPrismLabs = false,
  onSelectFreeplay,
  onSelectOptions,
}) => {
  const reducedMotion = useReducedMotion();
  const adventureSave = useMemo(() => {
    try {
      return loadAdventureSave();
    } catch {
      return null;
    }
  }, []);

  const initialMascotIdx = useMemo(() => {
    const idx = adventureSave
      ? CHARACTERS.findIndex(c => c.name === adventureSave.selectedFighter)
      : -1;
    return idx >= 0 ? idx : 0;
  }, [adventureSave]);

  const [mascotIndex, setMascotIndex] = useState(initialMascotIdx);
  const [outgoingMascotIndex, setOutgoingMascotIndex] = useState<number | null>(null);
  const outgoingSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heroPressed, setHeroPressed] = useState(false);
  const [mascotReaction, setMascotReaction] = useState<FighterReactionEvent | null>(() =>
    reducedMotion ? null : { type: 'entrance', id: 1 }
  );
  const reactionSeq = useRef(1);
  const [otherModesExpanded, setOtherModesExpanded] = useState(false);
  const keyboardActive = useKeyboardActive();

  // Choreographed mount entrance: title → hero card (primary hero) → mascot pop → subordinate shelf
  const titleO = useSharedValue(0);
  const titleY = useSharedValue(reducedMotion ? 0 : 10);
  const heroO = useSharedValue(0);
  const heroY = useSharedValue(reducedMotion ? 0 : 16);
  const heroEnterS = useSharedValue(reducedMotion ? 1 : 0.96);
  const shelfO = useSharedValue(0);
  const shelfY = useSharedValue(reducedMotion ? 0 : 10);

  // Tactile Hero CTA press (SCALE.press + bottom ledge push-down) & dual-layer mascot swap crossfade
  const heroPressSV = useSharedValue(0);
  const mascotSwapProgress = useSharedValue(1);
  const mascotLeanX = useSharedValue(0);
  const mascotRingS = useSharedValue(0.8);
  const mascotRingO = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      const dur = reducedMs(MS.quick);
      titleY.value = 0;
      heroY.value = 0;
      heroEnterS.value = 1;
      shelfY.value = 0;
      titleO.value = withTiming(1, { duration: dur, easing: EASE.ui, ...STAYS });
      heroO.value = withDelay(OVERLAP.primaryMs, withTiming(1, { duration: dur, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      shelfO.value = withDelay(OVERLAP.secondaryMs, withTiming(1, { duration: dur, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    } else {
      titleO.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
      titleY.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });

      heroO.value = withDelay(OVERLAP.uiContentMs, withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      heroY.value = withDelay(OVERLAP.uiContentMs, withTiming(0, { duration: MS.move, easing: EASE.enterSoft }));
      heroEnterS.value = withDelay(OVERLAP.uiContentMs, withTiming(1, { duration: MS.move, easing: EASE.enter }));

      shelfO.value = withDelay(MS.feedback, withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
      shelfY.value = withDelay(MS.feedback, withTiming(0, { duration: MS.quick, easing: EASE.enter }));
    }

    return () => {
      cancelAnimation(titleO);
      cancelAnimation(titleY);
      cancelAnimation(heroO);
      cancelAnimation(heroY);
      cancelAnimation(heroEnterS);
      cancelAnimation(shelfO);
      cancelAnimation(shelfY);
      cancelAnimation(heroPressSV);
      cancelAnimation(mascotSwapProgress);
      cancelAnimation(mascotLeanX);
      cancelAnimation(mascotRingS);
      cancelAnimation(mascotRingO);
      if (outgoingSwapTimerRef.current) {
        clearTimeout(outgoingSwapTimerRef.current);
        outgoingSwapTimerRef.current = null;
      }
    };
  }, [
    reducedMotion,
    titleO,
    titleY,
    heroO,
    heroY,
    heroEnterS,
    shelfO,
    shelfY,
    heroPressSV,
    mascotSwapProgress,
    mascotLeanX,
    mascotRingS,
    mascotRingO,
  ]);

  // [AU-20]: Warm drumless title theme on Main Menu; stop cleanly on unmount if still playing title
  React.useEffect(() => {
    if (typeof band?.playScreenMusic === 'function') {
      band.playScreenMusic('title');
    }
    return () => {
      if (typeof band?.stop === 'function' && band.current === 'title') {
        band.stop();
      }
    };
  }, []);

  const handleAdventurePress = useCallback(() => {
    triggerHaptic('light');
    playSound('click');
    onSelectAdventure();
  }, [onSelectAdventure]);

  const handleHeroPressIn = useCallback(() => {
    setHeroPressed(true);
    heroPressSV.value = withTiming(1, {
      duration: BTN_PRESS.pressInMs,
      easing: EASE.ui,
      ...(reducedMotion ? STAYS : {}),
    });
    if (!reducedMotion) {
      // Mascot leans eagerly toward the Frontier Foe on Hero CTA press!
      mascotLeanX.value = withTiming(5, { duration: MS.feedback, easing: EASE.enter });
    }
  }, [heroPressSV, mascotLeanX, reducedMotion]);

  const handleHeroPressOut = useCallback(() => {
    setHeroPressed(false);
    if (reducedMotion) {
      heroPressSV.value = withTiming(0, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...STAYS });
    } else {
      heroPressSV.value = withSpring(0, SPRING.snappy);
      mascotLeanX.value = withSpring(0, SPRING.snappy);
    }
  }, [heroPressSV, mascotLeanX, reducedMotion]);

  const handleMascotTap = useCallback(() => {
    triggerHaptic('light');
    playSound('click');
    const prevIdx = mascotIndex;
    const nextIdx = (prevIdx + 1) % CHARACTERS.length;
    setOutgoingMascotIndex(prevIdx);
    setMascotIndex(nextIdx);
    reactionSeq.current += 1;
    setMascotReaction({ type: 'pet', id: reactionSeq.current });

    if (outgoingSwapTimerRef.current) {
      clearTimeout(outgoingSwapTimerRef.current);
      outgoingSwapTimerRef.current = null;
    }

    const swapDur = reducedMotion ? ACCESSIBLE.fadeMs : SPRITE_TX.swapBlendMs;
    cancelAnimation(mascotSwapProgress);
    mascotSwapProgress.value = 0;
    mascotSwapProgress.value = withTiming(1, {
      duration: swapDur,
      easing: reducedMotion ? EASE.ui : EASE.state,
      ...STAYS,
    });

    outgoingSwapTimerRef.current = setTimeout(() => {
      outgoingSwapTimerRef.current = null;
      setOutgoingMascotIndex(null);
    }, swapDur + 16);

    if (!reducedMotion) {
      mascotRingS.value = 0.8;
      mascotRingS.value = withTiming(1.52, { duration: MS.move, easing: EASE.enterSoft });
      mascotRingO.value = withSequence(
        withTiming(0.92, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
        withTiming(0, { duration: MS.move, easing: EASE.enterSoft })
      );
    }
  }, [mascotIndex, mascotSwapProgress, mascotRingS, mascotRingO, reducedMotion]);

  // [UI-23]: Web mash-to-play (`Enter` / `Space` launches Hero Adventure CTA when no modal is open)
  useKeyboardNav({
    enabled: true,
    priority: KEY_PRIORITY.SCREEN,
    onConfirm: handleAdventurePress,
  });

  // Hero Adventure summary: first invitation on 0-star save, or next frontier foe & star tally
  const adventure = useMemo(() => {
    const fallbackLevel = MAIN_LEVELS[0];
    const fallbackFoe = levelFoe(fallbackLevel);
    if (!adventureSave) {
      return {
        title: 'Adventure',
        subtitle: 'Free your caged friends · Map, foes & stars',
        isFresh: false,
        stars: 0,
        frontierLevel: fallbackLevel,
        frontierFoe: fallbackFoe,
      };
    }
    try {
      const stars = totalStars(adventureSave);
      const next = getFrontierLevel(adventureSave);
      const foe = levelFoe(next);
      if (stars === 0 && Object.keys(adventureSave.plays).length === 0) {
        return {
          title: 'Play',
          subtitle: STORY_TAGLINE,
          isFresh: true,
          stars: 0,
          frontierLevel: next,
          frontierFoe: foe,
        };
      }
      return {
        title: 'Continue',
        subtitle: `${next.id} · ${foe.name} is waiting   ★ ${stars}`,
        isFresh: false,
        stars,
        frontierLevel: next,
        frontierFoe: foe,
      };
    } catch {
      return {
        title: 'Adventure',
        subtitle: 'Free your caged friends · Map, foes & stars',
        isFresh: false,
        stars: 0,
        frontierLevel: fallbackLevel,
        frontierFoe: fallbackFoe,
      };
    }
  }, [adventureSave]);

  const spire = useMemo(() => {
    try {
      const active = loadSpireRun();
      const hasActiveRun = Boolean(active && active.phase !== 'defeat' && active.phase !== 'victory');
      const meta = loadSpireMeta();
      const unlocked = isSummitUnlocked(
        adventureSave ?? { stars: {} },
        meta,
        hasActiveRun
      );
      if (!unlocked) {
        return {
          unlocked: false,
          title: 'Starfall Summit',
          subtitle: `Unlocks after ${SUMMIT_UNLOCK_LEVEL_ID} · World 1 Boss`,
          badge: 'LOCKED',
        };
      }
      if (hasActiveRun && active) {
        const actLabel = active.endless ? `Endless A${active.act}` : `Act ${active.act}`;
        return {
          unlocked: true,
          title: 'Starfall Summit',
          subtitle: `Resume ${actLabel} · Floor ${active.floor} · ${active.hearts}/${active.maxHearts} HP`,
          badge: 'LIVE RUN',
        };
      }
      if (meta.totalRuns > 0) {
        return {
          unlocked: true,
          title: 'Starfall Summit',
          subtitle: `Roguelike Climb · Best Fl ${meta.bestFloor} · ${meta.victories} Win${meta.victories === 1 ? '' : 's'}`,
          badge: meta.highestAscensionUnlocked > 0 ? `A${meta.highestAscensionUnlocked}` : 'ROGUELIKE',
        };
      }
      return {
        unlocked: true,
        title: 'Starfall Summit',
        subtitle: 'Climb where the star fell · 3-Act Roguelike & Endless',
        badge: 'ROGUELIKE',
      };
    } catch {
      return {
        unlocked: false,
        title: 'Starfall Summit',
        subtitle: `Unlocks after ${SUMMIT_UNLOCK_LEVEL_ID} · World 1 Boss`,
        badge: 'LOCKED',
      };
    }
  }, [adventureSave]);

  const prismVisible = Boolean(onSelectPrism && LabsStorage.isEnabled(showPrismLabs));

  const prism = useMemo(() => {
    if (!prismVisible) return null;
    try {
      const active = loadPrismRun();
      if (active && active.phase !== 'defeat' && active.phase !== 'victory') {
        const anteLabel = active.isEndless ? `Endless Ante ${active.ante}` : `Ante ${active.ante}`;
        return {
          title: 'Prism Deck',
          subtitle: `Resume ${anteLabel} · $${active.gold} · ${active.charms.length} Charm${active.charms.length === 1 ? '' : 's'}`,
          badge: 'LIVE RUN',
        };
      }
      const meta = loadPrismMeta();
      if (meta.totalRuns > 0) {
        return {
          title: 'Prism Deck',
          subtitle: `Turn-Based Combo Roguelike · Best A${meta.bestAnte} · ${meta.victories} Win${meta.victories === 1 ? '' : 's'}`,
          badge: 'LABS',
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      title: 'Prism Deck',
      subtitle: 'Turn-Based Combo Roguelike · Daily & Endless',
      badge: 'LABS',
    };
  }, [prismVisible]);

  const mascotCharacter = CHARACTERS[mascotIndex % CHARACTERS.length];
  const outgoingMascotCharacter =
    outgoingMascotIndex !== null ? CHARACTERS[outgoingMascotIndex % CHARACTERS.length] : null;
  const useCompactFreshShelf = adventure.isFresh && !spire.unlocked && !prismVisible;
  const showFullSecondaryCards = !useCompactFreshShelf || otherModesExpanded;

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleO.value,
    transform: [{ translateY: titleY.value }],
  }));

  const heroCardStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: heroO.value * (1 - heroPressSV.value * (1 - BTN_PRESS.reducedOpacity)),
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }
    const pressScale = 1 - heroPressSV.value * (1 - SCALE.press);
    const pressY = heroPressSV.value * 3;
    return {
      opacity: heroO.value,
      transform: [
        { translateY: heroY.value + pressY },
        { scale: heroEnterS.value * pressScale },
      ],
    };
  });

  const mascotOutWrapStyle = useAnimatedStyle(() => {
    const p = mascotSwapProgress.value;
    // Lifted-floor crossfade preserves solid core opacity mid-swap and reaches 0 cleanly with zero white flash
    const outOpacity = p >= 0.999 ? 0 : (1 - p) * (1 + 0.55 * p);
    const outScale = reducedMotion ? 1 : 1 - 0.05 * p;
    return {
      opacity: outOpacity,
      transform: [
        { translateX: mascotLeanX.value },
        { scale: outScale },
      ],
    };
  });

  const mascotWrapStyle = useAnimatedStyle(() => {
    const p = mascotSwapProgress.value;
    const inScale = reducedMotion ? 1 : 0.95 + 0.05 * p;
    return {
      opacity: p,
      transform: [
        { translateX: mascotLeanX.value },
        { scale: inScale },
      ],
    };
  });

  const mascotRingStyle = useAnimatedStyle(() => ({
    opacity: mascotRingO.value,
    transform: [{ scale: mascotRingS.value }],
  }));

  const shelfStyle = useAnimatedStyle(() => ({
    opacity: shelfO.value,
    transform: [{ translateY: shelfY.value }],
  }));

  const handleOpenDojo = () => {
    triggerHaptic('light');
    playSound('click');
    const url = Platform.OS === 'web' ? DOJO_WEB_PATH : DOJO_PUBLIC_URL;
    void Linking.openURL(url).catch(() => {
      /* ignore if browser handler unavailable */
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Utility Bar: DOJO Guide + Settings (>=44x44px) */}
        <View style={styles.topUtilityBar}>
          <Pressable
            testID="menu-dojo-link"
            onPress={handleOpenDojo}
            accessibilityRole="link"
            accessibilityLabel="Open NShapes DOJO Guide"
            style={({ pressed }) => [
              styles.utilityPill,
              pressed && styles.menuButtonPressed,
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <Icon name="lorc/open-book" size={16} color={COLORS.slateCharcoal} noShadow />
            <Text style={styles.utilityPillText}>Guide</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              playSound('click');
              onSelectOptions();
            }}
            accessibilityRole="button"
            accessibilityLabel="Options"
            testID="menu-options"
            style={({ pressed }) => [
              styles.utilityPill,
              styles.settingsUtilityPill,
              pressed && styles.menuButtonPressed,
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <Icon name="lorc/gear-hammer" size={17} color={COLORS.slateCharcoal} noShadow />
            <Text style={styles.utilityPillText}>Settings</Text>
          </Pressable>
        </View>

        {/* Title & Unified 1-Sentence Pitch (Title "NSHAPES" preserved untouched) */}
        <Animated.View style={[styles.titleSection, titleStyle]}>
          <Text style={styles.title}>NSHAPES</Text>
          <Text style={styles.pitch} testID="menu-pitch">
            {UNIFIED_ELEVATOR_PITCH}
          </Text>
        </Animated.View>

        {/* Dominant 2x Hero Play / Continue Storybook Card */}
        <View style={styles.menuSection}>
          <Animated.View style={[styles.heroCard, heroCardStyle]}>
            {/* Live Storybook Matchup Stage: Mascot (non-nested interactive swap/pop!) vs Living Frontier Foe */}
            <View style={styles.heroStage} testID="menu-hero-stage">
              <Pressable
                testID="main-menu-mascot-tap"
                onPress={handleMascotTap}
                accessibilityRole="button"
                accessibilityLabel={`Cheer ${mascotCharacter.name} and preview next companion`}
                style={[
                  styles.heroAvatarBadge,
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      width: 78,
                      height: 78,
                      borderRadius: 39,
                      borderWidth: 3.5,
                      borderColor: COLORS.actionYellow,
                    },
                    mascotRingStyle,
                  ]}
                />
                {outgoingMascotCharacter && (
                  <Animated.View
                    pointerEvents="none"
                    testID="main-menu-mascot-outgoing"
                    style={[styles.mascotOutLayer, mascotOutWrapStyle]}
                  >
                    <FighterAvatar
                      key={`out-${outgoingMascotCharacter.name}`}
                      character={outgoingMascotCharacter}
                      size={74}
                      mood="idle"
                      animate={false}
                      lightweight
                      testID="main-menu-mascot-prev"
                    />
                  </Animated.View>
                )}
                <Animated.View style={mascotWrapStyle}>
                  <FighterAvatar
                    key={mascotCharacter.name}
                    character={mascotCharacter}
                    size={74}
                    mood={heroPressed ? 'anticipation' : 'idle'}
                    reaction={mascotReaction}
                    testID="main-menu-mascot"
                  />
                </Animated.View>
              </Pressable>

              <Pressable
                onPress={handleAdventurePress}
                onPressIn={handleHeroPressIn}
                onPressOut={handleHeroPressOut}
                accessibilityRole="button"
                accessibilityLabel={`Next battle ${adventure.frontierLevel.id} vs ${adventure.frontierFoe.name}`}
                style={[
                  styles.heroStageRight,
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={styles.heroVsCrest}>
                  <Icon name="lorc/crossed-swords" size={18} color={COLORS.actionYellow} noShadow />
                  <Text style={styles.heroStageTag}>{adventure.frontierLevel.id}</Text>
                </View>

                <View style={styles.heroFoeBadge} testID="menu-frontier-foe">
                  <LivingBreath seedKey={`menu-foe-${adventure.frontierFoe.name}`} size={50} amplitude={0.038}>
                    <EnemyAvatar
                      enemy={adventure.frontierFoe}
                      size={50}
                      mood="idle"
                      animate={false}
                      lightweight
                    />
                  </LivingBreath>
                </View>
              </Pressable>
            </View>

            {/* Dominant Hero CTA Copy (non-nested Pressable compressing the entire Hero Card) */}
            <Pressable
              onPress={handleAdventurePress}
              onPressIn={handleHeroPressIn}
              onPressOut={handleHeroPressOut}
              accessibilityRole="button"
              accessibilityLabel={`Adventure: ${adventure.title}`}
              testID="menu-adventure"
              style={[
                styles.heroBody,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle}>{adventure.title}</Text>
                {adventure.isFresh ? (
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>START HERE</Text>
                  </View>
                ) : (
                  <View style={styles.heroStarPill} testID="menu-star-count">
                    <Icon name="lorc/flat-star" size={13} color={COLORS.actionYellow} noShadow />
                    <Text style={styles.heroStarPillText}>{adventure.stars}</Text>
                  </View>
                )}
                {keyboardActive && Platform.OS === 'web' && (
                  <View style={styles.keycapBadge} testID="menu-enter-keycap">
                    <Text style={styles.keycapBadgeText}>ENTER</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroSubtitle}>{adventure.subtitle}</Text>
            </Pressable>
          </Animated.View>

          {/* Secondary Mode Shelf */}
          <Animated.View style={[styles.secondaryShelf, shelfStyle]}>
            {useCompactFreshShelf && (
              <View style={styles.otherModesHeader}>
                <Text style={styles.otherModesTitle}>OTHER MODES</Text>
                <Pressable
                  testID="menu-other-modes-toggle"
                  onPress={() => {
                    triggerHaptic('light');
                    playSound('click');
                    setOtherModesExpanded(prev => !prev);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: otherModesExpanded }}
                  style={({ pressed }) => [
                    styles.otherModesToggle,
                    pressed && styles.menuButtonPressed,
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Text style={styles.otherModesToggleText}>
                    {otherModesExpanded ? 'Compact' : 'Details'}
                  </Text>
                </Pressable>
              </View>
            )}

            {!showFullSecondaryCards ? (
              /* Compact 1-row collapsed shelf for 0-star fresh saves */
              <View style={styles.compactModesRow} testID="menu-other-modes-compact">
                <Pressable
                  testID="menu-freeplay"
                  onPress={() => {
                    triggerHaptic('light');
                    playSound('click');
                    onSelectFreeplay();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Free Play"
                  style={({ pressed }) => [
                    styles.compactModeChip,
                    styles.freeplayButton,
                    pressed && styles.menuButtonPressed,
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <Icon name="lorc/archery-target" size={18} color={COLORS.slateCharcoal} noShadow />
                  <View style={styles.compactChipCol}>
                    <Text style={styles.compactChipTitle}>Free Play</Text>
                    <Text style={styles.compactChipSub}>1-tap practice</Text>
                  </View>
                </Pressable>

                {onSelectSpire && (
                  <Pressable
                    testID="menu-spire"
                    disabled
                    accessibilityRole="button"
                    accessibilityState={{ disabled: true }}
                    accessibilityLabel={`Starfall Summit locked: ${spire.subtitle}`}
                    style={[styles.compactModeChip, styles.spireLockedButton]}
                  >
                    <Icon name="lorc/padlock" size={16} color="#6B655D" noShadow />
                    <View style={styles.compactChipCol}>
                      <Text style={styles.compactChipTitle}>{spire.title}</Text>
                      <Text style={styles.compactChipSub}>Unlocks after {SUMMIT_UNLOCK_LEVEL_ID}</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            ) : (
              /* Expanded / Returning Secondary Mode Shelf (restrained 3-tone tabletop palette) */
              <View style={styles.expandedModesStack}>
                {onSelectSpire && (
                  <ModeCard
                    onPress={spire.unlocked ? onSelectSpire : undefined}
                    disabled={!spire.unlocked}
                    variant={spire.unlocked ? 'spire' : 'spire_locked'}
                    icon={spire.unlocked ? 'lorc/mountaintop' : 'lorc/padlock'}
                    title={spire.title}
                    subtitle={spire.subtitle}
                    badge={spire.badge}
                    accessibilityLabel={
                      spire.unlocked
                        ? `Starfall Summit: ${spire.subtitle}`
                        : `Starfall Summit locked: ${spire.subtitle}`
                    }
                  />
                )}

                {prismVisible && prism && onSelectPrism && (
                  <ModeCard
                    onPress={onSelectPrism}
                    variant="prism"
                    icon="lorc/crystal-shine"
                    title={prism.title}
                    subtitle={prism.subtitle}
                    badge={prism.badge}
                    accessibilityLabel={`Prism Deck: ${prism.subtitle}`}
                  />
                )}

                <ModeCard
                  onPress={onSelectFreeplay}
                  variant="freeplay"
                  icon="lorc/archery-target"
                  title="Free Play"
                  subtitle="1-tap practice · No clock, no hearts"
                />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Restrained Footer: Discord + Version */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              playSound('click');
              void Linking.openURL(DISCORD_URL).catch(() => {
                /* ignore */
              });
            }}
            style={({ pressed }) => [
              styles.discordButtonSmall,
              pressed && styles.discordButtonPressed,
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
            accessibilityLabel="Join Discord"
            accessibilityRole="link"
          >
            <Icon name="discord-symbol" size={14} color={COLORS.canvasWhite} noShadow />
            <Text style={styles.discordTitleSmall}>Discord</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>v{version}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  topUtilityBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 8,
  },
  utilityPill: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
  },
  settingsUtilityPill: {
    backgroundColor: '#FFFDF7',
  },
  utilityPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  titleSection: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    gap: 4,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  pitch: {
    fontSize: 12.5,
    lineHeight: 17.5,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.84,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  menuSection: {
    gap: 12,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  heroCard: {
    minHeight: 144,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 18,
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 10,
  },
  heroStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF7',
    // Concentric radius: outer 18 - padding 12 ≈ 6..10
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  heroStageRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 74,
    gap: 8,
  },
  heroAvatarBadge: {
    position: 'relative',
    minWidth: 74,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotOutLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVsCrest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroStageTag: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.canvasWhite,
    letterSpacing: 0.6,
  },
  heroFoeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 4,
    minHeight: 54,
    justifyContent: 'center',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroTitle: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroBadge: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: COLORS.actionYellow,
  },
  heroStarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroStarPillText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.actionYellow,
  },
  keycapBadge: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 5,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  keycapBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: MONO_FONT,
    color: COLORS.deepOnyx,
  },
  heroSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  secondaryShelf: {
    gap: 8,
  },
  otherModesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 2,
  },
  otherModesTitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: COLORS.slateCharcoal,
    opacity: 0.72,
  },
  otherModesToggle: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherModesToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.tealSurface,
    textDecorationLine: 'underline',
  },
  compactModesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactModeChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactChipCol: {
    flex: 1,
    minWidth: 0,
  },
  compactChipTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  compactChipSub: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.76,
  },
  expandedModesStack: {
    gap: 8,
  },
  menuButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    padding: 10,
    gap: 11,
  },
  menuButtonPressed: {
    transform: [{ scale: SCALE.press }, { translateY: 1.5 }],
    opacity: 0.94,
  },
  spireButton: {
    backgroundColor: COLORS.tealSurface,
    borderColor: COLORS.slateCharcoal,
  },
  spireIconContainer: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  spireLockedButton: {
    backgroundColor: '#EDE7DC',
    borderColor: '#9E968A',
    borderStyle: 'dashed',
  },
  lockedIconContainer: {
    borderColor: '#9E968A',
  },
  prismButton: {
    backgroundColor: '#163A36',
    borderColor: '#D4A73A',
  },
  prismIconContainer: {
    borderColor: '#FFDE00',
  },
  freeplayButton: {
    backgroundColor: COLORS.canvasWhite,
  },
  buttonIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  buttonTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  buttonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flexShrink: 1,
  },
  menuBadge: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: COLORS.actionYellow,
  },
  menuButtonSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    flexShrink: 1,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  discordButtonSmall: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#5865F2',
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  discordButtonPressed: {
    backgroundColor: '#4752C4',
  },
  discordTitleSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 2,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    opacity: 0.55,
    letterSpacing: 1,
  },
});

export default MainMenu;
