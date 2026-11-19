/**
 * Shared domain UI cards reused across Adventure Mode AND Starfall Spire.
 *
 * Keeps fighters, Arcana, skill nodes, armed evolutions, weapon offer rows,
 * foe abilities, and board hazards looking & behaving identically across modes
 * with zero duplicated markup.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { EnemyAvatar } from '@/components/enemies';
import { WeaponAvatar } from '@/components/weapons';
import { COLORS } from '@/utils/colors';
import type { CharacterName, Weapon } from '@/types';
import type { ArcanaId, EvolutionRecipe, LevelHazards } from '../types';
import { getArcana } from '../data/arcana';
import { weaponLevelSuffix } from '../data/armory';
import { getFighter } from '../data/fighters';
import type { FoeDisplay } from '../data/foes';
import { getPassive } from '../data/passives';
import { getSkillNode } from '../data/skillTrees';
import { INK, TONE } from './ui';

/** Displays a fighter's two signature passives in the shared paper-beige inset card. */
export const FighterPassivesList: React.FC<{
  fighter: CharacterName;
  compact?: boolean;
  /** Optional prefix for per-passive row testIDs (e.g. "camp-passive" → "camp-passive-nine_lives") */
  itemTestIdPrefix?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ fighter, compact = false, itemTestIdPrefix, testID, style }) => {
  const def = getFighter(fighter);
  return (
    <View testID={testID} style={[st.passivesBox, compact && st.passivesBoxCompact, style]}>
      {def.passives.map(pid => {
        const p = getPassive(pid);
        return (
          <View key={pid} testID={itemTestIdPrefix ? `${itemTestIdPrefix}-${pid}` : undefined} style={st.passiveLine}>
            <Icon name={p.icon} size={compact ? 14 : 16} color={INK} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.passiveName}>{p.name}</Text>
              <Text style={st.passiveText}>{p.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/** Displays a single Tarot Arcana card (numeral, icon, green ▲ upside, amber ▼ tradeoff). */
export const ArcanaCard: React.FC<{
  arcanaId: ArcanaId;
  /** Optional prefix before numeral (e.g. "Arcana") */
  prefix?: string;
  /** Optional right-side action (buy button, equip pill, etc.) */
  right?: React.ReactNode;
  /** Highlight active/equipped state */
  selected?: boolean;
  /** Show tagline above upside/tradeoff */
  showTagline?: boolean;
  /** Small top-right status tag (e.g. "ACTIVE") */
  badgeText?: string;
  /** Locked state: hides name/effects behind unlock hint */
  lockedText?: string;
  onPress?: () => void;
  disabled?: boolean;
  dimmed?: boolean;
  /** Framed tarot-style icon tile (used in Camp & shops) vs compact inline row */
  tarot?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({
  arcanaId,
  prefix,
  right,
  selected = false,
  showTagline = false,
  badgeText,
  lockedText,
  onPress,
  disabled,
  dimmed,
  tarot = false,
  testID,
  style,
}) => {
  const a = getArcana(arcanaId);
  const locked = Boolean(lockedText);
  const title = locked
    ? `Arcana ${a.numeral}: ???`
    : prefix
      ? `${prefix} ${a.numeral} · ${a.name}`
      : `${a.numeral} · ${a.name}`;

  const body = (
    <>
      {tarot ? (
        <View style={[st.arcanaTarot, selected && { backgroundColor: COLORS.actionYellow }]}>
          <Text style={st.arcanaNumeral}>{a.numeral}</Text>
          <Icon name={locked ? 'lorc/padlock' : a.icon} size={24} color={INK} />
        </View>
      ) : (
        <View style={[st.iconBox, selected && { backgroundColor: COLORS.actionYellow }]}>
          <Icon name={locked ? 'lorc/padlock' : a.icon} size={22} color={INK} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={st.nameRow}>
          <Text style={st.cardTitle}>{title}</Text>
          {badgeText && (
            <View style={[st.badge, { backgroundColor: INK }]}>
              <Text style={st.badgeText}>{badgeText}</Text>
            </View>
          )}
        </View>
        {locked ? (
          <Text style={st.cardDesc}>{lockedText}</Text>
        ) : (
          <>
            {showTagline && <Text style={st.cardDesc}>{a.tagline}</Text>}
            <Text style={st.arcanaUp}>▲ {a.upside}</Text>
            <Text style={st.arcanaDown}>▼ {a.tradeoff}</Text>
          </>
        )}
      </View>
      {right}
    </>
  );

  const cardStyle = [
    st.rowCard,
    tarot && st.rowCardWhite,
    selected && st.arcanaSelected,
    (dimmed || locked) && { opacity: locked ? 0.6 : 0.45 },
    locked && { backgroundColor: '#EFEAE2' },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        disabled={disabled || locked}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityState={{ selected, disabled: Boolean(disabled || locked) }}
        style={[cardStyle, st.rowInteractive]}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {body}
    </View>
  );
};

/** Displays a fighter Skill Tree node (used in drafts, campfires, events, and build inspection). */
export const SkillNodeRow: React.FC<{
  nodeId: string;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ nodeId, onPress, testID, style }) => {
  const node = getSkillNode(nodeId);
  if (!node) return null;

  const content = (
    <>
      <View style={[st.iconBox, st.skillIconBox]}>
        <Icon name={node.icon} size={22} color={TONE.upside} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.cardTitle}>{node.name}</Text>
        <Text style={st.cardDesc}>{node.text}</Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        activeOpacity={0.85}
        style={[st.skillCard, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={[st.rowCard, style]}>
      {content}
    </View>
  );
};

/** Displays an armed Evolution recipe row (used in LevelPreview & SpireBuildModal). */
export const ArmedEvolutionRow: React.FC<{
  recipe: EvolutionRecipe;
  known?: boolean;
  /** Show the ingredient family text instead of "ARMED" suffix (e.g. build inspector). */
  showFamily?: boolean;
  testID?: string;
}> = ({ recipe, known = true, showFamily = false, testID }) => (
  <View testID={testID} style={st.evoRow}>
    <Icon name={recipe.icon} size={16} color={TONE.evoReady} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.evoName}>
        {known ? recipe.name : '??? Evolution'} · {showFamily && known ? recipe.familyText : 'ARMED'}
      </Text>
      <Text style={st.cardDesc}>
        {known ? recipe.activeText : `${recipe.familyText}: forge it to find out what it does.`}
      </Text>
    </View>
  </View>
);

/** Displays a foe's passive/active combat ability banner (shared by LevelPreview & SpireEncounterPreview). */
export const FoeAbilityCard: React.FC<{
  foe: FoeDisplay;
  showAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ foe, showAvatar = true, style }) => {
  if (!foe.ability) return null;
  return (
    <View style={[st.abilityBox, style]}>
      {showAvatar ? (
        <EnemyAvatar enemy={foe} size={26} mood="menacing" lightweight />
      ) : (
        <Icon name="lorc/crossed-swords" size={16} color={INK} />
      )}
      <Text style={st.abilityText}>
        <Text style={st.bold}>{foe.name}: </Text>
        {foe.ability}
      </Text>
    </View>
  );
};

/** Displays board hazard notices (Time Bombs & Snares) — shared by LevelPreview & SpireEncounterPreview. */
export const HazardNotices: React.FC<{ hazards: LevelHazards; testID?: string }> = ({ hazards, testID = 'preview-hazards' }) => {
  if (!hazards.timeBombs && !hazards.snares) return null;
  return (
    <View style={{ gap: 6 }} testID={testID}>
      {hazards.timeBombs && (
        <View style={st.hazardBox}>
          <Icon name="lorc/time-bomb" size={20} color={INK} />
          <Text style={st.abilityText}>
            <Text style={st.bold}>Time Bombs: </Text>
            match a bomb card within {hazards.timeBombs.seconds}s or lose a heart.
          </Text>
        </View>
      )}
      {hazards.snares && (
        <View style={st.hazardBox}>
          <Icon name="lorc/wolf-trap" size={20} color={INK} />
          <Text style={st.abilityText}>
            <Text style={st.bold}>Snares: </Text>
            matching a snared card costs a heart. Match the card its arrow points at to defuse it for +4 damage.
          </Text>
        </View>
      )}
    </View>
  );
};

/** Displays Shading Surge rule notice (shared by encounters with Shading Surge active). */
export const ShadingSurgeNotice: React.FC = () => (
  <View style={st.surgeBox}>
    <Icon name="lorc/stone-block" size={16} color={TONE.surge} />
    <Text style={st.abilityText}>
      <Text style={[st.bold, { color: TONE.surge }]}>Shading Surge Active: </Text>
      Every 45s, shading turns on for 15s and every Set’s base damage is ×5!
    </Text>
  </View>
);

export interface OfferBadge {
  text: string;
  bg: string;
  fg?: string;
}

/**
 * Shared weapon offer / pick / shop / forge row used across Adventure Mode's
 * in-fight Level-Up & Intermission Shop AND Starfall Spire's Drafts, Shops,
 * Campfire Forging, Vaults, and Events.
 */
export const WeaponOfferRow: React.FC<{
  weapon: Weapon;
  level?: number;
  subtitle?: string;
  badges?: OfferBadge[];
  focused?: boolean;
  dimmed?: boolean;
  right?: React.ReactNode;
  triggerKey?: number;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({
  weapon,
  level = 1,
  subtitle,
  badges,
  focused = false,
  dimmed = false,
  right,
  triggerKey,
  onPress,
  disabled,
  testID,
  style,
}) => {
  const label = `${weapon.name}${weaponLevelSuffix(level)}`;
  const inner = (
    <>
      <View style={st.iconBox}>
        <WeaponAvatar weapon={weapon} size={30} triggerKey={triggerKey} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={st.nameRow}>
          <Text style={st.cardTitle} numberOfLines={1}>{label}</Text>
          {badges?.map((b, i) => (
            <View key={i} style={[st.badge, { backgroundColor: b.bg }]}>
              <Text style={[st.badgeText, b.fg ? { color: b.fg } : null]}>{b.text}</Text>
            </View>
          ))}
        </View>
        <Text style={st.cardDesc}>{subtitle ?? weapon.shortDescription}</Text>
      </View>
    </>
  );

  if (right) {
    return (
      <View style={[st.weaponRow, focused && st.weaponRowFocused, dimmed && { opacity: 0.45 }, style]}>
        {onPress ? (
          <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.85} style={st.weaponLeft}>
            {inner}
          </TouchableOpacity>
        ) : (
          <View style={st.weaponLeft}>{inner}</View>
        )}
        {right}
      </View>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        activeOpacity={0.85}
        style={[st.weaponRow, focused && st.weaponRowFocused, dimmed && { opacity: 0.45 }, style]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={[st.weaponRow, focused && st.weaponRowFocused, dimmed && { opacity: 0.45 }, style]}>
      {inner}
    </View>
  );
};

/** Compact weapon pill/chip (used in Build Inspector, Forge pickers, and Arsenal summaries). */
export const WeaponChip: React.FC<{
  weapon: Weapon;
  level?: number;
  label?: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ weapon, level = 1, label, active = false, onPress, testID, style }) => {
  const text = label ?? `${weapon.name}${weaponLevelSuffix(level)}`;
  const body = (
    <>
      <WeaponAvatar weapon={weapon} size={22} />
      <Text style={st.weaponChipText} numberOfLines={1}>{text}</Text>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        activeOpacity={0.8}
        style={[st.weaponChip, active && st.weaponChipActive, style]}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return (
    <View testID={testID} style={[st.weaponChip, active && st.weaponChipActive, style]}>
      {body}
    </View>
  );
};

/** Compact icon + label upgrade row (used by Workshop / Bazaar upgrades). */
export const UpgradeOfferRow: React.FC<{
  icon: IconName;
  name: string;
  description: string;
  right?: React.ReactNode;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, name, description, right, dimmed, style }) => (
  <View style={[st.weaponRow, dimmed && { opacity: 0.45 }, style]}>
    <View style={st.weaponLeft}>
      <View style={st.iconBox}>
        <Icon name={icon} size={22} color={INK} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.cardTitle}>{name}</Text>
        <Text style={st.cardDesc}>{description}</Text>
      </View>
    </View>
    {right}
  </View>
);

const st = StyleSheet.create({
  bold: { fontWeight: '900' },
  passivesBox: { backgroundColor: COLORS.paperBeige, borderRadius: 8, borderWidth: 1.5, borderColor: '#D6CFC4', padding: 8, gap: 6 },
  passivesBoxCompact: { padding: 8, gap: 5 },
  passiveLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  passiveName: { fontSize: 12, fontWeight: '900', color: INK },
  passiveText: { fontSize: 12, lineHeight: 16, color: INK, opacity: 0.88 },

  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderColor: INK, padding: 10 },
  rowCardWhite: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, padding: 12 },
  rowInteractive: { borderBottomWidth: 4 },
  arcanaSelected: { borderColor: COLORS.actionYellow, backgroundColor: TONE.selected },
  iconBox: { width: 42, height: 42, borderRadius: 8, borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  arcanaTarot: { width: 52, height: 68, borderRadius: 8, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arcanaNumeral: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: INK },
  cardTitle: { flexShrink: 1, fontSize: 13.5, fontWeight: '900', color: INK },
  cardDesc: { fontSize: 12, color: INK, opacity: 0.85, lineHeight: 16 },
  arcanaUp: { fontSize: 12, fontWeight: '800', color: TONE.upside, lineHeight: 16 },
  arcanaDown: { fontSize: 12, fontWeight: '700', color: TONE.tradeoff, lineHeight: 16 },

  skillCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: TONE.upside, backgroundColor: '#F0FDFA', padding: 10 },
  skillIconBox: { backgroundColor: '#CCFBF1', borderColor: TONE.upside },

  evoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: TONE.coinPale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.evoReady, padding: 8 },
  evoName: { fontSize: 12, fontWeight: '900', color: INK },

  abilityBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3F2', borderWidth: 1.5, borderColor: '#F5C2BE', borderRadius: 8, padding: 8 },
  abilityText: { flex: 1, fontSize: 12, color: INK, lineHeight: 17 },
  hazardBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#D97706', borderRadius: 8, padding: 8 },
  surgeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TONE.surgePale, borderRadius: 8, borderWidth: 1.5, borderColor: TONE.surge, padding: 8 },

  weaponRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 2, borderColor: '#D6CFC4', padding: 8 },
  weaponRowFocused: { borderColor: INK, backgroundColor: TONE.selected },
  weaponLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8.5, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.4 },
  weaponChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.paperBeige, borderWidth: 2, borderColor: '#C9C2B8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, maxWidth: '100%' },
  weaponChipActive: { backgroundColor: TONE.selected, borderColor: INK },
  weaponChipText: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: INK },
});
