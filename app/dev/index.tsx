/**
 * [TP-11] /dev Studio Index Hub.
 *
 * Links cleanly to all 7 live studios with 1-click preset shortcuts:
 *   /dev/adventure, /dev/summit, /dev/fx, /dev/sound, /dev/fighters,
 *   /dev/results, /dev/analytics
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import {
  countActiveDevOverrides,
  getDevOverrides,
  resetDevOverrides,
  subscribeDevOverrides,
  type DevOverrides,
} from '@/adventure/engine/devOverrides';

interface StudioPreset {
  label: string;
  href: string;
  testID: string;
}

interface StudioCard {
  id: string;
  title: string;
  route: string;
  icon: IconName;
  blurb: string;
  presets?: StudioPreset[];
}

export const DEV_STUDIOS: readonly StudioCard[] = [
  {
    id: 'adventure',
    title: 'Adventure Combat Studio',
    route: '/dev/adventure?save=maxed',
    icon: 'lorc/crossed-swords',
    blurb: 'Jump straight into any of the 59 campaign levels (+ 1-4D sandbox) with custom weapons, Arcana, or seeds.',
    presets: [
      { label: '1-4D Sandbox', href: '/dev/adventure?save=maxed&level=1-4D', testID: 'dev-preset-sandbox' },
      { label: '1-10 Boss', href: '/dev/adventure?save=before:1-10&level=1-10', testID: 'dev-preset-1-10' },
      { label: '3-1 Surge', href: '/dev/adventure?save=maxed&level=3-1', testID: 'dev-preset-3-1' },
      { label: '5-5 Hydra', href: '/dev/adventure?save=maxed&level=5-5', testID: 'dev-preset-5-5' },
    ],
  },
  {
    id: 'summit',
    title: 'Starfall Summit Studio',
    route: '/dev/summit?start=true',
    icon: 'lorc/mountaintop',
    blurb: 'Launch Starfall Summit climbs across Acts 1–3, Ascension tiers, full 6/6 belts, and fast Evolution tests.',
    presets: [
      { label: 'Act 1 Fight', href: '/dev/summit?start=true&fight=true', testID: 'dev-preset-summit-fight' },
      { label: '6/6 Full Belt', href: '/dev/summit?start=true&fight=true&fullBelt=true&evo=true', testID: 'dev-preset-summit-belt' },
      { label: 'Act 3 Map', href: '/dev/summit?start=true&act=3', testID: 'dev-preset-summit-act3' },
    ],
  },
  {
    id: 'fx',
    title: 'Effects & Slow-Mo Studio',
    route: '/dev/fx',
    icon: 'lorc/bright-explosion',
    blurb: 'Inspect every combat RunEvent, cascade beat, and Evolution cut-in at 1× / 4× / 10× slow motion.',
  },
  {
    id: 'sound',
    title: 'Audio & Mastering Studio',
    route: '/dev/sound',
    icon: 'delapouite/sound-on',
    blurb: 'Audition all 64 weapon voices, 208 evolution motifs, phone-speaker EQ, and adaptive tracks.',
  },
  {
    id: 'fighters',
    title: 'Critter & Relic Studio',
    route: '/dev/fighters',
    icon: 'lorc/cat',
    blurb: 'Pet, poke, and stress-test all 6 Fighters, custom Enemy rigs, wear-and-tear states, and Weapon avatars.',
  },
  {
    id: 'results',
    title: 'Results & Reveal Studio',
    route: '/dev/results',
    icon: 'lorc/trophy',
    blurb: 'Preview star stamps, unlock reveals, defeat screens, and post-battle pacing.',
  },
  {
    id: 'analytics',
    title: 'Balance & Telemetry Studio',
    route: '/dev/analytics',
    icon: 'delapouite/chart',
    blurb: 'Inspect 1.00× weapon/evolution power multipliers, Balance Eras, and Sim-vs-Live telemetry.',
  },
];

const INK = COLORS.slateCharcoal;

export default function DevStudioHub() {
  const [overrides, setOverrides] = useState<DevOverrides>(() => getDevOverrides());

  useEffect(() => subscribeDevOverrides(setOverrides), []);

  const activeOverrides = countActiveDevOverrides(overrides);

  return (
    <View style={st.root} testID="dev-studio-hub">
      <View style={st.header}>
        <TouchableOpacity
          testID="dev-hub-home"
          onPress={() => router.push('/')}
          style={st.backBtn}
          accessibilityLabel="Back to NShapes"
        >
          <Icon name="ui/back-arrow" size={18} color={INK} noShadow />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.eyebrow}>NSHAPES · __DEV__</Text>
          <Text style={st.title} numberOfLines={1}>STUDIO HUB</Text>
        </View>
        {activeOverrides > 0 && (
          <TouchableOpacity
            testID="dev-hub-reset-overrides"
            onPress={resetDevOverrides}
            style={st.overridePill}
          >
            <Text style={st.overridePillText}>Reset {activeOverrides} Overrides</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={st.body}>
        <View style={st.statusStrip}>
          <Text style={st.statusText}>
            Slow-Mo: {overrides.slowMoRate}× · Active Overrides: {activeOverrides}
          </Text>
        </View>

        {DEV_STUDIOS.map(studio => (
          <View key={studio.id} style={st.card} testID={`dev-studio-card-${studio.id}`}>
            <TouchableOpacity
              testID={`dev-studio-link-${studio.id}`}
              onPress={() => router.push(studio.route as never)}
              activeOpacity={0.85}
              style={st.cardHead}
              accessibilityRole="button"
              accessibilityLabel={`Open ${studio.title}`}
            >
              <View style={st.iconBox}>
                <Icon name={studio.icon} size={24} color={INK} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={st.cardTitle} numberOfLines={1}>{studio.title}</Text>
                <Text style={st.cardRoute} numberOfLines={1}>{studio.route.split('?')[0]}</Text>
              </View>
              <Text style={st.chevron}>›</Text>
            </TouchableOpacity>
            <Text style={st.cardBlurb}>{studio.blurb}</Text>

            {studio.presets && studio.presets.length > 0 && (
              <View style={st.presetRow}>
                {studio.presets.map(preset => (
                  <TouchableOpacity
                    key={preset.testID}
                    testID={preset.testID}
                    onPress={() => router.push(preset.href as never)}
                    style={st.presetChip}
                    activeOpacity={0.85}
                  >
                    <Text style={st.presetText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.actionYellow,
    borderBottomWidth: 2,
    borderBottomColor: INK,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: INK,
    opacity: 0.7,
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: INK,
  },
  overridePill: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  overridePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.canvasWhite,
  },
  body: {
    padding: 14,
    gap: 12,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  statusStrip: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: INK,
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
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
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    color: INK,
  },
  cardRoute: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '900',
    color: INK,
    opacity: 0.55,
  },
  cardBlurb: {
    fontSize: 12.5,
    lineHeight: 17,
    color: INK,
    opacity: 0.85,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  presetChip: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  presetText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: INK,
  },
});
