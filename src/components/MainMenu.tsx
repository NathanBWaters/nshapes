import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Linking } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { triggerHaptic } from '@/utils/haptics';
import { playSound } from '@/utils/sounds';
import Icon, { IconName } from './Icon';
import { FighterAvatar } from './fighters';
import { CHARACTERS } from '@/utils/gameDefinitions';
import { SavedGameStorage } from '@/utils/storage';
import { loadAdventureSave } from '@/adventure/save';
import { getFrontierLevel, totalStars } from '@/adventure/progress';
import { levelFoe } from '@/adventure/data/foes';
import { STORY_TAGLINE } from '@/adventure/data/story';
import { loadSpireMeta, loadSpireRun } from '@/spire/save';
import { loadPrismMeta, loadPrismRun } from '@/prism/save';
import { version } from '../../package.json';

const DISCORD_URL = 'https://discord.gg/JFkUmp54Sp';

interface MainMenuProps {
  onSelectAdventure: () => void;
  onSelectSpire?: () => void;
  onSelectPrism?: () => void;
  onSelectFreeplay: () => void;
  onSelectTutorial: () => void;
  onSelectOptions: () => void;
  onResumeGame?: () => void;
}

function MenuButton({
  onPress,
  variant,
  icon,
  title,
  subtitle,
  badge,
  accessibilityLabel,
}: {
  onPress: () => void;
  variant: 'resume' | 'adventure' | 'spire' | 'prism' | 'freeplay' | 'tutorial' | 'options';
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
  accessibilityLabel?: string;
}) {
  const handlePress = () => {
    triggerHaptic('light');
    playSound('click');
    onPress();
  };

  const variantStyles = {
    resume: {
      button: styles.resumeButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.canvasWhite,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    adventure: {
      button: styles.adventureButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    spire: {
      button: styles.spireButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.canvasWhite,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    prism: {
      button: styles.prismButton,
      iconBg: '#195440',
      iconColor: '#F2C94C',
      textColor: COLORS.canvasWhite,
      badgeBg: '#F2C94C',
      badgeColor: '#0B1F19',
    },
    freeplay: {
      button: styles.freeplayButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    tutorial: {
      button: styles.tutorialButton,
      iconBg: 'rgba(255,255,255,0.2)',
      iconColor: COLORS.canvasWhite,
      textColor: COLORS.canvasWhite,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
    options: {
      button: styles.optionsButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
      badgeBg: COLORS.deepOnyx,
      badgeColor: COLORS.actionYellow,
    },
  };

  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={`menu-${variant}`}
      style={({ pressed }) => [
        styles.menuButton,
        v.button,
        pressed && styles.menuButtonPressed,
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      <View
        style={[
          styles.buttonIconContainer,
          { backgroundColor: v.iconBg },
          variant === 'prism' && styles.prismIconContainer,
        ]}
      >
        <Icon name={icon} size={26} color={v.iconColor} />
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
            { color: v.textColor, opacity: variant === 'tutorial' || variant === 'prism' ? 0.88 : 0.72 },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSelectAdventure,
  onSelectSpire,
  onSelectPrism,
  onSelectFreeplay,
  onSelectTutorial,
  onSelectOptions,
  onResumeGame,
}) => {
  const hasSavedGame = SavedGameStorage.hasSavedGame();
  const savedGame = hasSavedGame ? SavedGameStorage.load() : null;
  const [mascotIndex, setMascotIndex] = React.useState(0);

  // The Adventure button says where you are: a first invitation, or the foe that is waiting for you
  const adventure = React.useMemo(() => {
    try {
      const save = loadAdventureSave();
      const stars = totalStars(save);
      if (stars === 0 && Object.keys(save.plays).length === 0) {
        return { title: 'Play', subtitle: STORY_TAGLINE, isFresh: true };
      }
      const next = getFrontierLevel(save);
      return { title: 'Continue', subtitle: `${next.id} · ${levelFoe(next).name} is waiting   ★ ${stars}`, isFresh: false };
    } catch {
      return { title: 'Adventure', subtitle: 'Free your caged friends · Map, foes & stars', isFresh: false };
    }
  }, []);

  const spire = React.useMemo(() => {
    try {
      const active = loadSpireRun();
      if (active && active.phase !== 'defeat' && active.phase !== 'victory') {
        const actLabel = active.endless ? `Endless A${active.act}` : `Act ${active.act}`;
        return {
          title: 'Starfall Summit',
          subtitle: `Resume ${actLabel} · Floor ${active.floor} · ♥ ${active.hearts}/${active.maxHearts}`,
          badge: 'LIVE RUN',
        };
      }
      const meta = loadSpireMeta();
      if (meta.totalRuns > 0) {
        return {
          title: 'Starfall Summit',
          subtitle: `Roguelike Climb · Best Fl ${meta.bestFloor} · ${meta.victories} Win${meta.victories === 1 ? '' : 's'}`,
          badge: meta.highestAscensionUnlocked > 0 ? `A${meta.highestAscensionUnlocked}` : 'ROGUELIKE',
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      title: 'Starfall Summit',
      subtitle: 'Climb where the star fell · 3-Act Roguelike & Endless',
      badge: 'ROGUELIKE',
    };
  }, []);

  const prism = React.useMemo(() => {
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
          badge: 'TURN-BASED',
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      title: 'Prism Deck',
      subtitle: 'Turn-Based Combo Roguelike · Daily & Endless',
      badge: 'TURN-BASED',
    };
  }, []);

  const mascotCharacter = savedGame?.characterName
    ? CHARACTERS.find(c => c.name === savedGame.characterName) ?? CHARACTERS[0]
    : CHARACTERS[mascotIndex % CHARACTERS.length];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section with Living Mascot */}
        <View style={styles.titleSection}>
          <FighterAvatar
            character={mascotCharacter}
            size={56}
            interactive
            onPet={(type) => {
              if (type === 'dizzy_joy' && !savedGame) {
                setMascotIndex(i => (i + 1) % CHARACTERS.length);
              }
            }}
            testID="main-menu-mascot"
          />
          <Text style={styles.title}>NSHAPES</Text>
          <Text style={styles.subtitle}>Pattern-Matching Roguelike</Text>
        </View>

        <View style={styles.menuSection}>
          {hasSavedGame && onResumeGame && savedGame && (
            <MenuButton
              onPress={onResumeGame}
              variant="resume"
              icon="lorc/return-arrow"
              title="Resume Game"
              subtitle={`Round ${savedGame.round} - ${savedGame.characterName}`}
            />
          )}
          <MenuButton
            onPress={onSelectAdventure}
            variant="adventure"
            icon="lorc/crossed-swords"
            title={adventure.title}
            subtitle={adventure.subtitle}
            badge={adventure.isFresh ? 'START HERE' : undefined}
            accessibilityLabel={`Adventure: ${adventure.title}`}
          />
          {onSelectSpire && (
            <MenuButton
              onPress={onSelectSpire}
              variant="spire"
              icon="lorc/mountaintop"
              title={spire.title}
              subtitle={spire.subtitle}
              badge={spire.badge}
              accessibilityLabel={`Starfall Summit: ${spire.subtitle}`}
            />
          )}
          {onSelectPrism && (
            <MenuButton
              onPress={onSelectPrism}
              variant="prism"
              icon="lorc/crystal-shine"
              title={prism.title}
              subtitle={prism.subtitle}
              badge={prism.badge}
              accessibilityLabel={`Prism Deck: ${prism.subtitle}`}
            />
          )}
          <MenuButton
            onPress={onSelectFreeplay}
            variant="freeplay"
            icon="lorc/archery-target"
            title="Free Play"
            subtitle="No timer, practice mode"
          />
          {/* Tutorial and Options side by side - smaller buttons */}
          <View style={styles.secondaryButtonsRow}>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                playSound('click');
                onSelectTutorial();
              }}
              accessibilityLabel="Tutorial"
              testID="menu-tutorial"
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.tutorialButtonSmall,
                pressed && styles.menuButtonPressed,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Icon name="lorc/open-book" size={18} color={COLORS.canvasWhite} />
              <Text style={styles.secondaryButtonText}>Tutorial</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                playSound('click');
                onSelectOptions();
              }}
              accessibilityLabel="Options"
              testID="menu-options"
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.optionsButtonSmall,
                pressed && styles.menuButtonPressed,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <Icon name="lorc/gear-hammer" size={18} color={COLORS.slateCharcoal} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.slateCharcoal }]}>Options</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomSection}>
          {/* Discord Section - Even smaller */}
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              playSound('click');
              Linking.openURL(DISCORD_URL);
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: 6,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    opacity: 0.72,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  menuSection: {
    gap: 9,
    paddingHorizontal: 2,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 11,
    gap: 12,
  },
  menuButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  resumeButton: {
    backgroundColor: COLORS.logicTeal,
  },
  adventureButton: {
    backgroundColor: COLORS.actionYellow,
  },
  spireButton: {
    backgroundColor: COLORS.logicTeal,
    borderColor: COLORS.slateCharcoal,
  },
  prismButton: {
    backgroundColor: '#0F3D2E',
    borderColor: '#D4A73A',
  },
  prismIconContainer: {
    borderColor: '#F2C94C',
  },
  freeplayButton: {
    backgroundColor: COLORS.canvasWhite,
  },
  tutorialButton: {
    backgroundColor: COLORS.tutorialBlue,
    borderColor: COLORS.slateCharcoal,
  },
  optionsButton: {
    backgroundColor: COLORS.paperBeige,
    borderColor: COLORS.slateCharcoal,
  },
  buttonIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  menuBadge: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  menuBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: COLORS.actionYellow,
  },
  menuButtonSubtext: {
    fontSize: 11.5,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.72,
    flexShrink: 1,
  },
  // Secondary buttons row (Tutorial & Options side by side)
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
    minHeight: 44,
  },
  tutorialButtonSmall: {
    backgroundColor: COLORS.tutorialBlue,
  },
  optionsButtonSmall: {
    backgroundColor: COLORS.paperBeige,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 6,
  },
  discordButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#5865F2',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  discordButtonPressed: {
    backgroundColor: '#4752C4',
  },
  discordTitleSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.canvasWhite,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 2,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.5,
    letterSpacing: 1,
  },
});

export default MainMenu;
