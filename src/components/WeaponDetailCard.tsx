/**
 * WeaponDetailCard - Shared component for displaying weapon details
 *
 * Used in WeaponShop, LevelUp, and EnemySelection (stretch goal rewards).
 * Displays: icon, name, description, flavor text, stats preview, cap increase info.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Weapon, PlayerStats } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import {
  getDynamicDescription,
  getStatComparison,
  getCapIncreaseInfo,
  getRarityLabel,
} from '@/utils/weaponDisplay';
import Icon from './Icon';
import KeywordText from './KeywordText';

export interface WeaponDetailCardProps {
  /** The weapon to display */
  weapon: Weapon;
  /** Player stats for calculating stat comparisons */
  playerStats: PlayerStats;
  /** Player's current weapons for ownership count */
  playerWeapons?: Weapon[];
  /** Show price badge (for shop) */
  showPrice?: boolean;
  /** Show money reward badge (for stretch goals) */
  moneyReward?: number;
  /** Custom label for stats section */
  statsLabel?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Shared weapon detail display component.
 * Renders weapon info with KeywordText for descriptions.
 */
const WeaponDetailCard: React.FC<WeaponDetailCardProps> = ({
  weapon,
  playerStats,
  playerWeapons = [],
  showPrice = false,
  moneyReward,
  statsLabel = 'Stat Changes',
  compact = false,
}) => {
  const rarityColor = getRarityColor(weapon.rarity);
  const statComparison = getStatComparison(weapon, playerStats);
  const capInfo = getCapIncreaseInfo(weapon, playerStats);

  // Count how many of this weapon the player owns
  const ownershipCount = playerWeapons.filter(w => w.name === weapon.name).length;

  return (
    <View style={styles.container}>
      {/* Weapon Icon/Preview Area */}
      <View style={[styles.previewArea, { borderColor: rarityColor }]}>
        {weapon.icon ? (
          <Icon name={weapon.icon} size={compact ? 24 : 32} color={COLORS.slateCharcoal} />
        ) : (
          <Text style={styles.previewLabel}>{getRarityLabel(weapon.rarity)}</Text>
        )}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
          <Text style={styles.rarityBadgeText}>{getRarityLabel(weapon.rarity)}</Text>
        </View>
        {showPrice && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>${weapon.price}</Text>
          </View>
        )}
        {moneyReward !== undefined && (
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyBadgeText}>+${moneyReward}</Text>
          </View>
        )}
        {weapon.maxCount !== undefined && ownershipCount > 0 && (
          <View style={styles.ownershipIndicator}>
            <Text style={styles.ownershipIndicatorText}>
              {ownershipCount}/{weapon.maxCount} owned
            </Text>
          </View>
        )}
      </View>

      {/* Weapon Name */}
      <Text style={[styles.weaponName, { color: rarityColor }, compact && styles.weaponNameCompact]}>
        {weapon.name}
      </Text>

      {/* Description with KeywordText */}
      <KeywordText style={[styles.description, compact && styles.descriptionCompact]}>
        {getDynamicDescription(weapon, playerStats)}
      </KeywordText>

      {/* Flavor Text with KeywordText */}
      {weapon.flavorText && (
        <KeywordText style={[styles.flavorText, compact && styles.flavorTextCompact]}>
          {weapon.flavorText}
        </KeywordText>
      )}

      {/* Stats Preview */}
      {statComparison.length > 0 && (
        <View style={styles.effectsBox}>
          <Text style={styles.effectsLabel}>{statsLabel}</Text>
          {statComparison.map((stat, i) => (
            <View key={i} style={styles.statRow}>
              <Text style={styles.statKey}>{stat.key}</Text>
              <View style={styles.statValues}>
                {stat.isPerWeapon ? (
                  <>
                    <Text style={[
                      styles.statAfter,
                      stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                    ]}>
                      {stat.after}
                    </Text>
                    <Text style={styles.capIndicator}>(per weapon)</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.statBefore}>{stat.before}</Text>
                    <Text style={styles.statArrow}>→</Text>
                    <Text style={[
                      styles.statAfter,
                      stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                      stat.isCapped && styles.statCapped,
                    ]}>
                      {stat.after}
                    </Text>
                  </>
                )}
                {stat.cap !== null && (
                  <Text style={[styles.capIndicator, stat.isCapped && styles.capIndicatorCapped]}>
                    (max {stat.cap}%)
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Cap Increase Info (for Mastery weapons) */}
      {capInfo && (
        <View style={[styles.effectsBox, { marginTop: 8 }]}>
          <Text style={styles.effectsLabel}>Cap Increase</Text>
          <View style={styles.statRow}>
            <Text style={styles.statKey}>Current {capInfo.statName}</Text>
            <Text style={styles.statBefore}>{capInfo.currentValue}%</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statKey}>Current Cap</Text>
            <Text style={styles.statBefore}>{capInfo.currentCap}%</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statKey}>New Cap</Text>
            <Text style={styles.statIncrease}>{capInfo.newCap}%</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Container has no padding - let parent handle spacing
  },
  previewArea: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  rarityBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rarityBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  priceBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
  },
  moneyBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moneyBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
  },
  ownershipIndicator: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    backgroundColor: COLORS.impactOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownershipIndicatorText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
  },
  weaponName: {
    fontWeight: '700',
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weaponNameCompact: {
    fontSize: 16,
  },
  description: {
    color: COLORS.slateCharcoal,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 4,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  flavorText: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
    opacity: 0.6,
    lineHeight: 16,
    marginBottom: 8,
  },
  flavorTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  effectsBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
    padding: 8,
    marginTop: 8,
  },
  effectsLabel: {
    color: COLORS.logicTeal,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statKey: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.6,
  },
  statArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    opacity: 0.4,
  },
  statAfter: {
    fontSize: 12,
    fontWeight: '600',
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statDecrease: {
    color: COLORS.impactRed,
  },
  statCapped: {
    color: COLORS.impactOrange,
  },
  capIndicator: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    fontWeight: '400',
    opacity: 0.5,
  },
  capIndicatorCapped: {
    color: COLORS.impactOrange,
    opacity: 1,
  },
});

export default WeaponDetailCard;
