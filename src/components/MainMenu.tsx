import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { triggerHaptic } from '@/utils/haptics';
import { playSound } from '@/utils/sounds';
import Icon, { IconName } from './Icon';

interface MainMenuProps {
  onSelectAdventure: () => void;
  onSelectFreeplay: () => void;
  onSelectTutorial: () => void;
  onSelectOptions: () => void;
}

// Menu button component
function MenuButton({
  onPress,
  variant,
  icon,
  title,
  subtitle,
}: {
  onPress: () => void;
  variant: 'adventure' | 'freeplay' | 'tutorial' | 'options';
  icon: IconName;
  title: string;
  subtitle: string;
}) {
  const handlePress = () => {
    triggerHaptic('light');
    playSound('click');
    onPress();
  };

  const variantStyles = {
    adventure: {
      button: styles.adventureButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
    },
    freeplay: {
      button: styles.freeplayButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
    },
    tutorial: {
      button: styles.tutorialButton,
      iconBg: 'rgba(255,255,255,0.2)',
      iconColor: COLORS.canvasWhite,
      textColor: COLORS.canvasWhite,
    },
    options: {
      button: styles.optionsButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
    },
  };

  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={title}
      testID={`menu-${variant}`}
      style={[
        styles.menuButton,
        v.button,
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      <View style={[styles.buttonIconContainer, { backgroundColor: v.iconBg }]}>
        <Icon name={icon} size={32} color={v.iconColor} />
      </View>
      <View style={styles.buttonTextContainer}>
        <Text style={[styles.menuButtonText, { color: v.textColor }]}>{title}</Text>
        <Text style={[styles.menuButtonSubtext, { color: v.textColor, opacity: variant === 'tutorial' ? 0.9 : 0.7 }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSelectAdventure,
  onSelectFreeplay,
  onSelectTutorial,
  onSelectOptions,
}) => {
  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>NSHAPES</Text>
          <Text style={styles.subtitle}>Roguelike Match-Three Puzzle</Text>
        </View>

        {/* Menu Buttons */}
        <View style={styles.menuSection}>
          <MenuButton
            onPress={onSelectAdventure}
            variant="adventure"
            icon="lorc/crossed-swords"
            title="Adventure"
            subtitle="10 rounds, enemies & loot"
          />
          <MenuButton
            onPress={onSelectFreeplay}
            variant="freeplay"
            icon="lorc/archery-target"
            title="Free Play"
            subtitle="No timer, practice mode"
          />
          <MenuButton
            onPress={onSelectTutorial}
            variant="tutorial"
            icon="lorc/open-book"
            title="Tutorial"
            subtitle="Learn how to play"
          />
          <MenuButton
            onPress={onSelectOptions}
            variant="options"
            icon="lorc/gear-hammer"
            title="Options"
            subtitle="Sound settings"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>v1.0.0</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 56,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  menuSection: {
    gap: 16,
    paddingHorizontal: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 20,
    gap: 16,
  },
  adventureButton: {
    backgroundColor: COLORS.actionYellow,
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
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  buttonTextContainer: {
    flex: 1,
  },
  menuButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  menuButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
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
