import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Player, Weapon, PlayerStats, WeaponRarity, AdventureDifficulty } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import { ConfettiBurst } from './effects/ConfettiBurst';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { ScreenTransition } from './ScreenTransition';
import RoundProgressChart, { RoundScore } from './RoundProgressChart';

interface VictoryScreenProps {
  player: Player;
  finalScore: number;
  matchCount: number;
  playerStats: PlayerStats;
  roundScores: RoundScore[];
  difficulty: AdventureDifficulty;
  onReturnToMenu: () => void;
  onContinueEndless: () => void;
}

// Rarity colors
const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return COLORS.slateCharcoal;
    case 'rare': return '#1976D2';
    case 'legendary': return COLORS.impactOrange;
    default: return COLORS.slateCharcoal;
  }
};

const getRarityLabel = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};

// Group weapons by name+rarity and count duplicates
const groupWeapons = (weapons: Weapon[]): { weapon: Weapon; count: number }[] => {
  const groups = new Map<string, { weapon: Weapon; count: number }>();

  weapons.forEach(weapon => {
    const key = `${weapon.name}-${weapon.rarity}`;
    if (groups.has(key)) {
      groups.get(key)!.count++;
    } else {
      groups.set(key, { weapon, count: 1 });
    }
  });

  // Sort by rarity (legendary first, then rare, then common)
  const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, common: 2 };
  return Array.from(groups.values()).sort(
    (a, b) => (rarityOrder[a.weapon.rarity] ?? 3) - (rarityOrder[b.weapon.rarity] ?? 3)
  );
};

const VictoryScreen: React.FC<VictoryScreenProps> = ({
  player,
  finalScore,
  matchCount,
  playerStats,
  roundScores,
  difficulty,
  onReturnToMenu,
  onContinueEndless,
}) => {
  const groupedWeapons = groupWeapons(player.weapons);

  // Trigger confetti on mount
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Slight delay to ensure component is mounted
    const timer = setTimeout(() => setShowConfetti(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Get difficulty display info
  const getDifficultyInfo = (diff: AdventureDifficulty) => {
    switch (diff) {
      case 'easy':
        return { label: 'Easy', desc: '3 attributes for all rounds', icon: 'lorc/feather' as const, color: COLORS.logicTeal };
      case 'medium':
        return { label: 'Medium', desc: 'Progressive difficulty (3→4→5 attributes)', icon: 'lorc/archery-target' as const, color: COLORS.actionYellow };
      case 'hard':
        return { label: 'Hard', desc: '4-5 attributes throughout', icon: 'lorc/diamond-hard' as const, color: COLORS.impactOrange };
    }
  };

  const difficultyInfo = getDifficultyInfo(difficulty);

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Confetti celebration */}
        <ConfettiBurst trigger={showConfetti} count={50} />

      <View style={styles.card}>
        {/* Victory Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>!</Text>
          <Text style={styles.bannerTitle}>VICTORY</Text>
          <Text style={styles.bannerEmoji}>!</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Character Info */}
          <View style={styles.characterSection}>
            {player.character.icon && (
              <Icon name={player.character.icon} size={48} color={COLORS.deepOnyx} />
            )}
            <Text style={styles.characterName}>{player.character.name}</Text>
            <Text style={styles.subtitle}>Completed all 10 rounds!</Text>
          </View>

          {/* Challenge Completed Section */}
          <View style={styles.challengeSection}>
            <View style={styles.challengeHeader}>
              <Icon name="lorc/trophy" size={24} color={COLORS.actionYellow} />
              <Text style={styles.challengeTitle}>Challenge Completed</Text>
            </View>
            <View style={[styles.challengeCard, { borderColor: difficultyInfo.color }]}>
              <View style={styles.challengeRow}>
                <Icon name={difficultyInfo.icon} size={20} color={difficultyInfo.color} />
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeLabel}>Difficulty</Text>
                  <Text style={[styles.challengeDifficulty, { color: difficultyInfo.color }]}>
                    {difficultyInfo.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>{difficultyInfo.desc}</Text>
              <View style={styles.achievementBadge}>
                <Icon name="lorc/checked-shield" size={16} color={COLORS.logicTeal} />
                <Text style={styles.achievementText}>Achievement Unlocked</Text>
              </View>
            </View>
            <Text style={styles.rewardText}>
              🎉 Reward: Character unlock progress increased!
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <AnimatedCounter
                value={finalScore}
                duration={800}
                style={styles.statValue}
              />
              <Text style={styles.statLabel}>Final Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AnimatedCounter
                value={matchCount}
                duration={800}
                style={styles.statValue}
              />
              <Text style={styles.statLabel}>Total Matches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AnimatedCounter
                value={playerStats.level}
                duration={800}
                prefix="Lv."
                style={styles.statValue}
              />
              <Text style={styles.statLabel}>Final Level</Text>
            </View>
          </View>

          {/* Weapons Collected */}
          <View style={styles.weaponsSection}>
            <Text style={styles.sectionTitle}>Weapons Collected</Text>
            {groupedWeapons.length === 0 ? (
              <Text style={styles.emptyWeapons}>No weapons collected</Text>
            ) : (
              <View style={styles.weaponsList}>
                {groupedWeapons.map(({ weapon, count }, index) => (
                  <View
                    key={`${weapon.id}-${index}`}
                    style={[styles.weaponItem, { borderLeftColor: getRarityColor(weapon.rarity) }]}
                  >
                    {weapon.icon && (
                      <Icon name={weapon.icon} size={20} color={COLORS.slateCharcoal} />
                    )}
                    <View style={styles.weaponInfo}>
                      <Text style={styles.weaponName}>{weapon.name}</Text>
                      <Text style={[styles.weaponRarity, { color: getRarityColor(weapon.rarity) }]}>
                        {getRarityLabel(weapon.rarity)}
                      </Text>
                    </View>
                    {count > 1 && (
                      <View style={styles.weaponCount}>
                        <Text style={styles.weaponCountText}>x{count}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Final Stats Summary */}
          <View style={styles.finalStatsSection}>
            <Text style={styles.sectionTitle}>Final Stats</Text>
            <View style={styles.finalStatsGrid}>
              <View style={styles.finalStatItem}>
                <Text style={styles.finalStatIcon}>$</Text>
                <Text style={styles.finalStatValue}>{playerStats.money}</Text>
              </View>
              <View style={styles.finalStatItem}>
                <Text style={styles.finalStatIcon}>H</Text>
                <Text style={styles.finalStatValue}>{playerStats.health}/{playerStats.maxHealth}</Text>
              </View>
              <View style={styles.finalStatItem}>
                <Text style={styles.finalStatIcon}>?</Text>
                <Text style={styles.finalStatValue}>{playerStats.hints}/{playerStats.maxHints}</Text>
              </View>
              <View style={styles.finalStatItem}>
                <Text style={styles.finalStatIcon}>G</Text>
                <Text style={styles.finalStatValue}>{playerStats.graces}</Text>
              </View>
            </View>
          </View>

          {/* Round Progress Chart */}
          <View style={styles.roundProgressSection}>
            <Text style={styles.sectionTitle}>Round Progress</Text>
            <RoundProgressChart
              roundScores={roundScores}
              currentRound={10}
              height={160}
            />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.endlessButton} onPress={onContinueEndless}>
            <Text style={styles.endlessButtonText}>CONTINUE TO ENDLESS</Text>
            <Text style={styles.endlessSubtext}>Round 11+</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.returnButton} onPress={onReturnToMenu}>
            <Text style={styles.returnButtonText}>RETURN TO MENU</Text>
          </TouchableOpacity>
        </View>
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
    maxWidth: 400,
    maxHeight: '95%',
    overflow: 'hidden',
  },
  banner: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bannerEmoji: {
    fontSize: 28,
    color: COLORS.deepOnyx,
    fontWeight: '800',
  },
  bannerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.deepOnyx,
    letterSpacing: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  characterSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  characterName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.logicTeal,
    fontWeight: '600',
    marginTop: 4,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.paperBeige,
    padding: 16,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.slateCharcoal,
    opacity: 0.3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  weaponsSection: {
    marginBottom: 24,
  },
  emptyWeapons: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    opacity: 0.6,
  },
  weaponsList: {
    gap: 8,
  },
  weaponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    padding: 10,
    borderRadius: RADIUS.button,
    borderLeftWidth: 3,
    gap: 10,
  },
  weaponInfo: {
    flex: 1,
  },
  weaponName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  weaponRarity: {
    fontSize: 11,
    fontWeight: '500',
  },
  weaponCount: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  weaponCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    fontFamily: 'monospace',
  },
  finalStatsSection: {
    marginBottom: 24,
  },
  roundProgressSection: {
    marginBottom: 16,
  },
  finalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  finalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 6,
  },
  finalStatIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  finalStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.deepOnyx,
    fontFamily: 'monospace',
  },
  buttonSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  endlessButton: {
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  endlessButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    letterSpacing: 1,
  },
  endlessSubtext: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.canvasWhite,
    opacity: 0.8,
    marginTop: 2,
  },
  returnButton: {
    backgroundColor: COLORS.paperBeige,
    paddingVertical: 14,
    alignItems: 'center',
  },
  returnButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    letterSpacing: 1,
  },
});

export default VictoryScreen;
