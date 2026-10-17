import { Stack } from "expo-router";
import usePushNotifications from "../hooks/usePushNotifications";

export default function RootLayout() {
  usePushNotifications();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(screens)" />
      <Stack.Screen name="(drawer)" />
    </Stack>
  );
}
