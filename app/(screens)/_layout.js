import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";

export default function Layout() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId"); // match signup storage
        setIsLoggedIn(!!userId); 
      } catch (e) {
        console.log("Error reading token", e);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <Stack.Screen name="home" />
      ) : (
        <>
          <Stack.Screen name="index" />
          <Stack.Screen name="signUp" />
          <Stack.Screen name="auth" />
        </>
      )}
    </Stack>
  );
}
