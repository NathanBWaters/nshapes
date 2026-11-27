/**
 * Prism Deck — 45-Second Interactive Cold-Open Tutorial.
 *
 * 3 playable mini-boards that teach SET rules, zero-punishment trait feedback,
 * Chips × Mult scoring, Charms, and Spells directly on the velvet felt table.
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { WeaponArtwork } from '@/components/weapons/WeaponArtwork';
import { ColorblindStorage } from '@/utils/storage';
import {
  CHARM_BY_ID,
  COLOR_LABELS,
  PATTERN_HAND_BY_ID,
  PRISM_COLORS as PRISM_CARD_COLORS,
  evaluateSet,
  getCardBaseChips,
  getPatternHandStats,
} from '@/prism';
import type { PrismCard, PrismColor, TraitCheck } from '@/prism';
import PrismCardTile from './PrismCardTile';
import { PRISM_COLORS, formatScore, getPrismShapeColor, playPrismSfx } from './prismTheme';

export interface PrismTutorialProps {
  onComplete: () => void;
}

const STEP1_CARDS: readonly PrismCard[] = [
  { id: 'tut-1a', color: 'red', shape: 'diamond', number: 1, edition: 'none' },
  { id: 'tut-1b', color: 'red', shape: 'diamond', number: 2, edition: 'none' },
  { id: 'tut-1c', color: 'red', shape: 'diamond', number: 3, edition: 'none' },
];

const STEP2_CARDS: readonly PrismCard[] = [
  { id: 'tut-2a', color: 'red', shape: 'oval', number: 1, edition: 'none' },
  { id: 'tut-2b', color: 'green', shape: 'squiggle', number: 2, edition: 'none' },
  { id: 'tut-2trap', color: 'red', shape: 'diamond', number: 3, edition: 'none' },
  { id: 'tut-2c', color: 'purple', shape: 'diamond', number: 3, edition: 'none' },
];

const STEP3_INITIAL_CARDS: readonly PrismCard[] = [
  { id: 'tut-3a', color: 'red', shape: 'oval', number: 1, edition: 'none' },
  { id: 'tut-3b', color: 'green', shape: 'squiggle', number: 2, edition: 'none' },
  { id: 'tut-3c', color: 'red', shape: 'diamond', number: 3, edition: 'none' },
  { id: 'tut-3d', color: 'red', shape: 'diamond', number: 2, edition: 'none' },
  { id: 'tut-3e', color: 'purple', shape: 'diamond', number: 3, edition: 'none' },
  { id: 'tut-3f', color: 'green', shape: 'diamond', number: 1, edition: 'none' },
  { id: 'tut-3g', color: 'purple', shape: 'squiggle', number: 1, edition: 'none' },
  { id: 'tut-3h', color: 'purple', shape: 'oval', number: 2, edition: 'none' },
  { id: 'tut-3i', color: 'green', shape: 'oval', number: 3, edition: 'none' },
];

const STEP3_TARGET = 250;

interface TutorialReceipt {
  handName: string;
  baseChips: number;
  pipChips: number;
  baseMult: number;
  rainbowTriggered: boolean;
  finalChips: number;
  finalMult: number;
  total: number;
}

const TRAIT_NAMES: Record<TraitCheck['trait'], string> = {
  shape: 'Shape',
  color: 'Color',
  number: 'Number',
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const readColorblind = (): boolean => {
  try {
    return typeof ColorblindStorage?.get === 'function' ? ColorblindStorage.get() : false;
  } catch {
    return false;
  }
};

const PrismTutorial: React.FC<PrismTutorialProps> = ({ onComplete }) => {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { width } = useWindowDimensions();
  const isCompact = width < 400;
  const [colorblind, setColorblind] = useState<boolean>(readColorblind);

  useEffect(() => {
    if (typeof ColorblindStorage?.subscribe !== 'function') return;
    return ColorblindStorage.subscribe(v => setColorblind(v));
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [stepCleared, setStepCleared] = useState(false);
  const [step3Cards, setStep3Cards] = useState<PrismCard[]>(() =>
    STEP3_INITIAL_CARDS.map(c => ({ ...c }))
  );
  const [step3Score, setStep3Score] = useState(0);
  const [repaintAvailable, setRepaintAvailable] = useState(true);
  const [repaintMode, setRepaintMode] = useState(false);
  const [repaintTargetIdx, setRepaintTargetIdx] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<TutorialReceipt | null>(null);
  const [hintBanner, setHintBanner] = useState<string | null>(null);

  const rainbowCharm = CHARM_BY_ID['rainbow-charm'];

  const activeBoard: readonly PrismCard[] =
    step === 1 ? STEP1_CARDS : step === 2 ? STEP2_CARDS : step3Cards;

  const boardCols = step === 2 ? 2 : 3;

  const selectedCards = useMemo(
    () => selected.map(i => activeBoard[i]).filter(Boolean),
    [selected, activeBoard]
  );

  const evaluation = useMemo(() => {
    if (selectedCards.length !== 3) return null;
    return evaluateSet(selectedCards, selected, boardCols);
  }, [selectedCards, selected, boardCols]);

  const previewMath = useMemo<TutorialReceipt | null>(() => {
    if (!evaluation?.isValid || !evaluation.classification) return null;
    const handId = evaluation.classification.handId;
    const stats = getPatternHandStats(handId, 1);
    const pipChips = selectedCards.reduce((sum, c) => sum + getCardBaseChips(c), 0);
    const finalChips = stats.chips + pipChips;
    const rainbowTriggered =
      step === 3 && (handId === 'true_rainbow' || handId === 'prismatic_crown');
    const finalMult = rainbowTriggered ? stats.mult * 2 : stats.mult;
    return {
      handName: PATTERN_HAND_BY_ID[handId].name,
      baseChips: stats.chips,
      pipChips,
      baseMult: stats.mult,
      rainbowTriggered,
      finalChips,
      finalMult,
      total: finalChips * finalMult,
    };
  }, [evaluation, selectedCards, step]);

  const orderedTraitChecks = useMemo(() => {
    if (!evaluation?.traitChecks.length) return [];
    const order: TraitCheck['trait'][] = ['shape', 'color', 'number'];
    return order
      .map(t => evaluation.traitChecks.find(tc => tc.trait === t))
      .filter((tc): tc is TraitCheck => Boolean(tc));
  }, [evaluation]);

  const handleToggleCard = (idx: number) => {
    if (stepCleared) return;

    // Step 3 Repaint Spell targeting
    if (step === 3 && repaintMode) {
      playPrismSfx('select');
      setRepaintTargetIdx(idx);
      setHintBanner('Pick a new Color below to repaint this card!');
      return;
    }

    setHintBanner(null);
    setSelected(prev => {
      if (prev.includes(idx)) {
        playPrismSfx('deselect');
        return prev.filter(i => i !== idx);
      }
      if (prev.length >= 3) {
        return prev;
      }
      playPrismSfx('select');
      return [...prev, idx];
    });
  };

  const handleApplyRepaint = (color: PrismColor) => {
    if (repaintTargetIdx === null) return;
    if (step3Cards[repaintTargetIdx]?.color === color) return;
    playPrismSfx('spell');
    setStep3Cards(prev =>
      prev.map((card, i) => (i === repaintTargetIdx ? { ...card, color } : card))
    );
    setRepaintAvailable(false);
    setRepaintMode(false);
    setRepaintTargetIdx(null);
    setHintBanner(`Repainted card to ${COLOR_LABELS[color]}! Now tap 3 cards and hit PLAY TRIO!`);
  };

  const handlePlaySet = () => {
    if (stepCleared || selected.length !== 3) return;
    if (!evaluation?.isValid || !previewMath) {
      playPrismSfx('invalid');
      setHintBanner(
        step === 2
          ? 'Zero penalty! Check the red X pill — swap the trap card out for the 3 Pink Triangles.'
          : 'Not a valid Set yet — every trait must be ALL SAME or ALL DIFFERENT.'
      );
      return;
    }

    setReceipt(previewMath);

    if (step === 1 || step === 2) {
      playPrismSfx('big_hit');
      setStepCleared(true);
      setHintBanner(null);
      return;
    }

    // Step 3: Check against Blind target 250
    const nextScore = step3Score + previewMath.total;
    setStep3Score(nextScore);
    if (nextScore >= STEP3_TARGET) {
      playPrismSfx('win');
      setStepCleared(true);
      setHintBanner(null);
    } else {
      playPrismSfx('play');
      setSelected([]);
      setHintBanner(
        `+${formatScore(previewMath.total)} scored! Need ${formatScore(
          STEP3_TARGET - nextScore
        )} more — match a True Rainbow (or use Repaint) to ignite Rainbow Charm ×2!`
      );
    }
  };

  const handleAdvanceStep = () => {
    playPrismSfx('click');
    if (step === 1) {
      setStep(2);
      setSelected([]);
      setStepCleared(false);
      setReceipt(null);
      setHintBanner(null);
    } else if (step === 2) {
      setStep(3);
      setSelected([]);
      setStepCleared(false);
      setReceipt(null);
      setHintBanner(null);
      setStep3Cards(STEP3_INITIAL_CARDS.map(c => ({ ...c })));
      setStep3Score(0);
      setRepaintAvailable(true);
      setRepaintMode(false);
      setRepaintTargetIdx(null);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    playPrismSfx('click');
    onComplete();
  };

  const stepMeta =
    step === 1
      ? {
          eyebrow: 'STEP 1 OF 3 · YOUR FIRST TRIO',
          title: 'Same Color, Same Shape, 1-2-3',
          prompt:
            'In Prism Deck, a Trio is 3 cards where each trait (Color, Shape, Number) is ALL THE SAME or ALL DIFFERENT. Tap all 3 Orange Triangles and hit PLAY TRIO!',
        }
      : step === 2
        ? {
            eyebrow: 'STEP 2 OF 3 · SPOT THE TRAP',
            title: 'Zero Punishment — Instant Feedback',
            prompt:
              '3 cards below make a True Rainbow (all traits different), and 1 is a "2-same, 1-odd" trap. Try tapping the trap — Prism Deck shows why with zero penalty!',
          }
        : {
            eyebrow: 'STEP 3 OF 3 · COMBOS, CHARMS & SPELLS',
            title: 'Smash the Blind Target (250)',
            prompt:
              'Charms multiply your Trios! Match a True Rainbow (all traits different) — or cast Repaint on the top-right 3 Orange Triangles → Pink to forge a Prismatic Crown!',
          };

  const cardWidthStyle =
    step === 2 ? styles.cardSlot2Col : styles.cardSlot3Col;

  const progressRatio = Math.min(1, step3Score / STEP3_TARGET);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(12, insets.bottom) }]}>
      {/* Top Progress + Skip Bar */}
      <View style={styles.topBar}>
        <View style={styles.stepPills}>
          {([1, 2, 3] as const).map(n => {
            const active = n === step;
            const done = n < step || (n === step && stepCleared);
            return (
              <View
                key={n}
                style={[
                  styles.stepPill,
                  done && styles.stepPillDone,
                  active && !done && styles.stepPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.stepPillText,
                    (active || done) && styles.stepPillTextActive,
                  ]}
                >
                  {done ? '✓' : n}
                </Text>
              </View>
            );
          })}
          <Text style={styles.topLabel}>45s Intro</Text>
        </View>

        <Pressable
          testID="prism-tutorial-skip"
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip Tutorial"
          style={({ pressed }) => [
            styles.skipBtn,
            pressed && styles.pressed,
            Platform.OS === 'web' && { cursor: 'pointer' as never },
          ]}
        >
          <Text style={styles.skipBtnText}>Skip Tutorial</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stageWrap}>
          {/* Prompt Banner */}
          <View style={styles.promptCard}>
            <Text style={styles.eyebrow}>{stepMeta.eyebrow}</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>{stepMeta.title}</Text>
            <Text style={styles.promptBody}>{stepMeta.prompt}</Text>
          </View>

          {/* Step 3: Mini Blind Target + Rainbow Charm + Repaint Spell */}
          {step === 3 && (
            <View style={styles.step3MetaRow}>
              {/* Blind target card */}
              <View style={styles.targetCard}>
                <View style={styles.targetHeader}>
                  <Text style={styles.targetLabel}>BLIND TARGET</Text>
                  <Text style={styles.targetValue}>
                    {formatScore(step3Score)} / {formatScore(STEP3_TARGET)}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progressRatio * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Charm + Spell strip */}
              <View style={styles.charmSpellRow}>
                <View
                  style={[
                    styles.charmMiniCard,
                    previewMath?.rainbowTriggered && styles.charmMiniCardActive,
                  ]}
                >
                  <View style={styles.charmArtWrap}>
                    <WeaponArtwork name="Rainbow Charm" rarity="rare" />
                  </View>
                  <View style={styles.charmTextWrap}>
                    <View style={styles.charmTitleRow}>
                      <Text style={styles.charmName}>{rainbowCharm?.name ?? 'Rainbow Charm'}</Text>
                      <View style={styles.xMultTag}>
                        <Text style={styles.xMultTagText}>×2 Mult</Text>
                      </View>
                    </View>
                    <Text style={styles.charmDesc}>
                      ×2 Mult on True Rainbow or Prismatic Crown
                    </Text>
                  </View>
                </View>

                <Pressable
                  testID="prism-tutorial-spell-repaint"
                  disabled={!repaintAvailable || stepCleared}
                  onPress={() => {
                    if (!repaintAvailable || stepCleared) return;
                    playPrismSfx('click');
                    if (repaintMode) {
                      setRepaintMode(false);
                      setRepaintTargetIdx(null);
                      setHintBanner(null);
                    } else if (selected.length === 1) {
                      setRepaintMode(true);
                      setRepaintTargetIdx(selected[0]);
                      setHintBanner('Pick a new Color below to repaint this card!');
                    } else {
                      setRepaintMode(true);
                      setRepaintTargetIdx(null);
                      setSelected([]);
                      setHintBanner('Tap any card on the board to Repaint its color!');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.spellBtn,
                    repaintMode && styles.spellBtnActive,
                    (!repaintAvailable || stepCleared) && styles.spellBtnUsed,
                    pressed && repaintAvailable && styles.pressed,
                    Platform.OS === 'web' && repaintAvailable && !stepCleared && { cursor: 'pointer' as never },
                  ]}
                >
                  <Icon
                    name="lorc/flowers"
                    size={20}
                    color={repaintAvailable ? PRISM_COLORS.gold : PRISM_COLORS.textMuted}
                  />
                  <View style={styles.spellBtnTextWrap}>
                    <Text style={styles.spellBtnTitle}>
                      {repaintAvailable ? (repaintMode ? 'Cancel Repaint' : 'Repaint Spell') : 'Repaint Used'}
                    </Text>
                    <Text style={styles.spellBtnSub}>
                      {repaintAvailable ? 'Change 1 card color' : 'Color shifted ✓'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Repaint color picker */}
              {repaintMode && repaintTargetIdx !== null && (
                <View style={styles.colorPickerRow}>
                  <Text style={styles.colorPickerLabel}>Paint card:</Text>
                  {PRISM_CARD_COLORS.map(col => {
                    const isCurrent = step3Cards[repaintTargetIdx]?.color === col;
                    const swatchColor = getPrismShapeColor(col, colorblind);
                    return (
                      <Pressable
                        key={col}
                        testID={`prism-tutorial-repaint-${col}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isCurrent }}
                        disabled={isCurrent}
                        onPress={() => handleApplyRepaint(col)}
                        style={({ pressed }) => [
                          styles.colorChoiceBtn,
                          { borderColor: swatchColor },
                          isCurrent && styles.btnDisabled,
                          pressed && !isCurrent && styles.pressed,
                          Platform.OS === 'web' && !isCurrent && { cursor: 'pointer' as never },
                        ]}
                      >
                        <View style={[styles.colorDot, { backgroundColor: swatchColor }]} />
                        <Text style={styles.colorChoiceText}>
                          {COLOR_LABELS[col]}
                          {isCurrent ? ' (Current)' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Felt Table with Cards */}
          <View style={styles.feltTable}>
            <View style={[styles.cardGrid, step === 2 && styles.cardGrid2Col]}>
              {activeBoard.map((card, idx) => {
                const isSelected = selected.includes(idx);
                const isRepaintTarget = repaintMode && repaintTargetIdx === idx;
                return (
                  <View key={card.id} style={cardWidthStyle}>
                    <PrismCardTile
                      card={card}
                      selected={isSelected || isRepaintTarget}
                      highlightTarget={repaintMode}
                      disabled={stepCleared}
                      compact={step === 3 && isCompact}
                      onPress={() => handleToggleCard(idx)}
                      testID={`prism-tutorial-card-${idx}`}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Live Inline Feedback / Trait Pills / Score Ignition */}
          {!stepCleared && evaluation && !evaluation.isValid && (
            <View style={styles.diagnosticCard} testID="prism-tutorial-diagnostic">
              <Text style={styles.diagnosticTitle}>
                Not a Set yet — zero punishment! Check the traits:
              </Text>
              <View style={styles.traitPillRow}>
                {orderedTraitChecks.map(tc => {
                  const ok = tc.status !== 'mismatch';
                  return (
                    <View
                      key={tc.trait}
                      style={[
                        styles.traitPill,
                        ok ? styles.traitPillOk : styles.traitPillBad,
                      ]}
                    >
                      <Text
                        style={[
                          styles.traitPillText,
                          ok ? styles.traitPillTextOk : styles.traitPillTextBad,
                        ]}
                      >
                        {TRAIT_NAMES[tc.trait]} {ok ? '✓' : '✗'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {evaluation.mismatchReason && (
                <Text style={styles.diagnosticReason}>{evaluation.mismatchReason}</Text>
              )}
            </View>
          )}

          {!stepCleared && previewMath && (
            <View style={styles.previewScoreCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
                <Text style={styles.previewHandLabel}>{previewMath.handName}</Text>
                {previewMath.rainbowTriggered && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon name="lorc/crystal-shine" size={12} color={PRISM_COLORS.gold} noShadow />
                    <Text style={styles.previewHandLabel}>Rainbow Charm ×2!</Text>
                  </View>
                )}
              </View>
              <View style={styles.mathRow}>
                <View style={styles.chipsBox}>
                  <Text style={styles.chipsText}>{previewMath.finalChips}</Text>
                  <Text style={styles.boxSubLabel}>CHIPS</Text>
                </View>
                <Text style={styles.timesSign}>×</Text>
                <View style={styles.multBox}>
                  <Text style={styles.multText}>{previewMath.finalMult}</Text>
                  <Text style={styles.boxSubLabel}>MULT</Text>
                </View>
                <Text style={styles.timesSign}>=</Text>
                <Text style={styles.totalPreviewText}>{formatScore(previewMath.total)}</Text>
              </View>
            </View>
          )}

          {hintBanner && !stepCleared && (
            <View style={styles.hintBar}>
              <Icon name="lorc/light-bulb" size={16} color={PRISM_COLORS.gold} />
              <Text style={styles.hintText}>{hintBanner}</Text>
            </View>
          )}

          {/* Celebration Receipt Card */}
          {stepCleared && receipt && (
            <View style={styles.celebrationCard} testID="prism-tutorial-celebration">
              <View style={styles.celebrationHeader}>
                <Icon
                  name={step === 3 ? 'lorc/crown' : 'delapouite/sparkles'}
                  size={24}
                  color={PRISM_COLORS.gold}
                />
                <Text style={styles.celebrationTitle}>
                  {step === 1
                    ? 'Crisp Set! You Got It!'
                    : step === 2
                      ? 'True Rainbow Mastered!'
                      : 'Blind Smashed! Ready to Play!'}
                </Text>
              </View>

              <View style={styles.receiptStepsRow}>
                <View style={styles.receiptChip}>
                  <Text style={styles.receiptChipText}>
                    {receipt.handName}: {receipt.baseChips}C × {receipt.baseMult}M
                  </Text>
                </View>
                <View style={styles.receiptChip}>
                  <Text style={styles.receiptChipText}>Card Pips: +{receipt.pipChips}C</Text>
                </View>
                {receipt.rainbowTriggered && (
                  <View style={[styles.receiptChip, styles.receiptChipRainbow]}>
                    <Text style={[styles.receiptChipText, { color: PRISM_COLORS.xMultPurple }]}>
                      Rainbow Charm: ×2 Mult
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.mathRow}>
                <View style={styles.chipsBox}>
                  <Text style={styles.chipsText}>{receipt.finalChips}</Text>
                  <Text style={styles.boxSubLabel}>CHIPS</Text>
                </View>
                <Text style={styles.timesSign}>×</Text>
                <View style={styles.multBox}>
                  <Text style={styles.multText}>{receipt.finalMult}</Text>
                  <Text style={styles.boxSubLabel}>MULT</Text>
                </View>
                <Text style={styles.timesSign}>=</Text>
                <Text style={styles.totalWinText}>{formatScore(receipt.total)}</Text>
              </View>

              <Pressable
                testID={step === 3 ? 'prism-tutorial-finish' : 'prism-tutorial-next'}
                onPress={handleAdvanceStep}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {step === 3 ? 'Enter Prism Deck →' : `Next: Step ${step + 1} of 3 →`}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Action Row while playing step */}
          {!stepCleared && (
            <View style={styles.actionRow}>
              <Pressable
                testID="prism-tutorial-clear"
                disabled={selected.length === 0}
                onPress={() => {
                  playPrismSfx('deselect');
                  setSelected([]);
                  setHintBanner(null);
                }}
                style={({ pressed }) => [
                  styles.clearBtn,
                  selected.length === 0 && styles.btnDisabled,
                  pressed && selected.length > 0 && styles.pressed,
                  Platform.OS === 'web' && selected.length > 0 && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.clearBtnText}>Clear ({selected.length}/3)</Text>
              </Pressable>

              <Pressable
                testID="prism-tutorial-play"
                disabled={selected.length !== 3}
                onPress={handlePlaySet}
                style={({ pressed }) => [
                  styles.playBtn,
                  selected.length !== 3 && styles.btnDisabled,
                  evaluation?.isValid && styles.playBtnReady,
                  pressed && selected.length === 3 && styles.pressed,
                  Platform.OS === 'web' && selected.length === 3 && { cursor: 'pointer' as never },
                ]}
              >
                <Text style={styles.playBtnText}>
                  {selected.length < 3
                    ? `Select ${3 - selected.length} More`
                    : evaluation?.isValid
                      ? 'PLAY TRIO!'
                      : 'Check Set'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
  },
  stepPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillActive: {
    borderColor: PRISM_COLORS.gold,
    backgroundColor: 'rgba(242, 201, 76, 0.16)',
  },
  stepPillDone: {
    borderColor: PRISM_COLORS.econGreen,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
  },
  stepPillTextActive: {
    color: PRISM_COLORS.textPrimary,
  },
  topLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  skipBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltElevated,
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 28,
  },
  stageWrap: {
    width: '100%',
    maxWidth: 640,
    gap: 12,
  },
  promptCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 14,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: PRISM_COLORS.gold,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  titleCompact: {
    fontSize: 18,
  },
  promptBody: {
    fontSize: 13,
    lineHeight: 19,
    color: PRISM_COLORS.textMuted,
  },
  step3MetaRow: {
    gap: 10,
  },
  targetCard: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
    gap: 8,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: PRISM_COLORS.textMuted,
  },
  targetValue: {
    fontSize: 15,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: PRISM_COLORS.feltBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 4,
  },
  charmSpellRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  charmMiniCard: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
  },
  charmMiniCardActive: {
    borderColor: PRISM_COLORS.gold,
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
  },
  charmArtWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charmTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  charmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  charmName: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  xMultTag: {
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  xMultTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.xMultPurple,
  },
  charmDesc: {
    fontSize: 11,
    color: PRISM_COLORS.textMuted,
    marginTop: 2,
  },
  spellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    backgroundColor: PRISM_COLORS.feltElevated,
  },
  spellBtnActive: {
    borderColor: PRISM_COLORS.gold,
    backgroundColor: 'rgba(242, 201, 76, 0.2)',
  },
  spellBtnUsed: {
    borderColor: PRISM_COLORS.feltBorder,
    opacity: 0.55,
  },
  spellBtnTextWrap: {
    minWidth: 0,
  },
  spellBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  spellBtnSub: {
    fontSize: 11,
    color: PRISM_COLORS.textMuted,
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.gold,
  },
  colorPickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
    marginRight: 4,
  },
  colorChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: PRISM_COLORS.feltSurface,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorChoiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  feltTable: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  cardGrid2Col: {
    maxWidth: 420,
    alignSelf: 'center',
  },
  cardSlot3Col: {
    width: '30.5%',
    minWidth: 92,
  },
  cardSlot2Col: {
    width: '46%',
    minWidth: 120,
  },
  diagnosticCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.danger,
    padding: 12,
    gap: 8,
  },
  diagnosticTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  traitPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  traitPillOk: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: PRISM_COLORS.econGreen,
  },
  traitPillBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: PRISM_COLORS.danger,
  },
  traitPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  traitPillTextOk: {
    color: PRISM_COLORS.econGreen,
  },
  traitPillTextBad: {
    color: '#FCA5A5',
  },
  diagnosticReason: {
    fontSize: 12,
    color: '#FECACA',
  },
  previewScoreCard: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.gold,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  previewHandLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
    textAlign: 'center',
  },
  mathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipsBox: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.chipsBlue,
    alignItems: 'center',
  },
  chipsText: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
  },
  multBox: {
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.multRed,
    alignItems: 'center',
  },
  multText: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  boxSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: PRISM_COLORS.textMuted,
  },
  timesSign: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  totalPreviewText: {
    fontSize: 22,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  totalWinText: {
    fontSize: 24,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: PRISM_COLORS.textPrimary,
  },
  celebrationCard: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PRISM_COLORS.gold,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  celebrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  celebrationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    textAlign: 'center',
  },
  receiptStepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  receiptChip: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  receiptChipRainbow: {
    borderColor: PRISM_COLORS.xMultPurple,
    backgroundColor: 'rgba(192, 132, 252, 0.14)',
  },
  receiptChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
  },
  playBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRISM_COLORS.feltBorder,
    backgroundColor: PRISM_COLORS.feltElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnReady: {
    backgroundColor: PRISM_COLORS.gold,
    borderColor: '#FFF3C4',
  },
  playBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: PRISM_COLORS.feltBg,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRISM_COLORS.gold,
    borderWidth: 2,
    borderColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.feltBg,
    letterSpacing: 0.4,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});

export default PrismTutorial;
