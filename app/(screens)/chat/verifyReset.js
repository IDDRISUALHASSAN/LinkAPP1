import React, { useState } from "react";
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

export default function VerifyReset() {
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If phone number was passed from previous screen
const { phoneNumber: paramPhone } = useLocalSearchParams();
const API_URL = Constants.expoConfig.extra.API_URL;

  const handleVerifyOTP = async () => {
    if (!otp || !newPassword || !paramPhone) {
      console.log(paramPhone)
      setMessage("All fields are required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PhoneNumber: paramPhone, otp, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("Password reset successful! ");

        setTimeout(() => {
          router.replace("/");
        }, 1500);
      } else {
        setMessage(data.message || "Failed to reset password");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Network error, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter the OTP sent to your WhatsApp</Text>

      <TextInput
        placeholder="Enter OTP"
        keyboardType="numeric"
        value={otp}
        onChangeText={setOtp}
        style={styles.input}
      />

      <TextInput
        placeholder="Enter new password"
        secureTextEntry={!showPassword}
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
      />

      <Ionicons
        name={showPassword ? "eye-off" : "eye"}
        size={24}
        color="black"
        onPress={() => setShowPassword(!showPassword)}
        style={styles.eyeIcon}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <Button title="Reset Password" onPress={handleVerifyOTP} />
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    width: 300,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  message: {
    marginTop: 15,
    fontSize: 16,
    textAlign: "center",
  },
  eyeIcon: {
    position: "absolute",
    right: 35,
    top: 370,
  },
});
