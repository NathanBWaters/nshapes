import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { WEAPONS } from '@/utils/gameDefinitions';
import { Weapon, WeaponRarity } from '@/types';
import Icon from './Icon';

interface WeaponGuideProps {
  onClose: () => void;
}

// Group weapons by their base name (without rarity), sorted alphabetically
const getWeaponGroups = (): Map<string, Weapon[]> => {
  const groups = new Map<string, Weapon[]>();

  WEAPONS.forEach(weapon => {
    const existing = groups.get(weapon.name) || [];
    existing.push(weapon);
    groups.set(weapon.name, existing);
  });

  // Sort by weapon name alphabetically
  const sortedEntries = Array.from(groups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return new Map(sortedEntries);
};

const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'legendary': return '#FFD700';
    case 'rare': return '#9B59B6';
    case 'common': return COLORS.slateCharcoal;
    default: return COLORS.slateCharcoal;
  }
};

const getRarityLabel = (rarity: WeaponRarity): string => {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
};

const WeaponGuide: React.FC<WeaponGuideProps> = ({ onClose }) => {
  const weaponGroups = getWeaponGroups();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weapon Guide</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>X</Text>
        </TouchableOpacity>
      </View>

      {/* Intro text */}
      <View style={styles.introContainer}>
        <Text style={styles.introText}>
          Weapons provide special effects during gameplay. Collect multiple of the same type to stack their effects!
        </Text>
      </View>

      {/* Weapon list */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {Array.from(weaponGroups.entries()).map(([weaponName, variants]) => (
          <View key={weaponName} style={styles.weaponCard}>
            {/* Weapon header with icon and name */}
            <View style={styles.weaponHeader}>
              <View style={styles.iconContainer}>
                <Icon name={variants[0].icon || 'lorc/field'} size={28} color={COLORS.deepOnyx} />
              </View>
              <Text style={styles.weaponName}>{weaponName}</Text>
            </View>

            {/* Special effect badge if applicable */}
            {variants[0].specialEffect && (
              <View style={styles.specialEffectBadge}>
                <Text style={styles.specialEffectText}>
                  {variants[0].specialEffect.toUpperCase()}
                </Text>
              </View>
            )}

            {/* Rarity tiers */}
            <View style={styles.rarityContainer}>
              {variants.map((weapon) => (
                <View key={weapon.id} style={styles.rarityRow}>
                  <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(weapon.rarity) }]}>
                    <Text style={[
                      styles.rarityBadgeText,
                      weapon.rarity === 'common' && { color: COLORS.canvasWhite }
                    ]}>
                      {getRarityLabel(weapon.rarity)}
                    </Text>
                  </View>
                  <Text style={styles.weaponDescription}>{weapon.description}</Text>
                  <Text style={styles.weaponPrice}>${weapon.price}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Close button */}
      <TouchableOpacity onPress={onClose} style={styles.closeModalButton}>
        <Text style={styles.closeModalButtonText}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  headerTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.deepOnyx,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  introContainer: {
    backgroundColor: COLORS.paperBeige,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  introText: {
    color: COLORS.slateCharcoal,
    fontSize: 13,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  weaponCard: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
  },
  weaponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.slateCharcoal,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weaponName: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  specialEffectBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginTop: 8,
    borderRadius: RADIUS.button,
  },
  specialEffectText: {
    color: COLORS.canvasWhite,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rarityContainer: {
    padding: 12,
    gap: 8,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
    minWidth: 70,
    alignItems: 'center',
  },
  rarityBadgeText: {
    color: COLORS.deepOnyx,
    fontSize: 10,
    fontWeight: '700',
  },
  weaponDescription: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    flex: 1,
  },
  weaponPrice: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  closeModalButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 12,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default WeaponGuide;
