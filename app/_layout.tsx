import React, { useEffect, useState } from "react";
import { getToken } from "../app/utils/auth";
import { Stack, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      setLoggedIn(!!token);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 👇 Redirect to correct stack
  if (!loggedIn) {
    return <Redirect href="/(auth)/login" />;
  } else {
    return <Redirect href="/(tabs)/home" />;
  }
}
