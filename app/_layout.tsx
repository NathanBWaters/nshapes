import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocketProvider } from "@/context/SocketContext";
import { TutorialProvider } from "@/context/TutorialContext";
import { KeywordProvider } from "@/context/KeywordContext";
import KeywordTooltip from "@/components/KeywordTooltip";
import { initAudio, preloadAllSounds } from "@/utils/sounds";
import { LevelProgressStorage } from "@/utils/storage";

export default function RootLayout() {
  // Initialize audio system, preload sounds, and migrate old save data
  useEffect(() => {
    initAudio();
    preloadAllSounds();
    // Migrate old save format to new level-based system
    LevelProgressStorage.migrateFromOldSaveFormat();
  }, []);

  return (
    <SafeAreaProvider>
      <KeywordProvider>
        <TutorialProvider>
          <SocketProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
            <StatusBar style="auto" />
            <KeywordTooltip />
          </SocketProvider>
        </TutorialProvider>
      </KeywordProvider>
    </SafeAreaProvider>
  );
}
