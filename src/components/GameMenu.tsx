import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { PlayerStats, Weapon, WeaponRarity } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import WeaponGuide from './WeaponGuide';
import Icon from './Icon';

interface GameMenuProps {
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
}

type MenuScreen = 'menu' | 'stats' | 'weapons';

const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'legendary': return '#FFD700';
    case 'rare': return '#9B59B6';
    case 'common': return COLORS.slateCharcoal;
    default: return COLORS.slateCharcoal;
  }
};

const GameMenu: React.FC<GameMenuProps> = ({ playerStats, playerWeapons = [], onExitGame }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<MenuScreen>('menu');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const openModal = () => {
    setCurrentScreen('menu');
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentScreen('menu');
  };

  // Group stats into categories for cleaner display
  const statCategories = {
    "Character": [
      'level', 'experienceGainPercent', 'luck',
      'maxWeapons', 'holographicPercent'
    ],
    "Resources": [
      'money', 'commerce', 'scavengingPercent',
      'scavengeAmount', 'freeRerolls'
    ],
    "Offensive": [
      'damage', 'damagePercent', 'criticalChance',
      'chanceOfFire', 'explosion', 'timeFreezePercent'
    ],
    "Defensive": [
      'health', 'maxHealth', 'dodgePercent',
      'deflectPercent', 'dodgeAttackBackPercent'
    ],
    "Gameplay": [
      'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
      'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
      'mulligans'
    ]
  };

  // Format stat for display
  const formatStat = (key: string, value: number | string) => {
    if (typeof value !== 'number') return value;

    // For percentage stats, add % symbol
    if (key.toLowerCase().includes('percent')) {
      return `${value}%`;
    }

    return value;
  };

  // Format a key from camelCase to Title Case with spaces
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  const renderMenuOptions = () => (
    <View style={styles.menuContainer}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Menu</Text>
        <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>X</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Options */}
      <View style={styles.menuOptionsContainer}>
        <TouchableOpacity
          style={styles.menuOption}
          onPress={() => setCurrentScreen('stats')}
        >
          <Text style={styles.menuOptionIcon}>📊</Text>
          <View style={styles.menuOptionTextContainer}>
            <Text style={styles.menuOptionTitle}>Character Stats</Text>
            <Text style={styles.menuOptionDescription}>View your current stats and abilities</Text>
          </View>
          <Text style={styles.menuOptionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuOption}
          onPress={() => setCurrentScreen('weapons')}
        >
          <Text style={styles.menuOptionIcon}>⚔️</Text>
          <View style={styles.menuOptionTextContainer}>
            <Text style={styles.menuOptionTitle}>Weapon Guide</Text>
            <Text style={styles.menuOptionDescription}>Browse all weapons and their effects</Text>
          </View>
          <Text style={styles.menuOptionArrow}>›</Text>
        </TouchableOpacity>

        {/* Exit Game Option */}
        {onExitGame && (
          <TouchableOpacity
            style={[styles.menuOption, styles.exitMenuOption]}
            onPress={() => setShowExitConfirm(true)}
          >
            <Text style={styles.menuOptionIcon}>🚪</Text>
            <View style={styles.menuOptionTextContainer}>
              <Text style={[styles.menuOptionTitle, styles.exitMenuOptionTitle]}>Exit Game</Text>
              <Text style={styles.menuOptionDescription}>Return to the main menu</Text>
            </View>
            <Text style={styles.menuOptionArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Close Button */}
      <TouchableOpacity onPress={closeModal} style={styles.closeModalButton}>
        <Text style={styles.closeModalButtonText}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  );

  // Group weapons by name for display
  const groupedWeapons = playerWeapons.reduce((acc, weapon) => {
    const key = `${weapon.name}-${weapon.rarity}`;
    if (!acc[key]) {
      acc[key] = { weapon, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, { weapon: Weapon; count: number }>);

  const renderStats = () => (
    <View style={styles.statsContainer}>
      {/* Modal Header */}
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => setCurrentScreen('menu')} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Character Stats</Text>
        <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>X</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modalContent}>
        {/* Equipped Weapons Section */}
        {playerWeapons.length > 0 && (
          <View style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>EQUIPPED WEAPONS ({playerWeapons.length})</Text>
            </View>
            <View style={styles.weaponsGrid}>
              {Object.values(groupedWeapons)
                .sort((a, b) => a.weapon.name.localeCompare(b.weapon.name))
                .map(({ weapon, count }) => (
                <View key={`${weapon.name}-${weapon.rarity}`} style={styles.weaponRow}>
                  <View style={[styles.weaponIconContainer, { borderColor: getRarityColor(weapon.rarity) }]}>
                    <Icon name={weapon.icon || 'lorc/field'} size={20} color={COLORS.slateCharcoal} />
                  </View>
                  <View style={styles.weaponInfo}>
                    <Text style={styles.weaponName}>{weapon.name}</Text>
                    <Text style={[styles.weaponRarity, { color: getRarityColor(weapon.rarity) }]}>
                      {weapon.rarity.charAt(0).toUpperCase() + weapon.rarity.slice(1)}
                    </Text>
                  </View>
                  {count > 1 && (
                    <View style={styles.weaponCountBadge}>
                      <Text style={styles.weaponCountText}>x{count}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* No weapons message */}
        {playerWeapons.length === 0 && (
          <View style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>EQUIPPED WEAPONS</Text>
            </View>
            <View style={styles.noWeaponsContainer}>
              <Text style={styles.noWeaponsText}>No weapons equipped yet</Text>
            </View>
          </View>
        )}

        {Object.entries(statCategories).map(([category, statKeys]) => (
          <View key={category} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
            </View>
            <View style={styles.statsGrid}>
              {statKeys.map(key => (
                <View key={key} style={styles.statRow}>
                  <Text style={styles.statKey}>{formatKey(key)}</Text>
                  <Text style={styles.statValue}>
                    {formatStat(key, playerStats[key as keyof PlayerStats] || 0)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Close Button */}
      <TouchableOpacity onPress={closeModal} style={styles.closeModalButton}>
        <Text style={styles.closeModalButtonText}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWeapons = () => (
    <WeaponGuide onClose={() => setCurrentScreen('menu')} />
  );

  const renderContent = () => {
    switch (currentScreen) {
      case 'stats':
        return renderStats();
      case 'weapons':
        return renderWeapons();
      default:
        return renderMenuOptions();
    }
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    setIsModalOpen(false);
    if (onExitGame) {
      onExitGame();
    }
  };

  return (
    <>
      {/* Menu Button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={openModal}
      >
        <Text style={styles.menuButtonText}>MENU</Text>
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {renderContent()}
          </View>
        </View>
      </Modal>

      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmContainer}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>Exit Game?</Text>
            </View>
            <View style={styles.confirmContent}>
              <Text style={styles.confirmText}>
                Are you sure you want to exit? Your current progress will be lost.
              </Text>
            </View>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowExitConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmExitButton}
                onPress={handleExitConfirm}
              >
                <Text style={styles.confirmExitText}>Exit Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  menuButton: {
    backgroundColor: COLORS.deepOnyx,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.button,
  },
  menuButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  menuContainer: {
    flex: 1,
  },
  statsContainer: {
    flex: 1,
  },
  modalHeader: {
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  modalTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.deepOnyx,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 20,
    marginTop: -2,
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
  menuOptionsContainer: {
    padding: 16,
    gap: 12,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    padding: 16,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 12,
  },
  menuOptionIcon: {
    fontSize: 24,
  },
  menuOptionTextContainer: {
    flex: 1,
  },
  menuOptionTitle: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 15,
  },
  menuOptionDescription: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  menuOptionArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 24,
    fontWeight: '300',
  },
  modalContent: {
    padding: 16,
  },
  categoryContainer: {
    marginBottom: 16,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
  },
  categoryHeader: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryTitle: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  statsGrid: {
    padding: 12,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
  },
  statValue: {
    color: COLORS.logicTeal,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  closeModalButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 16,
    marginTop: 0,
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
  // Weapons display styles
  weaponsGrid: {
    padding: 12,
    gap: 8,
  },
  weaponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weaponIconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.canvasWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  weaponInfo: {
    flex: 1,
  },
  weaponName: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 13,
  },
  weaponRarity: {
    fontSize: 11,
    fontWeight: '500',
  },
  weaponCountBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
  },
  weaponCountText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
  },
  noWeaponsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noWeaponsText: {
    color: COLORS.slateCharcoal,
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  // Exit menu option styles
  exitMenuOption: {
    backgroundColor: COLORS.impactRed + '15',
    borderColor: COLORS.impactRed,
  },
  exitMenuOptionTitle: {
    color: COLORS.impactRed,
  },
  // Exit confirmation modal styles
  confirmContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 350,
    overflow: 'hidden',
  },
  confirmHeader: {
    backgroundColor: COLORS.impactRed,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  confirmTitle: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmContent: {
    padding: 20,
  },
  confirmText: {
    color: COLORS.slateCharcoal,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmExitButton: {
    flex: 1,
    backgroundColor: COLORS.impactRed,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  confirmExitText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default GameMenu;
