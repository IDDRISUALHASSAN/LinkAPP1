import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="signUp" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="upload" />
      <Stack.Screen
        name="video/[id]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
          headerTitle: "",
          headerBackTitle: "Back",
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
