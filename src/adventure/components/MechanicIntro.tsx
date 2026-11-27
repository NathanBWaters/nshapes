/**
 * Lesson card — how the game teaches. Used before a level that introduces a
 * mechanic, for the first-run onboarding, and from the Field Guide.
 *
 * A lesson is a short sequence of steps the player pages through:
 *   story / lesson pages → the mechanic summary → "Is this a Set?" questions
 * Every step has to be accepted (Continue / Yes / No); nothing auto-dismisses.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Card from '@/components/Card';
import Icon, { IconName } from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { MotionModal, useModalMotion } from '@/components/ScreenTransition';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SCALE, SHAKE, SPRING, STAYS, geometricShakeKeyframes, reducedMs } from '@/utils/motion';
import { isValidCombination } from '@/utils/gameUtils';
import { sfx } from '@/audio';
import type { Card as CardType, CharacterName } from '@/types';
import type { DemoCard, LessonPage, MechanicDef, MechanicDemo, QuizQuestion } from '../types';
import { FIGHTERS } from '../data/fighters';
import { companionVoice } from '../coach';
import { LivingBreath } from './CompanionBubble';
import { DARK, INK } from './ui';

const GOLD = COLORS.actionYellow;
const PANEL = DARK.panel;
const STAGE = DARK.stage;
const TEXT = DARK.text;
const MUTED = DARK.muted;

const KIND_LABEL: Record<MechanicDef['kind'], string> = {
  rule: 'New Rule',
  feature: 'New Ability',
  threat: 'New Threat',
  fighter: 'New Fighter',
};

const toCard = (c: DemoCard, i: number): CardType => ({
  id: `demo-${i}`,
  shape: c.shape,
  color: c.color,
  number: c.number,
  shading: c.shading,
  background: c.background,
  selected: false,
  ...(c.modifiers ?? {}),
  fireStartTime: c.modifiers?.onFire ? Date.now() + 10_000_000 : undefined,
});

const CardRow: React.FC<{ cards: DemoCard[]; compact?: boolean }> = ({ cards, compact }) => (
  <View style={st.cardsRow}>
    {cards.map((c, i) => (
      <View key={i} style={[st.cardSlot, compact && st.cardSlotCompact]}>
        <Card card={toCard(c, i)} onClick={() => {}} disabled isPaused />
      </View>
    ))}
  </View>
);

/**
 * A mechanic's picture: three example cards with a verdict, or a row of icons.
 * `light` draws it for a pale background (the level preview); the default is
 * for the dark lesson card.
 */
export const DemoView: React.FC<{ demo: MechanicDemo; light?: boolean; compact?: boolean }> = ({ demo, light, compact }) => {
  if (demo.type === 'icons') {
    return (
      <View style={st.iconsRow}>
        {demo.items.map((it, i) => (
          <View key={i} style={[st.iconItem, compact && { width: 76 }]}>
            <View style={[st.iconCircle, compact && st.iconCircleCompact, light && st.iconCircleLight]}>
              <Icon name={it.icon} size={compact ? 24 : 30} color={it.color ?? INK} />
            </View>
            <Text style={[st.iconLabel, light && { color: INK }]}>{it.label}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: compact ? 8 : 10 }}>
      <CardRow cards={demo.cards} compact={compact} />
      <View style={[st.verdict, light && st.verdictLight, { borderColor: demo.valid ? COLORS.logicTeal : COLORS.impactRed }]}>
        <Text style={[st.verdictMark, { color: demo.valid ? COLORS.logicTeal : COLORS.impactRed }]}>{demo.valid ? '✓' : '✗'}</Text>
        <Text style={[st.verdictText, light && { color: INK }]}>{demo.caption}</Text>
      </View>
    </View>
  );
};

// ─── Steps ──────────────────────────────────────────────────────────────────

type LessonStep =
  | { type: 'page'; eyebrow: string; title: string; tagline?: string; body: string[]; demo?: MechanicDemo; icon?: IconName }
  | { type: 'quiz'; question: QuizQuestion; index: number; total: number };

const stepsForMechanic = (
  m: MechanicDef,
  opts: { quiz?: boolean; prelude?: LessonPage[]; brief?: boolean } = {}
): LessonStep[] => {
  const steps: LessonStep[] = [];
  for (const p of opts.prelude ?? []) steps.push({ type: 'page', eyebrow: 'Adventure', title: p.title, body: p.body, demo: p.demo });
  if (!opts.brief) {
    (m.lessons ?? []).forEach((p, i, all) => steps.push({ type: 'page', eyebrow: `Lesson ${i + 1} of ${all.length}`, title: p.title, body: p.body, demo: p.demo }));
  }
  const summaryBody = opts.brief ? m.body.slice(0, 2) : m.body;
  steps.push({ type: 'page', eyebrow: KIND_LABEL[m.kind], title: m.title, tagline: m.tagline, body: summaryBody, demo: m.demo, icon: m.icon });
  if (opts.quiz !== false && !opts.brief) {
    const qs = m.quiz ?? [];
    qs.forEach((question, index) => steps.push({ type: 'quiz', question, index, total: qs.length }));
  }
  return steps;
};

interface LessonProps {
  steps: LessonStep[] | null;
  speaker?: CharacterName;
  onDone: () => void;
  /** Label of the final button */
  cta?: string;
  /** Allow leaving early (Field Guide). First-time lessons can't be skipped. */
  dismissible?: boolean;
}

const Lesson: React.FC<LessonProps> = ({ steps, speaker = 'Orange Tabby', onDone, cta = 'Got it', dismissible }) => {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const stepDirRef = useRef<1 | -1>(1);
  const lastStepsRef = useRef<LessonStep[] | null>(steps);
  if (steps) lastStepsRef.current = steps;

  const isOpen = Boolean(steps && steps.length > 0);
  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(isOpen, {
    travelY: 28,
  });

  const stepO = useSharedValue(1);
  const stepX = useSharedValue(0);
  const verdictScale = useSharedValue(1);
  const verdictShakeX = useSharedValue(0);

  const activeSteps = steps ?? lastStepsRef.current;
  const key = activeSteps ? activeSteps.length : 0;

  useEffect(() => {
    if (!steps) return;
    stepDirRef.current = 1;
    setI(0);
    setAnswer(null);
  }, [steps]);

  useEffect(() => {
    const dir = stepDirRef.current;
    stepO.value = 0;
    if (reduced) {
      stepX.value = 0;
      stepO.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
    } else {
      stepX.value = dir * 24;
      stepO.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
      stepX.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });
    }
    return () => {
      cancelAnimation(stepO);
      cancelAnimation(stepX);
    };
  }, [i, key, reduced, stepO, stepX]);

  useEffect(() => () => {
    cancelAnimation(verdictScale);
    cancelAnimation(verdictShakeX);
  }, [verdictScale, verdictShakeX]);

  const anim = useAnimatedStyle(() => ({
    opacity: stepO.value,
    transform: [{ translateX: stepX.value }],
  }));

  const verdictAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: verdictShakeX.value }, { scale: verdictScale.value }],
  }));

  const step = activeSteps?.[Math.min(i, Math.max(0, (activeSteps?.length ?? 1) - 1))];
  const correctAnswer = useMemo(
    () => (step?.type === 'quiz' ? isValidCombination(step.question.cards.map(toCard), step.question.attributes).isValid : null),
    [step]
  );

  const last = Boolean(activeSteps && i === activeSteps.length - 1);
  const next = useCallback(() => {
    sfx('click');
    if (last) onDone();
    else {
      stepDirRef.current = 1;
      setAnswer(null);
      setI(cur => cur + 1);
    }
  }, [last, onDone]);

  const back = useCallback(() => {
    sfx('back');
    stepDirRef.current = -1;
    setAnswer(null);
    setI(cur => Math.max(0, cur - 1));
  }, []);

  const skipAll = useCallback(() => {
    sfx('click');
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!steps || !step || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipAll();
      } else if ((e.key === 'Enter' || e.key === ' ') && (step.type === 'page' || answer !== null)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [steps, step, answer, next, skipAll]);

  if (!rendered || !activeSteps || !step) return null;

  const choose = (a: boolean) => {
    const right = a === correctAnswer;
    setAnswer(a);
    sfx(right ? 'match' : 'invalid');
    if (!reduced) {
      if (right) {
        verdictShakeX.value = 0;
        verdictScale.value = 0.92;
        verdictScale.value = withSequence(
          withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.enter }),
          withSpring(1, SPRING.lively)
        );
      } else {
        verdictScale.value = 1;
        const legs = geometricShakeKeyframes(9, 4, SHAKE.decay, -1);
        verdictShakeX.value = withSequence(
          ...legs.map((v, idx) =>
            withTiming(v, {
              duration: idx === 0 ? SHAKE.firstLegMs : idx === legs.length - 1 ? SHAKE.settleMs : SHAKE.legMs,
              easing: EASE.ui,
            })
          )
        );
      }
    }
  };

  return (
    <MotionModal visible={rendered} interactive={!closing} transparent onRequestClose={skipAll}>
      <View style={st.overlay} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.overlayBackdrop, backdropStyle]} />
        <Animated.View testID="lesson-modal" style={[st.panel, panelStyle]}>
          <View style={st.goldRule} />
          <TouchableOpacity
            testID="mechanic-intro-skip"
            onPress={skipAll}
            style={st.skipPill}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={dismissible ? 'Close' : 'Skip lesson'}
          >
            <Text style={st.skipPillText}>{dismissible ? 'Close' : 'Skip'}</Text>
          </TouchableOpacity>
          <Animated.View style={[{ flexShrink: 1 }, contentStyle]}>
            <ScrollView contentContainerStyle={st.scroll} bounces={false}>
              <Animated.View style={[{ gap: 14 }, anim]}>
                {step.type === 'page' ? (
                  <>
                    <Text style={st.eyebrow}>{speaker} · {step.eyebrow}</Text>
                    <View style={st.titleRow}>
                      <LivingBreath seedKey={`lesson-${speaker}`} size={48}>
                        <FighterAvatar character={speaker} size={48} mood="victory" framed animate={false} />
                      </LivingBreath>
                      <View style={{ flex: 1 }}>
                        <Text style={st.title}>{step.title}</Text>
                        {step.tagline && <Text style={st.tagline}>“{companionVoice(speaker).hello} {step.tagline}”</Text>}
                      </View>
                      {step.icon && (
                        <View style={st.titleIcon}>
                          <Icon name={step.icon} size={24} color={INK} />
                        </View>
                      )}
                    </View>
                    {step.demo && <View style={st.stage}><DemoView demo={step.demo} /></View>}
                    <View style={st.speechBox}>
                      {step.body.map((p, k) => <Text key={k} style={st.body}>{p}</Text>)}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={st.eyebrow}>{speaker} · Check {step.index + 1} of {step.total}</Text>
                    <View style={st.titleRow}>
                      <LivingBreath seedKey={`lesson-quiz-${speaker}`} size={44}>
                        <FighterAvatar character={speaker} size={44} mood={answer === null ? 'curious' : answer === correctAnswer ? 'victory' : 'anticipation'} framed animate={false} />
                      </LivingBreath>
                      <View style={{ flex: 1 }}>
                        <Text style={st.title}>Is this a Set?</Text>
                        <Text style={st.tagline}>Each trait: all the same, or all different?</Text>
                      </View>
                    </View>
                    <View style={st.stage}><CardRow cards={step.question.cards} /></View>
                    {answer === null ? (
                      <View style={st.quizBlock}>
                        <View style={st.answers}>
                          <TouchableOpacity testID="quiz-yes" onPress={() => choose(true)} style={[st.answer, { borderColor: COLORS.logicTeal }]} activeOpacity={0.85}>
                            <Text style={[st.answerText, { color: COLORS.logicTeal }]}>✓  YES</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID="quiz-no" onPress={() => choose(false)} style={[st.answer, { borderColor: COLORS.impactRed }]} activeOpacity={0.85}>
                            <Text style={[st.answerText, { color: COLORS.impactRed }]}>✗  NO</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          testID="quiz-skip"
                          onPress={next}
                          style={st.quizSkipBtn}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel="Skip check"
                        >
                          <Text style={st.quizSkipText}>Skip check ›</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Animated.View style={[st.feedback, { borderColor: answer === correctAnswer ? COLORS.logicTeal : COLORS.impactOrange }, verdictAnim]}>
                        <Text style={[st.feedbackTitle, { color: answer === correctAnswer ? COLORS.logicTeal : COLORS.impactOrange }]}>
                          {answer === correctAnswer ? `${companionVoice(speaker).cheer} You got it.` : 'A sneaky one!'} {correctAnswer ? 'Every trait passes.' : 'Two alike and one odd breaks it.'}
                        </Text>
                        <Text style={st.body}>{step.question.explain}</Text>
                      </Animated.View>
                    )}
                  </>
                )}
              </Animated.View>
            </ScrollView>

            <View style={st.footer}>
              <View style={st.dots}>
                {activeSteps.length > 1 && activeSteps.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn, k < i && st.dotDone]} />)}
              </View>
              <View style={st.footerButtons}>
                {i > 0 && (
                  <TouchableOpacity onPress={back} style={st.back} accessibilityLabel="Back">
                    <Text style={st.backText}>Back</Text>
                  </TouchableOpacity>
                )}
                {(step.type === 'page' || answer !== null) && (
                  <TouchableOpacity testID="mechanic-intro-ok" onPress={next} style={st.cta} activeOpacity={0.85}>
                    <Text style={st.ctaText}>{last ? cta : 'Continue'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </MotionModal>
  );
};

/** Convenience wrapper: a lesson for one mechanic. */
const MechanicIntro: React.FC<{
  mechanic: MechanicDef | null;
  fighter?: CharacterName;
  onClose: () => void;
  cta?: string;
  quiz?: boolean;
  brief?: boolean;
  prelude?: LessonPage[];
  dismissible?: boolean;
}> = ({ mechanic, fighter, onClose, cta, quiz, brief, prelude, dismissible }) => {
  const steps = useMemo(
    () => (mechanic ? stepsForMechanic(mechanic, { quiz, brief, prelude }) : null),
    [mechanic, quiz, brief, prelude]
  );
  const featuredFighter = mechanic ? FIGHTERS.find(f => f.signature === mechanic.id)?.name : undefined;
  const speaker = featuredFighter ?? fighter ?? 'Orange Tabby';
  return <Lesson steps={steps} speaker={speaker} onDone={onClose} cta={cta} dismissible={dismissible} />;
};

const st = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
  overlayBackdrop: { backgroundColor: 'rgba(10,10,10,0.82)' },
  panel: { width: '100%', maxWidth: 460, maxHeight: '94%', backgroundColor: PANEL, borderRadius: 16, borderWidth: 1, borderColor: DARK.goldEdge(0.35), overflow: 'hidden' },
  goldRule: { height: 4, backgroundColor: GOLD },
  skipPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(28,27,25,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPillText: { color: TEXT, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  scroll: { padding: 20, paddingTop: 22, paddingBottom: 8 },
  eyebrow: { color: GOLD, fontWeight: '800', letterSpacing: 2.5, fontSize: 11, textTransform: 'uppercase', paddingRight: 64 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 54, height: 54, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.canvasWhite, fontSize: 26, fontWeight: '900', lineHeight: 30 },
  tagline: { color: GOLD, fontSize: 14, fontWeight: '700', marginTop: 2 },
  speechBox: { gap: 8, backgroundColor: 'rgba(255, 251, 235, 0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(253, 224, 71, 0.35)', padding: 12 },
  stage: { backgroundColor: STAGE, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  body: { color: TEXT, fontSize: 16, lineHeight: 23 },
  cardsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cardSlot: { width: 80, height: 107 },
  cardSlotCompact: { width: 62, height: 83 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.25)', maxWidth: 380 },
  verdictLight: { backgroundColor: COLORS.canvasWhite },
  verdictMark: { fontSize: 16, fontWeight: '900' },
  verdictText: { fontSize: 13, fontWeight: '700', color: TEXT, flexShrink: 1 },
  iconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  iconItem: { alignItems: 'center', gap: 6, width: 84 },
  iconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  iconCircleCompact: { width: 48, height: 48, borderRadius: 24 },
  iconCircleLight: { backgroundColor: COLORS.canvasWhite, borderWidth: 2, borderColor: INK },
  iconLabel: { fontSize: 12, fontWeight: '800', color: TEXT, textAlign: 'center' },
  quizBlock: { gap: 8, alignItems: 'stretch' },
  answers: { flexDirection: 'row', gap: 10 },
  answer: { flex: 1, paddingVertical: 16, borderRadius: 10, borderWidth: 2, alignItems: 'center', backgroundColor: STAGE },
  answerText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  quizSkipBtn: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  quizSkipText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  feedback: { borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 6, backgroundColor: STAGE },
  feedbackTitle: { fontSize: 16, fontWeight: '900' },
  footer: { padding: 16, paddingTop: 10, gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotOn: { width: 18, backgroundColor: GOLD },
  dotDone: { backgroundColor: DARK.goldEdge(0.5) },
  footerButtons: { flexDirection: 'row', gap: 10, minHeight: 50 },
  back: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  backText: { color: TEXT, fontWeight: '700' },
  cta: { flex: 1, backgroundColor: GOLD, borderRadius: 8, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
});

export default MechanicIntro;
