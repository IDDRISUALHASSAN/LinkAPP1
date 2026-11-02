import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { clearAuth } from "@/services/api";

export default function Logout() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setError("");
    try {
      await clearAuth();
      router.replace("/(screens)");
    } catch (error) {
      console.error("Logout Error:", error);
      setError("Could not log out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Are you sure you want to log out?</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.logoutButton,
            isLoggingOut && styles.disabledButton,
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {isLoggingOut ? "Logging out..." : "Log Out"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.cancelButton,
            isLoggingOut && styles.disabledButton,
          ]}
          onPress={() => router.back()}
          disabled={isLoggingOut}
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
  errorText: {
    color: "#b00020",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
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
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
