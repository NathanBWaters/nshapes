import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { SPRING } from '@/utils/motion';
import { BOSS_BLIND_BY_ID } from '../data/blinds';
import { PATTERN_HAND_BY_ID } from '../data/cards';
import type { PrismRun, ScoreStep, SelectionPreview } from '../types';
import {
  PRISM_COLORS,
  formatMult,
  formatScore,
} from './prismTheme';

export interface PrismScoreBannerProps {
  run: PrismRun;
  preview: SelectionPreview;
  blueprintAssist: boolean;
  compact?: boolean;
  /** True on desktop left rail where stats stack cleanly vertically. */
  vertical?: boolean;
}

const TRAIT_DISPLAY: Record<'color' | 'shape' | 'number', string> = {
  color: 'Color',
  shape: 'Shape',
  number: 'Number',
};

const formatStepDelta = (step: ScoreStep): string => {
  const parts: string[] = [];
  if (step.chipsDelta > 0) parts.push(`+${formatScore(step.chipsDelta)}C`);
  if (step.multDelta > 0) parts.push(`+${formatMult(step.multDelta)}M`);
  if (step.multDelta < 0) parts.push(`${formatMult(step.multDelta)}M`);
  if (step.xMult !== undefined && step.xMult !== 1) parts.push(`×${formatMult(step.xMult)}`);
  if (step.goldDelta && step.goldDelta > 0) parts.push(`+$${step.goldDelta}`);
  if (step.goldDelta && step.goldDelta < 0) parts.push(`-$${Math.abs(step.goldDelta)}`);
  if (step.debuffed && parts.length === 0) return 'Debuffed';
  return parts.join(' ');
};

const getStepAccent = (step: ScoreStep): string => {
  if (step.debuffed) return PRISM_COLORS.danger;
  if (step.kind === 'synergy') return PRISM_COLORS.gold;
  if (step.xMult && step.xMult > 1) return PRISM_COLORS.xMultPurple;
  if (step.multDelta > 0) return PRISM_COLORS.multRed;
  if (step.goldDelta && step.goldDelta > 0) return PRISM_COLORS.econGreen;
  return PRISM_COLORS.chipsBlue;
};

const PrismScoreBanner: React.FC<PrismScoreBannerProps> = ({
  run,
  preview,
  blueprintAssist,
  compact = false,
  vertical = false,
}) => {
  const currentOffer = run.anteBlinds[run.blindIndex];
  const bossDef = run.activeBossId ? BOSS_BLIND_BY_ID[run.activeBossId] : null;
  const lastResult = run.lastScoreBreakdown;

  // Non-blocking animated step-by-step score ignition pop when a new Set lands
  const [revealCount, setRevealCount] = useState<number>(0);
  const [showIgnition, setShowIgnition] = useState<boolean>(false);
  const lastSetsPlayedRef = useRef<number>(run.stats.setsPlayed);

  const igniteScale = useSharedValue(1);
  const handsPopScale = useSharedValue(1);
  const hitBadgeScale = useSharedValue(1);

  useEffect(() => {
    if (run.stats.setsPlayed > lastSetsPlayedRef.current && lastResult) {
      lastSetsPlayedRef.current = run.stats.setsPlayed;
      setShowIgnition(true);

      igniteScale.value = withSequence(
        withSpring(1.06, SPRING.playful),
        withSpring(1, SPRING.snappy)
      );
      handsPopScale.value = withSequence(
        withSpring(1.22, SPRING.playful),
        withSpring(1, SPRING.snappy)
      );
      hitBadgeScale.value = withSequence(
        withSpring(1.24, SPRING.playful),
        withSpring(1, SPRING.snappy)
      );

      const totalSteps = lastResult.steps.length;
      const timers: ReturnType<typeof setTimeout>[] = [];
      setRevealCount(1);

      const stepGapMs = totalSteps > 6 ? 95 : 130;
      for (let i = 2; i <= totalSteps + 1; i++) {
        timers.push(
          setTimeout(() => {
            setRevealCount(i);
          }, (i - 1) * stepGapMs)
        );
      }

      return () => {
        timers.forEach(clearTimeout);
      };
    }

    lastSetsPlayedRef.current = run.stats.setsPlayed;
    if (!lastResult) {
      setShowIgnition(false);
      setRevealCount(0);
    }
    return undefined;
  }, [run.stats.setsPlayed, lastResult, igniteScale, handsPopScale, hitBadgeScale]);

  const igniteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: igniteScale.value }],
  }));

  const handsPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: handsPopScale.value }],
  }));

  const hitBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hitBadgeScale.value }],
  }));

  const target = Math.max(1, run.blindTarget);
  const currentRatio = Math.min(1, Math.max(0, run.blindScore / target));
  const previewRatio = preview.isValidSet
    ? Math.min(1, Math.max(currentRatio, (run.blindScore + preview.estimatedTotal) / target))
    : currentRatio;

  const blindLabel = bossDef ? bossDef.name : (currentOffer?.name ?? 'Small Blind');
  const patternDef = preview.patternHand ? PATTERN_HAND_BY_ID[preview.patternHand] : null;

  // Decide which score equation mode to display inside the Balatro [CHIPS] x [MULT] box
  const showingValidPreview = preview.isValidSet;
  const showingInvalidDiag = preview.selectedCount === 3 && !preview.isValidSet;
  const showingBlueprint = preview.selectedCount === 2 && blueprintAssist && Boolean(preview.blueprintNeed);
  const showingReceipt =
    !showingValidPreview &&
    !showingInvalidDiag &&
    !showingBlueprint &&
    showIgnition &&
    Boolean(lastResult);

  const displayedChips = showingValidPreview
    ? preview.estimatedChips
    : showingReceipt && lastResult
      ? lastResult.finalChips
      : 0;
  const displayedMult = showingValidPreview
    ? preview.estimatedMult
    : showingReceipt && lastResult
      ? lastResult.finalMult
      : 0;
  const displayedTotal = showingValidPreview
    ? preview.estimatedTotal
    : showingReceipt && lastResult
      ? lastResult.finalScore
      : 0;

  if (compact) {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        {/* Compact Row 1: Ante + Blind + Score / Target (zero duplicate gold pill) */}
        <View style={styles.compactTopRow}>
          <View style={styles.anteBadgeCompact}>
            <Text style={styles.anteBadgeText}>
              A{run.ante}
              {run.isEndless ? '∞' : ''}
            </Text>
          </View>
          <View style={styles.blindTitleWrap}>
            {bossDef && <Icon name={bossDef.icon} size={13} color={PRISM_COLORS.gold} noShadow />}
            <Text style={styles.blindTitleCompact} numberOfLines={1} ellipsizeMode="tail">
              {blindLabel}
            </Text>
          </View>
          {preview.isValidSet && preview.wouldClearBlind ? (
            <View testID="prism-clears-blind-badge" style={styles.clearsBadgeCompact}>
              <Icon name="lorc/trophy" size={11} color="#121212" noShadow />
              <Text style={styles.clearsBadgeText}>CLEARS!</Text>
            </View>
          ) : (
            <View style={styles.compactScoreRight}>
              {showIgnition && lastResult && run.handsPlayedThisBlind > 0 && (
                <Animated.View testID="prism-last-hit-badge" style={[styles.lastHitBadgeCompact, hitBadgeStyle]}>
                  <Text style={styles.lastHitBadgeText}>+{formatScore(lastResult.finalScore)}</Text>
                </Animated.View>
              )}
              <Text style={styles.compactScoreInline}>
                {formatScore(run.blindScore)}
                <Text style={styles.compactScoreTarget}> / {formatScore(run.blindTarget)}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Compact Progress Bar */}
        <View testID="prism-score-bar" style={styles.progressTrackCompact}>
          {previewRatio > currentRatio && (
            <View
              style={[
                styles.progressPreviewFill,
                { width: `${Math.round(previewRatio * 100)}%` },
              ]}
            />
          )}
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(currentRatio * 100)}%`,
                backgroundColor:
                  currentRatio >= 1 ? PRISM_COLORS.econGreen : PRISM_COLORS.gold,
              },
            ]}
          />
        </View>

        {/* Boss Blind Rule Banner (1 compact line when active) */}
        {bossDef && (
          <View testID="prism-boss-rule" style={styles.bossRuleBannerCompact}>
            <Icon name={bossDef.icon} size={12} color="#FDA4AF" noShadow />
            <Text style={styles.bossRuleText} numberOfLines={1}>
              <Text style={styles.bossRuleLead}>BOSS: </Text>
              {bossDef.shortRule}
            </Text>
          </View>
        )}

        {/* Sleek 1-line Equation / Diagnostic / Blueprint / Receipt Box */}
        <Animated.View
          style={[
            styles.equationBoxCompact,
            showingValidPreview && styles.equationBoxArmed,
            showingValidPreview && preview.wouldClearBlind && styles.equationBoxClear,
            showingInvalidDiag && styles.equationBoxInvalid,
            igniteStyle,
          ]}
        >
          {showingInvalidDiag ? (
            <View testID="prism-invalid-diagnostic" style={styles.diagBlockCompact}>
              <View style={styles.diagPillRow}>
                {preview.traitChecks.map(tc => {
                  const ok = tc.status !== 'mismatch';
                  return (
                    <View
                      key={tc.trait}
                      style={[styles.diagPillCompact, ok ? styles.diagPillOk : styles.diagPillBad]}
                    >
                      <Text style={[styles.diagPillText, ok ? styles.diagTextOk : styles.diagTextBad]}>
                        {TRAIT_DISPLAY[tc.trait]} {ok ? '✓' : '✗'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {preview.mismatchReason && (
                <Text style={styles.diagReason} numberOfLines={1}>
                  {preview.mismatchReason}
                </Text>
              )}
            </View>
          ) : showingBlueprint && preview.blueprintNeed ? (
            <View testID="prism-blueprint-pill" style={styles.blueprintRowCompact}>
              <Icon name="lorc/light-bulb" size={14} color={PRISM_COLORS.gold} noShadow />
              <Text style={styles.blueprintTitleCompact} numberOfLines={1}>
                Need: {preview.blueprintNeed.summary} (
                {preview.blueprintNeed.matchingBoardIndices.length > 0
                  ? `${preview.blueprintNeed.matchingBoardIndices.length} on board`
                  : 'none on board'}
                )
              </Text>
            </View>
          ) : (
            <View style={styles.compactEqWrap}>
              {showingValidPreview && (
                <View style={styles.compactHandRow}>
                  <View
                    style={[
                      styles.handNamePillCompact,
                      { backgroundColor: patternDef?.accentColor ?? PRISM_COLORS.xMultPurple },
                    ]}
                  >
                    <Text style={styles.handNameTextCompact} numberOfLines={1}>
                      {preview.patternHandName}
                    </Text>
                  </View>
                  <View style={styles.levelBadgeCompact}>
                    <Text style={styles.levelBadgeText}>Lv.{preview.patternHandLevel}</Text>
                  </View>
                  {preview.estimatedGold !== 0 && (
                    <Text style={styles.goldDeltaInline}>
                      {preview.estimatedGold > 0
                        ? `+$${preview.estimatedGold}`
                        : `-$${Math.abs(preview.estimatedGold)}`}
                    </Text>
                  )}
                  {preview.shatterRiskCardIds.length > 0 && (
                    <Text style={styles.shatterRiskInline}>Glass!</Text>
                  )}
                </View>
              )}

              {showingReceipt && lastResult && (
                <View testID="prism-score-receipt" style={styles.compactReceiptRow}>
                  <View style={[styles.handNamePillCompact, { backgroundColor: PRISM_COLORS.goldDark }]}>
                    <Text style={styles.handNameTextCompact} numberOfLines={1}>
                      {lastResult.patternHandName}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.receiptStepsRow}
                  >
                    {lastResult.steps.slice(0, Math.max(1, revealCount)).map((step, idx) => {
                      const delta = formatStepDelta(step);
                      const accent = getStepAccent(step);
                      return (
                        <View key={`${step.kind}-${idx}`} style={[styles.stepChipCompact, { borderColor: accent }]}>
                          <Text style={styles.stepLabelCompact} numberOfLines={1}>
                            {step.label}
                          </Text>
                          {delta.length > 0 && (
                            <Text style={[styles.stepDeltaCompact, { color: accent }]}>{delta}</Text>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.compactMathRow}>
                <View style={styles.chipsPillCompact}>
                  <Text style={styles.chipsValueCompact} numberOfLines={1}>
                    {formatScore(displayedChips)}
                  </Text>
                </View>
                <Text style={styles.timesGlyphCompact}>×</Text>
                <View style={styles.multPillCompact}>
                  <Text style={styles.multValueCompact} numberOfLines={1}>
                    {formatMult(displayedMult)}
                  </Text>
                </View>
                <Text style={styles.equalsGlyphCompact}>=</Text>
                <View style={styles.totalPillCompact}>
                  <Text
                    style={[
                      styles.totalValueCompact,
                      showingValidPreview && preview.wouldClearBlind && styles.totalValueClear,
                    ]}
                    numberOfLines={1}
                  >
                    {formatScore(displayedTotal)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Single Combined Compact Hands · Discards · Gold Strip */}
        <View style={styles.compactStatsBar}>
          <Animated.View
            style={[
              styles.compactStatItem,
              run.handsLeft <= 1 && styles.compactStatUrgent,
              handsPopStyle,
            ]}
          >
            <Text style={styles.compactStatLabel}>HANDS</Text>
            <Text
              testID="prism-hands-left"
              style={[
                styles.compactStatValue,
                { color: run.handsLeft <= 1 ? PRISM_COLORS.danger : PRISM_COLORS.chipsBlue },
              ]}
            >
              {run.handsLeft}
            </Text>
          </Animated.View>

          <View style={styles.compactStatItem}>
            <Text style={styles.compactStatLabel}>DISCARDS</Text>
            <Text
              testID="prism-discards-left"
              style={[
                styles.compactStatValue,
                { color: run.discardsLeft > 0 ? PRISM_COLORS.multRed : PRISM_COLORS.textMuted },
              ]}
            >
              {run.discardsLeft}
            </Text>
          </View>

          <View style={styles.compactStatItem}>
            <Text style={styles.compactStatLabel}>GOLD</Text>
            <Text testID="prism-gold-value" style={[styles.compactStatValue, { color: PRISM_COLORS.gold }]}>
              ${run.gold}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Blind Header Row */}
      <View style={styles.blindHeader}>
        <View style={styles.anteBadge}>
          <Text style={styles.anteBadgeText}>
            ANTE {run.ante}
            {run.isEndless ? ' ∞' : ''}
          </Text>
        </View>

        <View style={styles.blindTitleWrap}>
          {bossDef && <Icon name={bossDef.icon} size={16} color={PRISM_COLORS.gold} noShadow />}
          <Text style={styles.blindTitle} numberOfLines={1} ellipsizeMode="tail">
            {blindLabel}
          </Text>
        </View>
      </View>

      {/* Boss Blind Rule Banner */}
      {bossDef && (
        <View testID="prism-boss-rule" style={styles.bossRuleBanner}>
          <Icon name={bossDef.icon} size={14} color="#FDA4AF" noShadow />
          <Text style={styles.bossRuleText} numberOfLines={vertical ? 3 : 1}>
            <Text style={styles.bossRuleLead}>BOSS RULE: </Text>
            {vertical ? bossDef.description : bossDef.shortRule}
          </Text>
        </View>
      )}

      {/* Score vs Target Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.scoreNumbersRow}>
          <View style={styles.scoreLabelGroup}>
            <Text style={styles.scoreCaption}>BLIND SCORE</Text>
            <Text style={styles.scoreValue}>
              {formatScore(run.blindScore)}
              <Text style={styles.scoreTarget}> / {formatScore(run.blindTarget)}</Text>
            </Text>
          </View>

          {preview.isValidSet && preview.wouldClearBlind ? (
            <View testID="prism-clears-blind-badge" style={styles.clearsBadge}>
              <Icon name="lorc/trophy" size={12} color="#121212" noShadow />
              <Text style={styles.clearsBadgeText}>CLEARS BLIND!</Text>
            </View>
          ) : (
            <View style={styles.desktopScoreRight}>
              {showIgnition && lastResult && run.handsPlayedThisBlind > 0 && (
                <Animated.View testID="prism-last-hit-badge" style={[styles.lastHitBadge, hitBadgeStyle]}>
                  <Text style={styles.lastHitBadgeText}>+{formatScore(lastResult.finalScore)}</Text>
                </Animated.View>
              )}
              <Text style={styles.remainingText}>
                {run.blindScore >= run.blindTarget
                  ? 'Cleared!'
                  : `${formatScore(Math.max(0, run.blindTarget - run.blindScore))} left`}
              </Text>
            </View>
          )}
        </View>

        <View testID="prism-score-bar" style={styles.progressTrack}>
          {previewRatio > currentRatio && (
            <View
              style={[
                styles.progressPreviewFill,
                { width: `${Math.round(previewRatio * 100)}%` },
              ]}
            />
          )}
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(currentRatio * 100)}%`,
                backgroundColor:
                  currentRatio >= 1 ? PRISM_COLORS.econGreen : PRISM_COLORS.gold,
              },
            ]}
          />
        </View>
      </View>

      {/* Iconic Balatro [CHIPS] × [MULT] Scoreboard Box */}
      <Animated.View
        style={[
          styles.equationBox,
          showingValidPreview && styles.equationBoxArmed,
          showingValidPreview && preview.wouldClearBlind && styles.equationBoxClear,
          showingInvalidDiag && styles.equationBoxInvalid,
          igniteStyle,
        ]}
      >
        {/* Top line: Pattern Hand / Blueprint / Invalid Diagnostic / Ready */}
        {showingValidPreview && (
          <View style={styles.handBannerRow}>
            <View
              style={[
                styles.handNamePill,
                { backgroundColor: patternDef?.accentColor ?? PRISM_COLORS.xMultPurple },
              ]}
            >
              <Text style={styles.handNameText} numberOfLines={1}>
                {preview.patternHandName}
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Lv.{preview.patternHandLevel}</Text>
            </View>
            {preview.estimatedGold !== 0 && (
              <View style={styles.goldDeltaPill}>
                <Text style={styles.goldDeltaText}>
                  {preview.estimatedGold > 0
                    ? `+$${preview.estimatedGold}`
                    : `-$${Math.abs(preview.estimatedGold)}`}
                </Text>
              </View>
            )}
            {preview.shatterRiskCardIds.length > 0 && (
              <View style={styles.shatterRiskPill}>
                <Icon name="lorc/shattered-glass" size={11} color="#67E8F9" noShadow />
                <Text style={styles.shatterRiskText}>Glass Risk</Text>
              </View>
            )}
          </View>
        )}

        {showingInvalidDiag && (
          <View testID="prism-invalid-diagnostic" style={styles.diagBlock}>
            <View style={styles.diagPillRow}>
              {preview.traitChecks.map(tc => {
                const ok = tc.status !== 'mismatch';
                return (
                  <View
                    key={tc.trait}
                    style={[styles.diagPill, ok ? styles.diagPillOk : styles.diagPillBad]}
                  >
                    <Text style={[styles.diagPillText, ok ? styles.diagTextOk : styles.diagTextBad]}>
                      {TRAIT_DISPLAY[tc.trait]} {ok ? '✓' : '✗'}
                    </Text>
                  </View>
                );
              })}
            </View>
            {preview.mismatchReason && (
              <Text style={styles.diagReason} numberOfLines={2}>
                {preview.mismatchReason}
              </Text>
            )}
          </View>
        )}

        {showingBlueprint && preview.blueprintNeed && (
          <View testID="prism-blueprint-pill" style={styles.blueprintBanner}>
            <Icon name="lorc/light-bulb" size={15} color={PRISM_COLORS.gold} noShadow />
            <View style={styles.blueprintCopy}>
              <Text style={styles.blueprintTitle} numberOfLines={2}>
                Blueprint Need: {preview.blueprintNeed.summary}
              </Text>
              <Text style={styles.blueprintSub}>
                {preview.blueprintNeed.matchingBoardIndices.length > 0
                  ? `${preview.blueprintNeed.matchingBoardIndices.length} match${preview.blueprintNeed.matchingBoardIndices.length === 1 ? '' : 'es'} glowing on board`
                  : 'Not on board — Discard or cast a Spell'}
              </Text>
            </View>
          </View>
        )}

        {showingReceipt && lastResult && (
          <View testID="prism-score-receipt" style={styles.receiptBlock}>
            <View style={styles.handBannerRow}>
              <View style={[styles.handNamePill, { backgroundColor: PRISM_COLORS.goldDark }]}>
                <Text style={styles.handNameText} numberOfLines={1}>
                  LAST: {lastResult.patternHandName}
                </Text>
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Lv.{lastResult.patternHandLevel}</Text>
              </View>
              <Text style={styles.receiptTotalTag}>+{formatScore(lastResult.finalScore)}!</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.receiptStepsRow}
            >
              {lastResult.steps.slice(0, Math.max(1, revealCount)).map((step, idx) => {
                const delta = formatStepDelta(step);
                const accent = getStepAccent(step);
                return (
                  <View key={`${step.kind}-${idx}`} style={[styles.stepChip, { borderColor: accent }]}>
                    <Text style={styles.stepLabel} numberOfLines={1}>
                      {step.label}
                    </Text>
                    {delta.length > 0 && (
                      <Text style={[styles.stepDelta, { color: accent }]}>{delta}</Text>
                    )}
                  </View>
                );
              })}
              {revealCount > lastResult.steps.length && (
                <View style={styles.stepTotalChip}>
                  <Text style={styles.stepTotalText}>
                    TOTAL {formatScore(lastResult.finalScore)}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* [CHIPS] × [MULT] = TOTAL core Balatro readout */}
        {!showingInvalidDiag && !showingBlueprint && (
          <View style={styles.mathRow}>
            <View style={styles.chipsBox}>
              <Text style={styles.mathMicroLabel}>CHIPS</Text>
              <Text
                style={styles.chipsValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatScore(displayedChips)}
              </Text>
            </View>

            <Text style={styles.timesGlyph}>×</Text>

            <View style={styles.multBox}>
              <Text style={styles.mathMicroLabel}>MULT</Text>
              <Text
                style={styles.multValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatMult(displayedMult)}
              </Text>
            </View>

            <Text style={styles.equalsGlyph}>=</Text>

            <View style={styles.totalBox}>
              <Text style={styles.mathMicroLabel}>
                {showingValidPreview ? 'EST.' : showingReceipt ? 'SCORED' : 'READY'}
              </Text>
              <Text
                style={[
                  styles.totalValue,
                  showingValidPreview && preview.wouldClearBlind && styles.totalValueClear,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatScore(displayedTotal)}
              </Text>
            </View>
          </View>
        )}

        {!showingValidPreview && !showingInvalidDiag && !showingBlueprint && !showingReceipt && (
          <Text style={styles.idlePrompt}>
            {preview.selectedCount === 0
              ? 'Pick 3 cards where Color, Shape & Number are each all-same or all-different'
              : preview.selectedCount === 1
                ? '1/3 selected — pick 2 more cards to complete a Set'
                : '2/3 selected — pick 1 more card (turn on Blueprint for live hint)'}
          </Text>
        )}
      </Animated.View>

      {/* Hands / Discards / Gold Counter Strip */}
      <View style={styles.statsRow}>
        <Animated.View
          style={[
            styles.statWell,
            run.handsLeft <= 1 && styles.statWellUrgent,
            handsPopStyle,
          ]}
        >
          <Text style={styles.statLabel}>HANDS</Text>
          <Text
            testID="prism-hands-left"
            style={[
              styles.statValue,
              { color: run.handsLeft <= 1 ? PRISM_COLORS.danger : PRISM_COLORS.chipsBlue },
            ]}
          >
            {run.handsLeft}
          </Text>
        </Animated.View>

        <View style={styles.statWell}>
          <Text style={styles.statLabel}>DISCARDS</Text>
          <Text
            testID="prism-discards-left"
            style={[
              styles.statValue,
              { color: run.discardsLeft > 0 ? PRISM_COLORS.multRed : PRISM_COLORS.textMuted },
            ]}
          >
            {run.discardsLeft}
          </Text>
        </View>

        <View style={styles.statWell}>
          <Text style={styles.statLabel}>GOLD</Text>
          <Text testID="prism-gold-value" style={[styles.statValue, { color: PRISM_COLORS.gold }]}>
            ${run.gold}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 12,
    gap: 10,
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
    borderRadius: 11,
  },
  compactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anteBadgeCompact: {
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  blindTitleCompact: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  compactScoreInline: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  compactScoreTarget: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  clearsBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  progressTrackCompact: {
    height: 6,
    borderRadius: 999,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  bossRuleBannerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PRISM_COLORS.bossBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.bossBorder,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  equationBoxCompact: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  compactEqWrap: {
    gap: 4,
  },
  compactHandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  handNamePillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    maxWidth: '62%',
  },
  handNameTextCompact: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  levelBadgeCompact: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  goldDeltaInline: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.econGreen,
  },
  shatterRiskInline: {
    fontSize: 11,
    fontWeight: '800',
    color: '#67E8F9',
  },
  compactReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    maxWidth: 150,
  },
  stepLabelCompact: {
    fontSize: 10,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  stepDeltaCompact: {
    fontSize: 10,
    fontWeight: '900',
  },
  compactMathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  chipsPillCompact: {
    flex: 1,
    backgroundColor: PRISM_COLORS.chipsBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.chipsBlue,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  multPillCompact: {
    flex: 1,
    backgroundColor: PRISM_COLORS.multBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.multRed,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  totalPillCompact: {
    flex: 1.15,
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  chipsValueCompact: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
  },
  multValueCompact: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  totalValueCompact: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  timesGlyphCompact: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  equalsGlyphCompact: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  diagBlockCompact: {
    gap: 3,
  },
  diagPillCompact: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  blueprintRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  blueprintTitleCompact: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.brassLight,
  },
  compactStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  compactStatUrgent: {
    borderColor: PRISM_COLORS.danger,
    backgroundColor: '#2C1219',
  },
  compactStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.4,
  },
  compactStatValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  blindHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anteBadge: {
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  anteBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.6,
  },
  blindTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  blindTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  bossRuleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRISM_COLORS.bossBg,
    borderWidth: 1,
    borderColor: PRISM_COLORS.bossBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  bossRuleText: {
    flex: 1,
    fontSize: 11,
    color: '#FFE4E6',
    lineHeight: 15,
  },
  bossRuleLead: {
    fontWeight: '900',
    color: '#FDA4AF',
  },
  progressSection: {
    gap: 5,
  },
  scoreNumbersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreLabelGroup: {
    flex: 1,
  },
  scoreCaption: {
    fontSize: 10,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.9,
  },
  scoreValue: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  scoreTarget: {
    fontSize: 13,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  clearsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  clearsBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  progressPreviewFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(242, 201, 76, 0.35)',
    borderRadius: 999,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  equationBox: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 9,
    gap: 7,
  },
  equationBoxArmed: {
    borderColor: PRISM_COLORS.chipsBlue,
    backgroundColor: '#0A2229',
  },
  equationBoxClear: {
    borderColor: PRISM_COLORS.gold,
    backgroundColor: '#1B2816',
  },
  equationBoxInvalid: {
    borderColor: PRISM_COLORS.danger,
    backgroundColor: '#2B1218',
  },
  handBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  handNamePill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    maxWidth: '68%',
  },
  handNameText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  levelBadge: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  goldDeltaPill: {
    backgroundColor: PRISM_COLORS.econBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  goldDeltaText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.econGreen,
  },
  shatterRiskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shatterRiskText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#67E8F9',
  },
  mathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  chipsBox: {
    flex: 1,
    backgroundColor: PRISM_COLORS.chipsBg,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.chipsBlue,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  multBox: {
    flex: 1,
    backgroundColor: PRISM_COLORS.multBg,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.multRed,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  totalBox: {
    flex: 1.15,
    backgroundColor: 'rgba(242, 201, 76, 0.12)',
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  mathMicroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.7,
  },
  chipsValue: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.chipsBlue,
  },
  multValue: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  totalValueClear: {
    color: PRISM_COLORS.brassLight,
  },
  timesGlyph: {
    fontSize: 18,
    fontWeight: '900',
    color: PRISM_COLORS.multRed,
  },
  equalsGlyph: {
    fontSize: 16,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  diagBlock: {
    gap: 6,
  },
  diagPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagPill: {
    flex: 1,
    borderRadius: 7,
    borderWidth: 1.5,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  diagPillOk: {
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderColor: PRISM_COLORS.econGreen,
  },
  diagPillBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: PRISM_COLORS.danger,
  },
  diagPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  diagTextOk: {
    color: PRISM_COLORS.econGreen,
  },
  diagTextBad: {
    color: '#FCA5A5',
  },
  diagReason: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FECDD3',
    textAlign: 'center',
  },
  blueprintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  blueprintCopy: {
    flex: 1,
    gap: 2,
  },
  blueprintTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.brassLight,
  },
  blueprintSub: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
  },
  receiptBlock: {
    gap: 6,
  },
  receiptTotalTag: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    marginLeft: 'auto',
  },
  receiptStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 1,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRISM_COLORS.feltSurface,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 190,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  stepDelta: {
    fontSize: 11,
    fontWeight: '900',
  },
  stepTotalChip: {
    backgroundColor: PRISM_COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepTotalText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#121212',
  },
  idlePrompt: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  statWell: {
    flex: 1,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statWellUrgent: {
    borderColor: PRISM_COLORS.danger,
    backgroundColor: '#2C1219',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  compactScoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desktopScoreRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  lastHitBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PRISM_COLORS.econGreen,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  lastHitBadgeCompact: {
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: PRISM_COLORS.econGreen,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lastHitBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.econGreen,
    fontVariant: ['tabular-nums'],
  },
});

export default PrismScoreBanner;
