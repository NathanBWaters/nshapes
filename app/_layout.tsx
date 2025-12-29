import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocketProvider } from "@/context/SocketContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SocketProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <StatusBar style="auto" />
      </SocketProvider>
    </SafeAreaProvider>
  );
}
