import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth screens */}
      <Stack.Screen name="(screens)" />

      {/* Main app after login */}
      <Stack.Screen name="(drawer)" />
    </Stack>
  );
}
