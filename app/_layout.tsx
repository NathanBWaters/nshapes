import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocketProvider } from "@/context/SocketContext";
import { TutorialProvider } from "@/context/TutorialContext";

export default function RootLayout() {
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
