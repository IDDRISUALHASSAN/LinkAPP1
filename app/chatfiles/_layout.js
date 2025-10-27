import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#cacdd0ff" },
        headerTintColor: "#150e0eff",
        headerTitleStyle: { fontWeight: "bold" },
        contentStyle: { backgroundColor: "#f0f4f8" },
      }}
    >
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="user" options={{ title: "User" }} />
    </Stack>
  );
}
