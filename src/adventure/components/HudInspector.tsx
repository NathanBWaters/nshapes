/**
 * In-fight HUD inspector modal — tap any foe bar, passive chip, ★★★ goal,
 * Arcana, Evolution chip/ring, or live buff to read what it does while the
 * fight clock pauses. (Weapons use WeaponExplainer directly.)
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { FighterAvatar } from '@/components/fighters';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { formatChallengeText, useColorblind } from '@/utils/cardColors';
import { scaleText, useTextScale } from '@/utils/textSizeStorage';
import type { ArcanaId, PassiveId, RunState } from '../types';
import { getArcana } from '../data/arcana';
import { getFighter } from '../data/fighters';
import { foeDisplay } from '../data/foes';
import { getPassive } from '../data/passives';
import { starGoals, type ChallengeProgress } from '../engine/challenges';
import { EVOLUTION_CHASSIS } from '../engine/sources';
import { buildAllLiveEvolutions } from '../ui/evolutionViewModel';
import ParryPreviewCard from './ParryPreviewCard';
import { FoeAbilityCard, HazardNotices } from './SharedCards';
import { buildBalatroBreakdown, computePrimedEquation } from '../fx/MultiplierIgnition';
import { Btn, Eyebrow, INK, PopIn, TONE } from './ui';

export type HudInspectTarget =
  | { kind: 'foe' }
  | { kind: 'passive'; id: PassiveId }
  | { kind: 'challenge' }
  | { kind: 'arcana'; id: ArcanaId }
  | { kind: 'evolutions' }
  | { kind: 'score' }
  | { kind: 'buff'; which: 'purity' | 'double' | 'charged' | 'simplified' | 'graces' };

interface Props {
  target: HudInspectTarget | null;
  run: RunState;
  shownHp: number;
  challenge: ChallengeProgress;
  knownEvolutions?: ReadonlySet<string>;
  /** [UI-15] Show a 1-time subtle tip teaching hold-to-inspect mid-Set */
  showGuardTip?: boolean;
  onClose: () => void;
}

const HudInspector: React.FC<Props> = ({ target, run, shownHp, challenge, knownEvolutions, showGuardTip = false, onClose }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const colorblind = useColorblind();
  const textScale = useTextScale();
  if (!target) return null;
  const allowPortraitMotion = appActive && !reducedMotion;

  const titleStyle = [st.title, { fontSize: scaleText(19, textScale) }];
  const bodyStyle = [st.body, { fontSize: scaleText(14, textScale), lineHeight: Math.round(scaleText(14, textScale) * 1.42) }];
  const cardTextStyle = [st.cardText, { fontSize: scaleText(13, textScale), lineHeight: Math.round(scaleText(13, textScale) * 1.38) }];
  const metaStyle = [st.meta, { fontSize: scaleText(12, textScale) }];
  const noteStyle = [st.note, { fontSize: scaleText(12, textScale) }];

  const practice = !!run.level.rules.sandbox;
  const foeInfo = foeDisplay(run.level.foes[run.wave] ?? run.level.foes[0]);
  const hazards = run.level.rules.hazards;

  const renderBody = () => {
    switch (target.kind) {
      case 'foe': {
        return (
          <>
            <View style={st.headerRow}>
              <EnemyAvatar enemy={foeInfo} size={52} hp={shownHp} maxHp={run.foeMaxHp} mood="menacing" lightweight animate={allowPortraitMotion} framed />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Eyebrow text={run.level.isBoss ? 'Boss Foe' : 'Current Foe'} />
                <Text style={titleStyle}>{run.foeName}</Text>
                <Text style={metaStyle}>
                  {practice ? 'Endless HP (Practice)' : `${shownHp} / ${run.foeMaxHp} HP`}
                  {run.level.foes.length > 1 ? ` · Wave ${run.wave + 1}/${run.level.foes.length}` : ''}
                </Text>
              </View>
            </View>
            {foeInfo.ability ? (
              <FoeAbilityCard foe={foeInfo} showAvatar={false} />
            ) : (
              <Text style={bodyStyle}>Standard foe — match Sets of 3 cards to deal damage and knock out {run.foeName}.</Text>
            )}
            {run.parry && <ParryPreviewCard key={colorblind ? 'parry-cb' : 'parry-std'} spec={run.parry.spec} compact testID="inspector-parry-card" />}
            {hazards && <HazardNotices hazards={hazards} testID="inspector-hazards" />}
          </>
        );
      }

      case 'passive': {
        const fighter = getFighter(run.fighter);
        const ordered = [target.id, ...fighter.passives.filter(p => p !== target.id)];
        return (
          <>
            <View style={st.headerRow}>
              <FighterAvatar character={run.fighter} size={44} mood="idle" animate={allowPortraitMotion} quiet={reducedMotion} framed />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Eyebrow text="Fighter Passives" />
                <Text style={titleStyle}>{run.fighter}</Text>
              </View>
            </View>
            {ordered.map(pid => {
              const p = getPassive(pid);
              const focused = pid === target.id;
              return (
                <View key={pid} style={[st.passiveCard, focused && st.passiveFocus]}>
                  <View style={st.rowCenter}>
                    <Icon name={p.icon} size={18} color={INK} />
                    <Text style={[st.cardTitle, { fontSize: scaleText(14, textScale) }]}>{p.name}</Text>
                    <Text style={st.tag}>ALWAYS ON</Text>
                  </View>
                  <Text style={cardTextStyle}>{p.text}</Text>
                </View>
              );
            })}
            <Text style={noteStyle}>Spend stars in {run.fighter}&apos;s Skill Tree at Camp to evolve these passives.</Text>
          </>
        );
      }

      case 'challenge': {
        const goals = starGoals(run.level, run.foeName);
        return (
          <>
            <Eyebrow text="Star Goals" />
            <Text style={titleStyle}>{run.level.id} · {run.level.name}</Text>
            <View style={st.goalRow}>
              <Text style={st.goalStars}>★</Text>
              <Text style={cardTextStyle}>{goals[0]}</Text>
            </View>
            <View style={st.goalRow}>
              <Text style={st.goalStars}>★★</Text>
              <Text style={cardTextStyle}>{goals[1]}</Text>
            </View>
            <View style={[st.goalRow, challenge.met && st.goalMet, challenge.failed && st.goalMissed]}>
              <Text style={st.goalStars}>★★★</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={cardTextStyle}>{formatChallengeText(challenge.text, colorblind)}</Text>
                <Text style={[metaStyle, challenge.met && { color: TONE.upside }, challenge.failed && { color: '#B91C1C' }]}>
                  {challenge.met ? '✓ Goal met! Knock out the foe to lock in ★★★.' : challenge.failed ? 'Missed this run — still clearable for ★ / ★★.' : 'In progress (+ knockout required).'}
                </Text>
              </View>
            </View>
          </>
        );
      }

      case 'arcana': {
        const a = getArcana(target.id);
        return (
          <>
            <View style={st.headerRow}>
              <View style={st.iconBadge}><Icon name={a.icon} size={26} color={TONE.arcana} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Eyebrow text={`Arcana ${a.numeral}`} color="#EDE9FE" />
                <Text style={titleStyle}>{a.name}</Text>
              </View>
            </View>
            <Text style={bodyStyle}>{a.tagline}</Text>
            <View style={st.passiveCard}>
              <Text style={[cardTextStyle, { color: TONE.upside, fontWeight: '800' }]}>▲ {a.upside}</Text>
              <Text style={[cardTextStyle, { color: TONE.tradeoff, fontWeight: '700' }]}>▼ {a.tradeoff}</Text>
            </View>
          </>
        );
      }

      case 'evolutions': {
        const liveEvos = buildAllLiveEvolutions(run.weaponEvolutions ?? [], { colorblind });
        const activeCount = liveEvos.filter(e => e.phase === 'active').length;
        const weaponById = new Map(run.weapons.map(w => [w.id, w]));
        const cdSec = Math.round(EVOLUTION_CHASSIS.defaultCooldownMs / 1000);
        return (
          <>
            <View style={st.headerRow}>
              <View style={st.iconBadge}><Icon name="lorc/crystal-shine" size={26} color={TONE.combo} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Eyebrow text="Equipped Evolutions" color="#EDE9FE" />
                <Text style={titleStyle}>Weapon Awakenings</Text>
                <Text style={metaStyle}>
                  {activeCount} active · {liveEvos.length} equipped · {run.evolutionsTriggered} awakened this fight
                </Text>
              </View>
            </View>
            {liveEvos.length === 0 ? (
              <Text style={bodyStyle}>Equip Armory weapons to track their timed Evolutions during combat.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {liveEvos.map(evo => {
                  const weapon = weaponById.get(evo.weaponId);
                  const isActive = evo.phase === 'active';
                  const isCooldown = evo.phase === 'cooldown';
                  const isAlmost = evo.phase === 'charging' && evo.almostReady;
                  const secs = Math.max(0, Math.ceil(evo.activeRemainingMs / 1000));
                  const cdLeft = Math.max(1, Math.ceil(evo.cooldownRemainingMs / 1000));
                  const pct = isActive
                    ? Math.round((evo.activeRemainingMs / Math.max(1, evo.activeDurationMs)) * 100)
                    : isCooldown
                      ? Math.round((evo.cooldownRemainingMs / Math.max(1, EVOLUTION_CHASSIS.defaultCooldownMs)) * 100)
                      : Math.round((evo.progress / Math.max(1, evo.target)) * 100);
                  const statusLabel = isActive
                    ? `ACTIVE · ${secs}s`
                    : isCooldown
                      ? `COOLDOWN · ${cdLeft}s`
                      : isAlmost
                        ? `ALMOST · ${evo.progress}/${evo.target}`
                        : `${evo.progress}/${evo.target}`;
                  return (
                    <View
                      key={evo.evolutionId}
                      testID={`inspector-evo-${evo.weaponId}`}
                      style={[st.passiveCard, isActive && st.passiveFocus, isAlmost && st.evoAlmostCard]}
                    >
                      <View style={st.rowCenter}>
                        {weapon && <WeaponAvatar weapon={weapon} size={22} interactive={false} />}
                        <Icon name={evo.icon} size={16} color={isActive ? TONE.evoReady : TONE.combo} />
                        <Text style={[st.cardTitle, { fontSize: scaleText(14, textScale) }]} numberOfLines={1}>
                          {evo.evolutionName}
                        </Text>
                        <Text
                          style={[
                            st.evoStatusTag,
                            isActive && st.evoStatusActive,
                            isAlmost && st.evoStatusAlmost,
                            isCooldown && st.evoStatusCooldown,
                          ]}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                      <Text style={metaStyle}>
                        {weapon ? `${weapon.name} · ` : ''}{evo.conditionFull}
                      </Text>
                      <View style={st.evoTrack}>
                        <View
                          style={[
                            st.evoTrackFill,
                            {
                              width: `${Math.max(0, Math.min(100, pct))}%`,
                              backgroundColor: isActive
                                ? TONE.evoReady
                                : isCooldown
                                  ? '#6B7280'
                                  : isAlmost
                                    ? '#D97706'
                                    : '#7C3AED',
                            },
                          ]}
                        />
                      </View>
                      <Text style={cardTextStyle}>{evo.effectText}</Text>
                      {evo.triggersThisFight > 0 && (
                        <Text style={metaStyle}>Awakened {evo.triggersThisFight}× this fight</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={noteStyle}>
              Every active Evolution deals an {EVOLUTION_CHASSIS.ignitionBurstDamage}-damage Ignition Burst and adds +{EVOLUTION_CHASSIS.setFlatDamage} base &amp; +{EVOLUTION_CHASSIS.setAdditiveMult}× multiplier per Set. Evolutions can re-trigger after a {cdSec}s cooldown.
            </Text>
          </>
        );
      }

      case 'score': {
        const last = run.lastSetIgnition ? buildBalatroBreakdown(run.lastSetIgnition) : null;
        const primed = computePrimedEquation(run);
        const fmtN = (n: number) => {
          const r = Math.round(n * 10) / 10;
          return Number.isInteger(r) ? r.toLocaleString() : r.toFixed(1);
        };
        return (
          <>
            <View style={st.headerRow}>
              <View style={[st.iconBadge, { backgroundColor: COLORS.actionYellow }]}>
                <Icon name="lorc/power-lightning" size={24} color={INK} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Eyebrow text="Damage Math" color={COLORS.actionYellow} />
                <Text style={titleStyle}>Score Breakdown</Text>
                <Text style={metaStyle}>Base × Multiplier (+ Bonus hits) = Damage</Text>
              </View>
            </View>

            {last && (
              <View style={{ gap: 6 }}>
                <Text style={st.section}>LAST SET RECEIPT ({fmtN(last.finalBase)} × {fmtN(last.finalMult)}×{last.finalBonus > 0 ? ` + ${fmtN(last.finalBonus)}` : ''} = {fmtN(last.finalTotal)} DMG)</Text>
                {last.steps.map(step => (
                  <View key={step.key} style={st.scoreRow}>
                    <View
                      style={[
                        st.scoreChip,
                        step.kind === 'base' ? st.scoreChipBase : step.kind === 'mult' ? st.scoreChipMult : st.scoreChipBonus,
                      ]}
                    >
                      <Text style={st.scoreChipText}>{step.value}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.scoreLabel, { fontSize: scaleText(13, textScale) }]}>{step.label}</Text>
                      {step.note && <Text style={metaStyle}>{step.note}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ gap: 6 }}>
              <Text style={st.section}>NEXT SET PRIMED ({fmtN(primed.base)} × {fmtN(primed.mult)}× = {fmtN(primed.total)} DMG)</Text>
              {primed.items.map((item, i) => (
                <View key={i} style={st.scoreRow}>
                  <View style={[st.scoreChip, item.kind === 'base' ? st.scoreChipBase : st.scoreChipMult]}>
                    <Text style={st.scoreChipText}>{item.value}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.scoreLabel, { fontSize: scaleText(13, textScale) }]}>{item.label}</Text>
                    {item.note && <Text style={metaStyle}>{item.note}</Text>}
                  </View>
                </View>
              ))}
            </View>

            <Text style={noteStyle}>Match Holo cards (+4 base, ×1.2), link belt Synergies, and awaken Weapon Evolutions (+8 base, +0.2×) to multiply every Set!</Text>
          </>
        );
      }

      case 'buff': {
        if (target.which === 'purity') {
          return (
            <>
              <Eyebrow text="Escalating Purity" color="#CCFBF1" />
              <Text style={titleStyle}>Purity Chain (×{Math.max(1, run.purityChain)})</Text>
              <Text style={bodyStyle}>Match consecutive Sets with rising numbers of varied traits (1 → 2 → 3+ varied) for bonus damage and coins. A mistake or lower variety resets the chain.</Text>
            </>
          );
        }
        if (target.which === 'graces') {
          return (
            <>
              <View style={st.headerRow}>
                <View style={st.iconBadge}><Icon name="lorc/clover" size={26} color={COLORS.tealSurface} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Eyebrow text="Near-Miss Protection" color="#CCFBF1" />
                  <Text style={titleStyle}>Graces ({run.stats.graces} left)</Text>
                </View>
              </View>
              <Text style={bodyStyle}>Off by 1 trait? A Grace forgives a 1-trait near-miss, spares your heart, and refreshes those 3 cards (no Set damage unless a Grace weapon strikes back).</Text>
            </>
          );
        }
        if (target.which === 'double') {
          return (
            <>
              <Eyebrow text="Amplified" />
              <Text style={titleStyle}>Next Trigger ×2</Text>
              <Text style={bodyStyle}>Your next weapon trigger (blast, laser, heal, echo, coin, time...) fires twice in a row!</Text>
            </>
          );
        }
        if (target.which === 'charged') {
          return (
            <>
              <Eyebrow text="Charged Set" color="#FFE8CC" />
              <Text style={titleStyle}>Next Set ×{run.nextSetMultiplier}</Text>
              <Text style={bodyStyle}>Your next Set deals ×{run.nextSetMultiplier} damage! Stacks with Rainbow Strikes and Shading Surges.</Text>
            </>
          );
        }
        return (
          <>
            <Eyebrow text="Clarity" color="#CCFBF1" />
            <Text style={titleStyle}>Simplified Board</Text>
            <Text style={bodyStyle}>Every new card arrives sharing the same trait value while active, making Sets effortless to spot.</Text>
          </>
        );
      }
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay} testID="hud-inspector-modal">
        <TouchableOpacity
          testID="hud-inspector-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close details"
        />
        <PopIn style={st.panel}>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }} bounces={false}>
            {renderBody()}
          </ScrollView>
          {showGuardTip && (
            <View style={st.guardTip} testID="hud-inspect-guard-tip">
              <Icon name="lorc/light-bulb" size={14} color="#92400E" />
              <Text style={st.guardTipText}>Tip: Hold any chip or tap ? to inspect mid-Set.</Text>
            </View>
          )}
          <Btn testID="hud-inspector-close" label="Back to the fight" onPress={onClose} />
        </PopIn>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.canvasWhite, borderRadius: 14, borderWidth: 3, borderBottomWidth: 7, borderColor: INK, padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBadge: { width: 46, height: 46, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  title: { flexShrink: 1, fontSize: 19, fontWeight: '900', color: INK },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: INK, opacity: 0.75 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: INK, opacity: 0.7 },
  body: { fontSize: 14, lineHeight: 20, color: INK },
  bold: { fontWeight: '900' },
  note: { fontSize: 12, lineHeight: 17, color: INK, opacity: 0.75, fontStyle: 'italic' },
  cardWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 10 },
  cardHazard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3E0', borderRadius: 8, borderWidth: 1.5, borderColor: TONE.tradeoff, padding: 10 },
  cardTitle: { flex: 1, flexShrink: 1, fontSize: 14, fontWeight: '900', color: INK },
  cardText: { flex: 1, flexShrink: 1, fontSize: 13, lineHeight: 18, color: INK },
  tag: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: INK, opacity: 0.65 },
  passiveCard: { gap: 4, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 1.5, borderColor: TONE.spentEdge, padding: 10 },
  passiveFocus: { gap: 4, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 10 },
  evoAlmostCard: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  evoStatusTag: {
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
    color: '#4C1D95',
    overflow: 'hidden',
  },
  evoStatusActive: { backgroundColor: COLORS.actionYellow, color: INK },
  evoStatusAlmost: { backgroundColor: '#D97706', color: '#FFFFFF' },
  evoStatusCooldown: { backgroundColor: '#E5E7EB', color: '#4B5563' },
  evoTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(18, 18, 18, 0.12)',
    overflow: 'hidden',
  },
  evoTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.spentEdge, padding: 8 },
  goalMet: { backgroundColor: '#D4F4EE', borderColor: COLORS.tealSurface },
  goalMissed: { backgroundColor: '#FFF1F0', borderColor: COLORS.redSurface },
  goalStars: { width: 34, fontSize: 12, fontWeight: '900', color: '#E0A800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.spentEdge, paddingHorizontal: 8, paddingVertical: 6 },
  scoreChip: { minWidth: 46, borderRadius: 6, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  scoreChipBase: { backgroundColor: '#0E7490' },
  scoreChipMult: { backgroundColor: COLORS.redSurface },
  scoreChipBonus: { backgroundColor: COLORS.orangeSurface },
  scoreChipText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  scoreLabel: { fontSize: 13, fontWeight: '900', color: INK },
  guardTip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 10, paddingVertical: 6 },
  guardTipText: { flex: 1, flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: '#92400E' },
});

export default HudInspector;
