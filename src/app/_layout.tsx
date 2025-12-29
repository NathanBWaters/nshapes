import { Slot } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SocketProvider } from "@/context/SocketContext";
import "../../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SocketProvider>
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </SocketProvider>
    </SafeAreaProvider>
  );
}
