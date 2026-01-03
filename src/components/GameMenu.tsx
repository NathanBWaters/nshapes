import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { PlayerStats, Weapon, WeaponRarity, Card, Character } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '../theme';
import WeaponGuide from './WeaponGuide';
import Icon from './Icon';
import { WEAPONS, getWeaponByName } from '@/utils/gameDefinitions';

const WalkthroughableView = walkthroughable(View);

// Copilot step definitions for menu items
const MENU_COPILOT_STEPS = {
  menu_stats: { order: 11, text: "Character Stats shows your current health, money, level, and all your equipped weapons. Check here to see how powerful you've become!" },
  menu_weapons: { order: 12, text: "The Weapon Guide shows all 15 weapon types and what they do. Browse this before buying weapons in the shop!" },
  menu_exit: { order: 13, text: "Exit Game lets you return to the main menu. Your progress will be lost, so only use this when you want to start over!" },
};

// Weapon categories for dev testing
const WEAPON_CATEGORIES = {
  'Explosive': WEAPONS.filter(w => w.specialEffect === 'explosive'),
  'Auto-Hint': WEAPONS.filter(w => w.specialEffect === 'autoHint'),
  'Board Growth': WEAPONS.filter(w => w.specialEffect === 'boardGrowth'),
  'Fire': WEAPONS.filter(w => w.specialEffect === 'fire'),
  'Grace': WEAPONS.filter(w => w.specialEffect === 'graceGain'),
  'Healing': WEAPONS.filter(w => w.specialEffect === 'healing'),
  'Hint Gain': WEAPONS.filter(w => w.specialEffect === 'hintGain'),
  'Holographic': WEAPONS.filter(w => w.specialEffect === 'holographic'),
  'Time Gain': WEAPONS.filter(w => w.specialEffect === 'timeGain'),
  'Laser': WEAPONS.filter(w => w.specialEffect === 'laser'),
};

export interface DevModeCallbacks {
  onAddWeapon: (weapon: Weapon) => void;
  onClearWeapons: () => void;
  onAddGraces: (count: number) => void;
  onSetCardsOnFire: (count: number) => void;
  onMakeCardsHolo: (count: number) => void;
  onToggleTimer: () => void;
  onResetBoard: () => void;
  onAddCards: (count: number) => void;
  onChangeRound: (round: number) => void;
  onChangeAttributes: (count: number) => void;
  timerEnabled: boolean;
  currentRound: number;
  currentAttributes: number;
}

interface GameMenuProps {
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  character?: Character;  // Optional character to display in stats
  onExitGame?: () => void;
  devMode?: boolean;
  devCallbacks?: DevModeCallbacks;
  // Tutorial mode - when true, wraps menu button with CopilotStep
  copilotMode?: boolean;
  // Controlled mode for tutorial - parent controls whether menu is open
  controlledOpen?: boolean;
  // Callback when menu open state changes (for pausing game)
  onMenuOpenChange?: (isOpen: boolean) => void;
}

type MenuScreen = 'menu' | 'stats' | 'weapons' | 'dev';

const GameMenu: React.FC<GameMenuProps> = ({ playerStats, playerWeapons = [], character, onExitGame, devMode = false, devCallbacks, copilotMode = false, controlledOpen, onMenuOpenChange }) => {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<MenuScreen>('menu');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Use controlled mode when copilotMode is true, otherwise use internal state
  const isModalOpen = copilotMode ? (controlledOpen ?? false) : internalModalOpen;

  const openModal = () => {
    setCurrentScreen('menu');
    setInternalModalOpen(true);
    onMenuOpenChange?.(true);
  };
  const closeModal = () => {
    setInternalModalOpen(false);
    setCurrentScreen('menu');
    onMenuOpenChange?.(false);
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
      'graces'
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

  // Helper to wrap menu items with CopilotStep when in tutorial mode
  const withMenuCopilot = (
    name: keyof typeof MENU_COPILOT_STEPS,
    children: React.ReactNode
  ) => {
    if (!copilotMode) {
      return <>{children}</>;
    }
    const step = MENU_COPILOT_STEPS[name];
    return (
      <CopilotStep text={step.text} order={step.order} name={name}>
        <WalkthroughableView>{children}</WalkthroughableView>
      </CopilotStep>
    );
  };

  const renderMenuOptions = () => (
    <View style={styles.menuContainer}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Menu</Text>
        {!copilotMode && (
          <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Menu Options */}
      <View style={styles.menuOptionsContainer}>
        {withMenuCopilot('menu_stats',
          <TouchableOpacity
            style={styles.menuOption}
            onPress={copilotMode ? undefined : () => setCurrentScreen('stats')}
            disabled={copilotMode}
          >
            <Text style={styles.menuOptionIcon}>📊</Text>
            <View style={styles.menuOptionTextContainer}>
              <Text style={styles.menuOptionTitle}>Character Stats</Text>
              <Text style={styles.menuOptionDescription}>View your current stats and abilities</Text>
            </View>
            <Text style={styles.menuOptionArrow}>›</Text>
          </TouchableOpacity>
        )}

        {withMenuCopilot('menu_weapons',
          <TouchableOpacity
            style={styles.menuOption}
            onPress={copilotMode ? undefined : () => setCurrentScreen('weapons')}
            disabled={copilotMode}
          >
            <Text style={styles.menuOptionIcon}>⚔️</Text>
            <View style={styles.menuOptionTextContainer}>
              <Text style={styles.menuOptionTitle}>Weapon Guide</Text>
              <Text style={styles.menuOptionDescription}>Browse all weapons and their effects</Text>
            </View>
            <Text style={styles.menuOptionArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Dev Tools Option - only shown in dev mode, not in tutorial */}
        {devMode && !copilotMode && (
          <TouchableOpacity
            style={[styles.menuOption, styles.devMenuOption]}
            onPress={() => setCurrentScreen('dev')}
          >
            <Text style={styles.menuOptionIcon}>🛠️</Text>
            <View style={styles.menuOptionTextContainer}>
              <Text style={[styles.menuOptionTitle, styles.devMenuOptionTitle]}>Dev Tools</Text>
              <Text style={styles.menuOptionDescription}>Testing controls and weapon manipulation</Text>
            </View>
            <Text style={styles.menuOptionArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Exit Game Option - always show in tutorial for highlighting */}
        {(onExitGame || copilotMode) && withMenuCopilot('menu_exit',
          <TouchableOpacity
            style={[styles.menuOption, styles.exitMenuOption]}
            onPress={copilotMode ? undefined : () => setShowExitConfirm(true)}
            disabled={copilotMode}
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

  // Get the character's starting weapons for display
  const startingWeapons = character
    ? character.startingWeapons.map(name => getWeaponByName(name)).filter((w): w is Weapon => w !== undefined)
    : [];

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
        {/* Character Info Section */}
        {character && (
          <View style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>CHARACTER</Text>
            </View>
            <View style={styles.characterInfoContainer}>
              <View style={styles.characterIconContainer}>
                {character.icon && (
                  <Icon name={character.icon} size={48} color={COLORS.slateCharcoal} />
                )}
              </View>
              <View style={styles.characterDetails}>
                <Text style={styles.characterName}>{character.name}</Text>
                <Text style={styles.characterDescription}>{character.description}</Text>
              </View>
            </View>
          </View>
        )}

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
                    <View style={styles.weaponNameRow}>
                      <Text style={styles.weaponName}>{weapon.name}</Text>
                      {count > 1 && (
                        <View style={styles.weaponCountBadge}>
                          <Text style={styles.weaponCountText}>x{count}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.weaponShortDesc}>{weapon.shortDescription}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* No weapons message / Starting weapons display */}
        {playerWeapons.length === 0 && (
          <View style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>
                {startingWeapons.length > 0 ? 'STARTING WEAPONS' : 'EQUIPPED WEAPONS'}
              </Text>
            </View>
            {startingWeapons.length > 0 ? (
              <View style={styles.weaponsGrid}>
                {startingWeapons.map((weapon, index) => (
                  <View key={index} style={styles.weaponRow}>
                    <View style={[styles.weaponIconContainer, { borderColor: getRarityColor(weapon.rarity) }]}>
                      <Icon name={weapon.icon || 'lorc/field'} size={20} color={COLORS.slateCharcoal} />
                    </View>
                    <View style={styles.weaponInfo}>
                      <Text style={styles.weaponName}>{weapon.name}</Text>
                      <Text style={styles.weaponShortDesc}>{weapon.shortDescription}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noWeaponsContainer}>
                <Text style={styles.noWeaponsText}>No weapons equipped yet</Text>
              </View>
            )}
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

  const addLegendaryFromCategory = (category: string) => {
    const weapons = WEAPON_CATEGORIES[category as keyof typeof WEAPON_CATEGORIES];
    if (weapons && weapons.length > 0 && devCallbacks) {
      const legendary = weapons.find(w => w.rarity === 'legendary');
      if (legendary) devCallbacks.onAddWeapon(legendary);
    }
  };

  const renderDevTools = () => (
    <View style={styles.statsContainer}>
      {/* Header */}
      <View style={[styles.modalHeader, styles.devModalHeader]}>
        <TouchableOpacity onPress={() => setCurrentScreen('menu')} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Dev Tools</Text>
        <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>X</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modalContent}>
        {/* Game Controls */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>GAME CONTROLS</Text>
          </View>
          <View style={styles.devButtonGrid}>
            <TouchableOpacity
              style={[styles.devButton, devCallbacks?.timerEnabled ? styles.devButtonActive : null]}
              onPress={() => devCallbacks?.onToggleTimer()}
            >
              <Text style={styles.devButtonText}>
                Timer: {devCallbacks?.timerEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => devCallbacks?.onResetBoard()}
            >
              <Text style={styles.devButtonText}>Reset Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => devCallbacks?.onAddCards(3)}
            >
              <Text style={styles.devButtonText}>+3 Cards</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Round Selector */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>ROUND SELECT</Text>
          </View>
          <View style={styles.devRoundGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(round => (
              <TouchableOpacity
                key={round}
                style={[
                  styles.devRoundButton,
                  devCallbacks?.currentRound === round && styles.devRoundButtonActive
                ]}
                onPress={() => devCallbacks?.onChangeRound(round)}
              >
                <Text style={[
                  styles.devRoundButtonText,
                  devCallbacks?.currentRound === round && styles.devRoundButtonTextActive
                ]}>
                  {round}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Attribute Selector (Difficulty) */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>DIFFICULTY (ATTRIBUTES)</Text>
          </View>
          <View style={styles.devButtonGrid}>
            {[3, 4, 5].map(count => (
              <TouchableOpacity
                key={count}
                style={[
                  styles.devButton,
                  devCallbacks?.currentAttributes === count && styles.devButtonActive,
                  { flex: 1 }
                ]}
                onPress={() => devCallbacks?.onChangeAttributes(count)}
              >
                <Text style={styles.devButtonText}>
                  {count === 3 ? 'Easy (3)' : count === 4 ? 'Medium (4)' : 'Hard (5)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Card Modifiers */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>CARD MODIFIERS</Text>
          </View>
          <View style={styles.devButtonGrid}>
            <TouchableOpacity
              style={[styles.devButton, styles.devButtonOrange]}
              onPress={() => devCallbacks?.onSetCardsOnFire(3)}
            >
              <Text style={styles.devButtonText}>Set Fire (3)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devButton, styles.devButtonPurple]}
              onPress={() => devCallbacks?.onMakeCardsHolo(3)}
            >
              <Text style={styles.devButtonText}>Make Holo (3)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devButton, styles.devButtonBlue]}
              onPress={() => devCallbacks?.onAddGraces(3)}
            >
              <Text style={styles.devButtonText}>+3 Graces</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weapon Controls */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>ADD LEGENDARY WEAPONS</Text>
          </View>
          <View style={styles.devWeaponGrid}>
            {Object.keys(WEAPON_CATEGORIES).map(category => (
              <TouchableOpacity
                key={category}
                style={[styles.devButton, styles.devButtonGold]}
                onPress={() => addLegendaryFromCategory(category)}
              >
                <Text style={styles.devButtonTextSmall}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.devButton, styles.devButtonRed, { margin: 12, marginTop: 0 }]}
            onPress={() => devCallbacks?.onClearWeapons()}
          >
            <Text style={styles.devButtonText}>Clear All Weapons</Text>
          </TouchableOpacity>
        </View>

        {/* Current Stats Display */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryHeader, styles.devCategoryHeader]}>
            <Text style={styles.categoryTitle}>ACTIVE WEAPON STATS</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Explosion Chance</Text>
              <Text style={styles.statValue}>{playerStats.explosionChance || 0}%</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Fire Spread</Text>
              <Text style={styles.statValue}>{playerStats.fireSpreadChance || 0}%</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Laser Chance</Text>
              <Text style={styles.statValue}>{playerStats.laserChance || 0}%</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Holographic</Text>
              <Text style={styles.statValue}>{playerStats.holoChance || 0}%</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Graces</Text>
              <Text style={styles.statValue}>{playerStats.graces || 0}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Hints</Text>
              <Text style={styles.statValue}>{playerStats.hints || 0}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Close Button */}
      <TouchableOpacity onPress={closeModal} style={styles.closeModalButton}>
        <Text style={styles.closeModalButtonText}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (currentScreen) {
      case 'stats':
        return renderStats();
      case 'weapons':
        return renderWeapons();
      case 'dev':
        return renderDevTools();
      default:
        return renderMenuOptions();
    }
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    setInternalModalOpen(false);
    if (onExitGame) {
      onExitGame();
    }
  };

  // Menu button content
  const menuButtonContent = (
    <TouchableOpacity
      style={styles.menuButton}
      onPress={copilotMode ? undefined : openModal}
      disabled={copilotMode}
    >
      <Text style={styles.menuButtonText}>MENU</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Menu Button - wrapped with CopilotStep in tutorial mode */}
      {copilotMode ? (
        <CopilotStep
          text="Tap MENU to view your stats, check the weapon guide, or exit the game."
          order={10}
          name="menu"
        >
          <WalkthroughableView>
            {menuButtonContent}
          </WalkthroughableView>
        </CopilotStep>
      ) : (
        menuButtonContent
      )}

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
    backgroundColor: COLORS.paperBeige,
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
  weaponNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weaponShortDesc: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  weaponRarity: {
    fontSize: 11,
    fontWeight: '500',
  },
  weaponCountBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
  },
  weaponCountText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
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
  // Character info styles
  characterInfoContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  characterIconContainer: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.module,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
  },
  characterDetails: {
    flex: 1,
  },
  characterName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  characterDescription: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
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
  // Dev mode menu option styles
  devMenuOption: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
  },
  devMenuOptionTitle: {
    color: '#856404',
  },
  // Dev tools screen styles
  devModalHeader: {
    backgroundColor: '#FFC107',
  },
  devCategoryHeader: {
    backgroundColor: '#856404',
  },
  devButtonGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devWeaponGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  devButton: {
    backgroundColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.button,
    minWidth: 90,
    alignItems: 'center',
  },
  devButtonActive: {
    backgroundColor: '#28A745',
  },
  devButtonOrange: {
    backgroundColor: '#F97316',
  },
  devButtonPurple: {
    backgroundColor: '#9B59B6',
  },
  devButtonBlue: {
    backgroundColor: '#3B82F6',
  },
  devButtonGold: {
    backgroundColor: '#D97706',
    minWidth: 70,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  devButtonRed: {
    backgroundColor: COLORS.impactRed,
  },
  devButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 12,
  },
  devButtonTextSmall: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 10,
  },
  devRoundGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  devRoundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.paperBeige,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devRoundButtonActive: {
    backgroundColor: COLORS.logicTeal,
    borderColor: COLORS.logicTeal,
  },
  devRoundButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
  },
  devRoundButtonTextActive: {
    color: COLORS.canvasWhite,
  },
});

export default GameMenu;
