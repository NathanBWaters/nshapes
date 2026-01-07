import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocketProvider } from "@/context/SocketContext";
import { TutorialProvider } from "@/context/TutorialContext";
import { initAudio, preloadAllSounds } from "@/utils/sounds";

export default function RootLayout() {
  // Initialize audio system and preload sounds
  useEffect(() => {
    initAudio();
    preloadAllSounds();
  }, []);

  return (
    <SafeAreaProvider>
      <TutorialProvider>
        <SocketProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
          <StatusBar style="auto" />
        </SocketProvider>
      </TutorialProvider>
    </SafeAreaProvider>
  );
}
