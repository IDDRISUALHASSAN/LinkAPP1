import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

export default function Logout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear(); // Clear all stored data for a full logout
      Alert.alert(
        "Logged Out",
        "You have been logged out successfully",
        [
          {
            text: "OK",
            onPress: () => router.replace("/"), // Navigate after alert is dismissed
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Error", "Something went wrong during logout");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Are you sure you want to log out?</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 40,
  },
  buttons: {
    width: "100%",
    maxWidth: 300,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButton: {
    backgroundColor: "#d32f2f",
  },
  cancelButton: {
    backgroundColor: "#1976d2",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
