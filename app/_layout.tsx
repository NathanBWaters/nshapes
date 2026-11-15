import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TutorialProvider } from "@/context/TutorialContext";
import { KeywordProvider } from "@/context/KeywordContext";
import KeywordTooltip from "@/components/KeywordTooltip";
import { initAudio, preloadAllSounds } from "@/utils/sounds";
import { installPerfWatchdog } from "@/utils/perfWatchdog";
import { LevelProgressStorage } from "@/utils/storage";
import { startAnalytics } from "@/analytics/posthog";

export default function RootLayout() {
  // Initialize audio system, preload sounds, migrate old save data, and arm the perf watchdog
  useEffect(() => {
    const stopWatchdog = installPerfWatchdog();
    initAudio();
    preloadAllSounds();
    // Migrate old save format to new level-based system
    LevelProgressStorage.migrateFromOldSaveFormat();
    // Anonymous gameplay analytics (src/analytics): sends anything queued from last time
    startAnalytics();
    return stopWatchdog;
  }, []);

  return (
    <SafeAreaProvider>
      <KeywordProvider>
        <TutorialProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
          <StatusBar style="auto" />
          <KeywordTooltip />
        </TutorialProvider>
      </KeywordProvider>
    </SafeAreaProvider>
  );
}
