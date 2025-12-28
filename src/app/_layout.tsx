import { Slot } from "expo-router";
import { View } from "react-native";
import { SocketProvider } from "./context/SocketContext";
import "../../global.css";

export default function RootLayout() {
  return (
    <SocketProvider>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </SocketProvider>
  );
}
