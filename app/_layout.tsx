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
              // Screen transition animations
              animation: 'fade',
              animationDuration: 250,
              // Gesture handling
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              // Prevent flash of white during transitions
              contentStyle: {
                backgroundColor: '#FFFFFF',
              },
            }}
          />
          <StatusBar style="auto" />
        </SocketProvider>
      </TutorialProvider>
    </SafeAreaProvider>
  );
}
