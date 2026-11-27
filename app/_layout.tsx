import "../global.css";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TutorialProvider } from "@/context/TutorialContext";
import { KeywordProvider } from "@/context/KeywordContext";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import KeywordTooltip from "@/components/KeywordTooltip";
import { initAudio, preloadAllSounds } from "@/utils/sounds";
import { installPerfWatchdog } from "@/utils/perfWatchdog";
import { LevelProgressStorage } from "@/utils/storage";
import { useAppFonts } from "@/utils/fonts";
import { startAnalytics } from "@/analytics/posthog";

export default function RootLayout() {
  useAppFonts();

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
      {Platform.OS === "web" && (
        <Head>
          <title>NShapes — Pattern-Matching Roguelike</title>
        </Head>
      )}
      <AppErrorBoundary>
        <KeywordProvider>
          <TutorialProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                title: "NShapes — Pattern-Matching Roguelike",
              }}
            />
            <StatusBar style="dark" />
            <KeywordTooltip />
          </TutorialProvider>
        </KeywordProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
