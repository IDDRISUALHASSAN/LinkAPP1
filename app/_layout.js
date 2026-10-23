import { Stack } from "expo-router";
import usePushNotifications from "../hooks/usePushNotifications";
import useNotifications from "../hooks/useNotifications";

export default function RootLayout() {
  usePushNotifications();
  useNotifications();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(screens)" />
      <Stack.Screen name="(drawer)" />
    </Stack>
  );
}
