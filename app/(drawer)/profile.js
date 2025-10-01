import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn } from "react-native-reanimated";

export default function Profile() {
  const IP = "10.24.105.51:3000";
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`http://${IP}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      console.log("Profile response:", data);

      if (data.success) setUser(data.user);
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#05a31d" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>❌ Failed to load profile</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(800)} style={styles.container}>
      <Text style={styles.title}>👤 My Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>
          Name: <Text style={styles.value}>{user.name}</Text>
        </Text>
        <Text style={styles.label}>
          Phone: <Text style={styles.value}>{user.PhoneNumber}</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, padding: 20, backgroundColor: "white" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#05a31d",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  label: { fontSize: 18, marginVertical: 10, color: "#333" },
  value: { fontWeight: "600", color: "#000" },
});
