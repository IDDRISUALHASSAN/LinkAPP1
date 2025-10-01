// app/_layout.js
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1e88e5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
        contentStyle: { backgroundColor: "#f0f4f8" },
      }}
    >

      <Stack.Screen name="index" options={{ title: "Home" }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="contacts" options={{ title: "Contacts" }} />
    </Stack>
  );
}