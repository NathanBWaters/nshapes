import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FighterAvatar } from '@/components/fighters';
import { CHARACTERS } from '@/utils/gameDefinitions';
import { COLORS, RADIUS } from '@/utils/colors';
import {
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
} from '@/utils/fighterAnimations';

const MOODS: FighterAmbientMood[] = [
  'idle',
  'curious',
  'anticipation',
  'streak',
  'urgent',
  'sleepy',
  'victory',
  'defeat',
];

const REACTIONS: { type: FighterReactionType; label: string }[] = [
  { type: 'joy', label: 'Match Joy' },
  { type: 'ecstatic', label: 'Mega / 3x Streak' },
  { type: 'pain', label: 'Mistake Pain' },
  { type: 'relief', label: 'Grace Phew!' },
  { type: 'heal', label: 'Heal +♥' },
  { type: 'powerup', label: 'Level Up!' },
  { type: 'hint', label: 'Hint Aha!' },
  { type: 'pet', label: 'Pet Blush' },
  { type: 'dizzy_joy', label: '5x Zoomie!' },
  { type: 'entrance', label: 'Salute' },
];

const HP_PRESETS: { label: string; health: number; maxHealth: number }[] = [
  { label: '4/4 Pristine', health: 4, maxHealth: 4 },
  { label: '3/4 Scuffed', health: 3, maxHealth: 4 },
  { label: '2/4 Battered', health: 2, maxHealth: 4 },
  { label: '1/4 Critical', health: 1, maxHealth: 4 },
  { label: '0/4 KO', health: 0, maxHealth: 4 },
];

export default function DevFightersPage() {
  const [hpPresetIndex, setHpPresetIndex] = useState(0);
  const [mood, setMood] = useState<FighterAmbientMood>('idle');
  const [reaction, setReaction] = useState<FighterReactionEvent | null>(null);
  const reactionIdRef = useRef(0);

  const hp = HP_PRESETS[hpPresetIndex];
  const healthState = getFighterHealthState(hp.health, hp.maxHealth);

  const trigger = (type: FighterReactionType) => {
    reactionIdRef.current += 1;
    setReaction({ type, id: reactionIdRef.current });
  };

  return (
    <View style={styles.container}>
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>FIGHTER ANIMATION STUDIO</Text>
        <Text style={styles.statePill}>{healthState.toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* All 6 Fighters Live Stage */}
        <View style={styles.grid}>
          {CHARACTERS.map((char) => (
            <View key={char.name} style={styles.fighterCard}>
              <FighterAvatar
                character={char}
                size={96}
                health={hp.health}
                maxHealth={hp.maxHealth}
                mood={mood}
                reaction={reaction}
                streak={mood === 'streak' ? 4 : 0}
                framed
                interactive
              />
              <Text style={styles.fighterName}>{char.name}</Text>
              <Text style={styles.petHint}>Tap 1x or 5x to pet!</Text>
            </View>
          ))}
        </View>

        {/* Health / Battle Damage Scrub */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>1. HEALTH & PROGRESSIVE WEAR-AND-TEAR</Text>
          <View style={styles.chipRow}>
            {HP_PRESETS.map((preset, idx) => (
              <TouchableOpacity
                key={preset.label}
                style={[styles.chip, hpPresetIndex === idx && styles.chipActive]}
                onPress={() => setHpPresetIndex(idx)}
              >
                <Text style={[styles.chipText, hpPresetIndex === idx && styles.chipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Discrete One-Shot Reactions */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>2. ONE-SHOT REACTIONS</Text>
          <View style={styles.chipRow}>
            {REACTIONS.map((r) => (
              <TouchableOpacity
                key={r.type}
                style={styles.reactionBtn}
                onPress={() => trigger(r.type)}
              >
                <Text style={styles.reactionBtnText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ambient Moods */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>3. CONTINUOUS AMBIENT MOODS</Text>
          <View style={styles.chipRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mood === m && styles.chipActive]}
                onPress={() => setMood(m)}
              >
                <Text style={[styles.chipText, mood === m && styles.chipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 48,
    backgroundColor: COLORS.actionYellow,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 1.5,
  },
  statePill: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.canvasWhite,
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  fighterCard: {
    width: '30%',
    minWidth: 112,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  fighterName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  petHint: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
  },
  panel: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 8,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
  },
  chipActive: {
    backgroundColor: COLORS.logicTeal,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  chipTextActive: {
    color: COLORS.canvasWhite,
  },
  reactionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.actionYellow,
  },
  reactionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
});
