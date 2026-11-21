/**
 * Evolution choice modal shown when matching a Catalyst card while 2+ armed
 * evolutions are idle. Presents up to 3 randomly drawn recipes so players can
 * adapt to the fight and enjoy strategic luck across both Adventure Mode and
 * Starfall Summit.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { EvolutionRecipe } from '../types';
import { EVOLUTION_RULES, getRecipe } from '../engine/sources';
import { Eyebrow, INK, PopIn } from './ui';

const EVO_ACCENT = '#B45309';

export interface EvolutionPickOverlayProps {
  /** Up to 3 randomly selected idle armed evolution recipe IDs */
  optionIds: readonly string[];
  /** Total idle armed recipes available when the Catalyst ignited */
  totalIdle: number;
  /** Recipe IDs already forged this fight or discovered in past runs */
  knownIds?: ReadonlySet<string>;
  /** Duration in seconds for the triggered evolution (defaults to EVOLUTION_RULES) */
  durationSec?: number;
  /** Called when the player picks an evolution to ignite */
  onPick: (recipeId: string) => void;
}

const EvolutionPickOverlay: React.FC<EvolutionPickOverlayProps> = ({
  optionIds,
  totalIdle,
  knownIds,
  durationSec = Math.round(EVOLUTION_RULES.durationMs / 1000),
  onPick,
}) => {
  const recipes = optionIds
    .map(id => getRecipe(id))
    .filter((r): r is EvolutionRecipe => !!r);

  if (recipes.length === 0) return null;

  const drawnFromPool = totalIdle > recipes.length;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={st.overlay} testID="evo-pick-overlay">
        <PopIn style={st.panel}>
          <View style={st.header} testID="evo-pick-header">
            <View style={st.eyebrowWrap}>
              <Eyebrow text="CATALYST IGNITED" color={COLORS.actionYellow} />
            </View>
            <Text style={st.title}>CHOOSE AN EVOLUTION</Text>
            <Text style={st.subtitle} testID="evo-pick-subtitle">
              {`Pick 1 of ${recipes.length} · Lasts ${durationSec}s (+${EVOLUTION_RULES.setDamage} dmg & ×${EVOLUTION_RULES.setMultiplier} every Set)`}
            </Text>
            {drawnFromPool && (
              <Text style={st.drawnNote} testID="evo-pick-drawn-note">
                {`${recipes.length} randomly drawn from ${totalIdle} armed`}
              </Text>
            )}
          </View>

          <ScrollView
            style={st.scroll}
            contentContainerStyle={st.list}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {recipes.map((recipe, idx) => {
              const isNew = !knownIds?.has(recipe.id);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  testID={`evo-pick-option-${idx}`}
                  onPress={() => onPick(recipe.id)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Ignite ${recipe.name}${isNew ? ', new' : ''}: ${recipe.activeText}`}
                  style={st.card}
                >
                  <View style={st.cardHead}>
                    <View style={st.medallion}>
                      <Icon name={recipe.icon} size={24} color={EVO_ACCENT} />
                    </View>
                    <View style={st.titleBlock}>
                      <View style={st.nameRow}>
                        <Text style={st.name}>{recipe.name}</Text>
                        {isNew && (
                          <View style={st.newPill} testID={`evo-pick-new-${idx}`}>
                            <Text style={st.newPillText}>NEW!</Text>
                          </View>
                        )}
                      </View>
                      <Text style={st.parents}>{recipe.familyText}</Text>
                    </View>
                    <View style={st.ignitePill}>
                      <Icon name="lorc/crystal-shine" size={13} color={INK} />
                      <Text style={st.igniteText}>IGNITE</Text>
                    </View>
                  </View>

                  <Text style={st.activeText} testID={`evo-pick-desc-${idx}`}>
                    {recipe.activeText}
                  </Text>
                  {!!recipe.flavor && (
                    <Text style={st.flavor} testID={`evo-pick-flavor-${idx}`}>
                      {recipe.flavor}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 14,
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: INK,
    padding: 16,
    gap: 12,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  eyebrowWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: INK,
    textAlign: 'center',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: INK,
    opacity: 0.85,
    textAlign: 'center',
    flexShrink: 1,
  },
  drawnNote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: EVO_ACCENT,
    textAlign: 'center',
    flexShrink: 1,
  },
  scroll: {
    width: '100%',
  },
  list: {
    gap: 10,
    paddingBottom: 2,
  },
  card: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    padding: 12,
    gap: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  medallion: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: EVO_ACCENT,
    backgroundColor: '#B453091F',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: INK,
    flexShrink: 1,
    minWidth: 0,
  },
  newPill: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexShrink: 0,
  },
  newPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: INK,
  },
  parents: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: EVO_ACCENT,
    flexShrink: 1,
  },
  ignitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  igniteText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: INK,
  },
  activeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: INK,
    flexShrink: 1,
  },
  flavor: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    color: INK,
    opacity: 0.72,
    flexShrink: 1,
  },
});

export default EvolutionPickOverlay;
