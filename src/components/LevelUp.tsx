import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { usePWASafeAreaInsets } from '@/hooks/usePWASafeAreaInsets';
import { Character, PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';
import { ScreenTransition } from './ScreenTransition';
import { RerollButton, WeaponDetailCard, WeaponOptionTile, weaponPickerStyles } from './WeaponPicker';
import { playSound } from '@/utils/sounds';
import { FighterAvatar } from './fighters';

interface LevelUpProps {
  options: Weapon[];
  onSelect: (weapon: Weapon) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  character?: Character;
  onExitGame?: () => void;
  targetLevel: number;         // The level this reward is for
}

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls,
  playerStats,
  playerWeapons = [],
  character,
  onExitGame,
  targetLevel,
}) => {
  const insets = usePWASafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tapTriggers, setTapTriggers] = useState<Record<number, number>>({});

  // Reset focusedIndex when options change to ensure it's valid
  useEffect(() => {
    if (focusedIndex >= options.length && options.length > 0) {
      setFocusedIndex(0);
    }
    if (focusedIndex < options.length && options[focusedIndex] === undefined && options.length > 0) {
      const firstValid = options.findIndex(opt => opt !== undefined);
      if (firstValid >= 0) {
        setFocusedIndex(firstValid);
      }
    }
  }, [options, focusedIndex]);

  // Show hovered option if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;
  const focusedWeapon = options[displayedIndex];

  return (
    <ScreenTransition>
      <View style={styles.container}>
      <View style={styles.eyebrow}>
        <View style={styles.eyebrowLeft}>
          {character && (
            <FighterAvatar
              character={character}
              size={34}
              health={playerStats.health}
              maxHealth={playerStats.maxHealth}
              mood="streak"
              reaction={{ type: 'powerup', id: targetLevel }}
              interactive
            />
          )}
          <Text style={styles.eyebrowText}>Level Up!</Text>
          <Text style={styles.levelNumber}>Level {targetLevel}</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        </View>
        <View style={styles.eyebrowRight}>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyText}>${playerMoney}</Text>
          </View>
          <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} character={character} onExitGame={onExitGame} />
        </View>
      </View>

      <InventoryBar weapons={playerWeapons} />

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedWeapon ? (
          <WeaponDetailCard weapon={focusedWeapon} playerStats={playerStats} playerWeapons={playerWeapons} variant="levelUp" />
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select a weapon below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Choose Your <Text style={styles.freeText}>FREE</Text> Reward</Text>
          <RerollButton onReroll={onReroll} rerollCost={rerollCost} playerMoney={playerMoney} freeRerolls={freeRerolls} />
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsGrid}
          showsVerticalScrollIndicator={false}
        >
          {options.map((weapon, index) => {
            return (
              <WeaponOptionTile
                key={`${weapon.id}-${index}`}
                weapon={weapon}
                index={index}
                isFocused={focusedIndex === index}
                onPress={(index) => {
                  playSound('click');
                  setTapTriggers(prev => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
                  setHoveredIndex(null);
                  setFocusedIndex(index);
                }}
                onHoverIn={setHoveredIndex}
                onHoverOut={() => setHoveredIndex(null)}
                playerWeapons={playerWeapons}
                triggerKey={tapTriggers[index]}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.actionSection, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          onPress={() => {
            if (focusedWeapon) {
              playSound('confirm');
              onSelect(focusedWeapon);
            }
          }}
          disabled={!focusedWeapon}
          style={[styles.actionButton, !focusedWeapon && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonText}>
            Select Weapon
          </Text>
        </TouchableOpacity>
      </View>
      </View>
    </ScreenTransition>
  );
};

const styles = {
  ...weaponPickerStyles,
  ...StyleSheet.create({
    eyebrowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    levelNumber: {
      color: COLORS.slateCharcoal,
      fontWeight: '600',
      fontSize: 14,
    },
    freeBadge: {
      backgroundColor: COLORS.logicTeal,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.button,
    },
    freeBadgeText: {
      color: COLORS.canvasWhite,
      fontWeight: '800',
      fontSize: 10,
      letterSpacing: 1,
    },
    freeText: {
      color: COLORS.logicTeal,
      fontWeight: '800',
    },
    actionButton: {
      backgroundColor: COLORS.actionYellow,
      borderRadius: RADIUS.button,
      borderWidth: 1,
      borderColor: COLORS.slateCharcoal,
      paddingVertical: 16,
      alignItems: 'center',
    },
    actionButtonText: {
      color: COLORS.slateCharcoal,
      fontWeight: '700',
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    actionButtonDisabled: {
      backgroundColor: COLORS.paperBeige,
      opacity: 0.6,
    },
  }),
};

export default LevelUp;
