import { StyleSheet, Text, View, TextInput, Button, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { router } from 'expo-router';

export default function Forgotpassrest() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const API_URL = 'http://192.168.0.139:3000'; // your backend URL

  const handleResetPassword = async () => {
    if (!phoneNumber) {
      setMessage("Please enter your phone number");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/resetpassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PhoneNumber: phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("OTP sent successfully via WhatsApp!");
        // Optionally navigate to verification screen
        setTimeout(() => 
            router.push({
              pathname: "/chat/verifyReset",
              params: { phoneNumber },
            })
        , 1500);
      } else {
        setMessage(data.message || "Failed to send OTP.");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Network error, please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      <Text style={styles.subtitle}>
        Please enter your Phone Number to reset your password.
      </Text>

      <TextInput
        placeholder="Enter your phone number "
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        style={styles.input}
        keyboardType="phone-pad"
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <Button title="Submit" onPress={handleResetPassword} />
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
    textAlign: "center",
    top: -50,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  input: {
    width: 300,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  message: {
    marginTop: 15,
    fontSize: 16,
    textAlign: "center",
  },
});
