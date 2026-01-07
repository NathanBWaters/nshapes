import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Character } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import { ConfettiBurst } from './effects/ConfettiBurst';
import { ScreenTransition } from './ScreenTransition';
import { getWeaponByName } from '@/utils/gameDefinitions';

interface CharacterUnlockScreenProps {
  character: Character;
  onContinue: () => void;
}

const CharacterUnlockScreen: React.FC<CharacterUnlockScreenProps> = ({
  character,
  onContinue,
}) => {
  // Trigger confetti on mount
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Slight delay to ensure component is mounted
    const timer = setTimeout(() => setShowConfetti(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Confetti celebration */}
        <ConfettiBurst trigger={showConfetti} count={60} />

        <View style={styles.card}>
          {/* Banner */}
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>CHARACTER UNLOCKED!</Text>
          </View>

          <View style={styles.content}>
            {/* Character Icon */}
            <View style={styles.iconSection}>
              <View style={styles.iconContainer}>
                {character.icon ? (
                  <Icon name={character.icon} size={72} color={COLORS.deepOnyx} />
                ) : (
                  <Text style={styles.iconFallback}>{character.name[0]}</Text>
                )}
              </View>
            </View>

            {/* Character Name */}
            <Text style={styles.characterName}>{character.name}</Text>

            {/* Character Description */}
            <Text style={styles.characterDescription}>{character.description}</Text>

            {/* Starting Weapons */}
            {character.startingWeapons.length > 0 && (
              <View style={styles.weaponsSection}>
                <Text style={styles.sectionLabel}>STARTING WEAPONS</Text>
                <View style={styles.weaponsList}>
                  {character.startingWeapons.map((weaponName, index) => {
                    const weapon = getWeaponByName(weaponName);
                    return (
                      <View key={index} style={styles.weaponItem}>
                        {weapon?.icon && (
                          <Icon name={weapon.icon} size={18} color={COLORS.slateCharcoal} />
                        )}
                        <Text style={styles.weaponName}>{weaponName}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenTransition>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.actionYellow,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  banner: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconSection: {
    marginBottom: 16,
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconFallback: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  characterName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  characterDescription: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  weaponsSection: {
    width: '100%',
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  weaponsList: {
    gap: 8,
  },
  weaponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weaponName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  continueButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 18,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: COLORS.slateCharcoal,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    letterSpacing: 2,
  },
});

export default CharacterUnlockScreen;
