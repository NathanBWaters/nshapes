/**
 * Lesson card — how the game teaches. Used before a level that introduces a
 * mechanic, for the first-run onboarding, and from the Field Guide.
 *
 * A lesson is a short sequence of steps the player pages through:
 *   story / lesson pages → the mechanic summary → "Is this a Set?" questions
 * Every step has to be accepted (Continue / Yes / No); nothing auto-dismisses.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Card from '@/components/Card';
import Icon, { IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { isValidCombination } from '@/utils/gameUtils';
import { sfx } from '@/audio';
import type { Card as CardType } from '@/types';
import type { DemoCard, LessonPage, MechanicDef, MechanicDemo, QuizQuestion } from '../types';
import { INK } from './ui';

const GOLD = COLORS.actionYellow;
const PANEL = '#1C1B19';
const STAGE = '#2A2826';
const TEXT = '#F1ECE4';
const MUTED = '#B9B1A5';

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

const CardRow: React.FC<{ cards: DemoCard[] }> = ({ cards }) => (
  <View style={st.cardsRow}>
    {cards.map((c, i) => (
      <View key={i} style={st.cardSlot}>
        <Card card={toCard(c, i)} onClick={() => {}} disabled isPaused />
      </View>
    ))}
  </View>
);

const DemoView: React.FC<{ demo: MechanicDemo }> = ({ demo }) => {
  if (demo.type === 'icons') {
    return (
      <View style={st.iconsRow}>
        {demo.items.map((it, i) => (
          <View key={i} style={st.iconItem}>
            <View style={st.iconCircle}>
              <Icon name={it.icon} size={30} color={it.color ?? INK} />
            </View>
            <Text style={st.iconLabel}>{it.label}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <CardRow cards={demo.cards} />
      <View style={[st.verdict, { borderColor: demo.valid ? COLORS.logicTeal : COLORS.impactRed }]}>
        <Text style={[st.verdictMark, { color: demo.valid ? COLORS.logicTeal : COLORS.impactRed }]}>{demo.valid ? '✓' : '✗'}</Text>
        <Text style={st.verdictText}>{demo.caption}</Text>
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
  opts: { quiz?: boolean; prelude?: LessonPage[] } = {}
): LessonStep[] => {
  const steps: LessonStep[] = [];
  for (const p of opts.prelude ?? []) steps.push({ type: 'page', eyebrow: 'Adventure', title: p.title, body: p.body, demo: p.demo });
  (m.lessons ?? []).forEach((p, i, all) => steps.push({ type: 'page', eyebrow: `Lesson ${i + 1} of ${all.length}`, title: p.title, body: p.body, demo: p.demo }));
  steps.push({ type: 'page', eyebrow: KIND_LABEL[m.kind], title: m.title, tagline: m.tagline, body: m.body, demo: m.demo, icon: m.icon });
  if (opts.quiz !== false) {
    const qs = m.quiz ?? [];
    qs.forEach((question, index) => steps.push({ type: 'quiz', question, index, total: qs.length }));
  }
  return steps;
};

interface LessonProps {
  steps: LessonStep[] | null;
  onDone: () => void;
  /** Label of the final button */
  cta?: string;
  /** Allow leaving early (Field Guide). First-time lessons can't be skipped. */
  dismissible?: boolean;
}

const Lesson: React.FC<LessonProps> = ({ steps, onDone, cta = 'Got it', dismissible }) => {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const fade = useSharedValue(0);
  const key = steps ? steps.length : 0;

  useEffect(() => {
    setI(0);
    setAnswer(null);
  }, [steps]);

  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [i, key, fade]);

  const anim = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: (1 - fade.value) * 8 }] }));

  const step = steps?.[i];
  const correctAnswer = useMemo(
    () => (step?.type === 'quiz' ? isValidCombination(step.question.cards.map(toCard), step.question.attributes).isValid : null),
    [step]
  );
  if (!steps || !step) return null;

  const last = i === steps.length - 1;
  const next = () => {
    sfx('click');
    if (last) onDone();
    else {
      setAnswer(null);
      setI(i + 1);
    }
  };
  const choose = (a: boolean) => {
    setAnswer(a);
    sfx(a === correctAnswer ? 'match' : 'invalid');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissible ? onDone : undefined}>
      <View style={st.overlay}>
        <View testID="lesson-modal" style={st.panel}>
          <View style={st.goldRule} />
          {dismissible && (
            <TouchableOpacity onPress={onDone} style={st.close} accessibilityLabel="Close">
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          )}
          <ScrollView contentContainerStyle={st.scroll} bounces={false}>
            <Animated.View style={[{ gap: 14 }, anim]}>
              {step.type === 'page' ? (
                <>
                  <Text style={st.eyebrow}>{step.eyebrow}</Text>
                  <View style={st.titleRow}>
                    {step.icon && (
                      <View style={st.titleIcon}>
                        <Icon name={step.icon} size={30} color={INK} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={st.title}>{step.title}</Text>
                      {step.tagline && <Text style={st.tagline}>{step.tagline}</Text>}
                    </View>
                  </View>
                  {step.demo && <View style={st.stage}><DemoView demo={step.demo} /></View>}
                  <View style={{ gap: 8 }}>
                    {step.body.map((p, k) => <Text key={k} style={st.body}>{p}</Text>)}
                  </View>
                </>
              ) : (
                <>
                  <Text style={st.eyebrow}>Check {step.index + 1} of {step.total}</Text>
                  <Text style={st.title}>Is this a Set?</Text>
                  <View style={st.stage}><CardRow cards={step.question.cards} /></View>
                  {answer === null ? (
                    <View style={st.answers}>
                      <TouchableOpacity testID="quiz-yes" onPress={() => choose(true)} style={[st.answer, { borderColor: COLORS.logicTeal }]} activeOpacity={0.85}>
                        <Text style={[st.answerText, { color: COLORS.logicTeal }]}>✓  YES</Text>
                      </TouchableOpacity>
                      <TouchableOpacity testID="quiz-no" onPress={() => choose(false)} style={[st.answer, { borderColor: COLORS.impactRed }]} activeOpacity={0.85}>
                        <Text style={[st.answerText, { color: COLORS.impactRed }]}>✗  NO</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[st.feedback, { borderColor: answer === correctAnswer ? COLORS.logicTeal : COLORS.impactOrange }]}>
                      <Text style={[st.feedbackTitle, { color: answer === correctAnswer ? COLORS.logicTeal : COLORS.impactOrange }]}>
                        {answer === correctAnswer ? 'Correct!' : 'Not quite.'} {correctAnswer ? 'It is a Set.' : 'It is not a Set.'}
                      </Text>
                      <Text style={st.body}>{step.question.explain}</Text>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </ScrollView>

          <View style={st.footer}>
            <View style={st.dots}>
              {steps.length > 1 && steps.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn, k < i && st.dotDone]} />)}
            </View>
            <View style={st.footerButtons}>
              {i > 0 && (
                <TouchableOpacity onPress={() => { setAnswer(null); setI(i - 1); }} style={st.back} accessibilityLabel="Back">
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
        </View>
      </View>
    </Modal>
  );
};

/** Convenience wrapper: a lesson for one mechanic. */
const MechanicIntro: React.FC<{
  mechanic: MechanicDef | null;
  onClose: () => void;
  cta?: string;
  quiz?: boolean;
  prelude?: LessonPage[];
  dismissible?: boolean;
}> = ({ mechanic, onClose, cta, quiz, prelude, dismissible }) => {
  const steps = useMemo(
    () => (mechanic ? stepsForMechanic(mechanic, { quiz, prelude }) : null),
    [mechanic, quiz, prelude]
  );
  return <Lesson steps={steps} onDone={onClose} cta={cta} dismissible={dismissible} />;
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,10,10,0.82)', alignItems: 'center', justifyContent: 'center', padding: 14 },
  panel: { width: '100%', maxWidth: 460, maxHeight: '94%', backgroundColor: PANEL, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,222,0,0.35)', overflow: 'hidden' },
  goldRule: { height: 4, backgroundColor: GOLD },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 5, width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: MUTED, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: TEXT, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 8 },
  eyebrow: { color: GOLD, fontWeight: '800', letterSpacing: 2.5, fontSize: 11, textTransform: 'uppercase' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 54, height: 54, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.canvasWhite, fontSize: 26, fontWeight: '900', lineHeight: 30 },
  tagline: { color: MUTED, fontSize: 14, fontWeight: '600', marginTop: 2 },
  stage: { backgroundColor: STAGE, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  body: { color: TEXT, fontSize: 16, lineHeight: 23 },
  cardsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cardSlot: { width: 80, height: 107 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.25)', maxWidth: 380 },
  verdictMark: { fontSize: 16, fontWeight: '900' },
  verdictText: { fontSize: 13, fontWeight: '700', color: TEXT, flexShrink: 1 },
  iconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  iconItem: { alignItems: 'center', gap: 6, width: 84 },
  iconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 12, fontWeight: '800', color: TEXT, textAlign: 'center' },
  answers: { flexDirection: 'row', gap: 10 },
  answer: { flex: 1, paddingVertical: 16, borderRadius: 10, borderWidth: 2, alignItems: 'center', backgroundColor: STAGE },
  answerText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  feedback: { borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 6, backgroundColor: STAGE },
  feedbackTitle: { fontSize: 16, fontWeight: '900' },
  footer: { padding: 16, paddingTop: 10, gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotOn: { width: 18, backgroundColor: GOLD },
  dotDone: { backgroundColor: 'rgba(255,222,0,0.5)' },
  footerButtons: { flexDirection: 'row', gap: 10, minHeight: 50 },
  back: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  backText: { color: TEXT, fontWeight: '700' },
  cta: { flex: 1, backgroundColor: GOLD, borderRadius: 8, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: INK, fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
});

export default MechanicIntro;
