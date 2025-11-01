import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, Link } from "expo-router";
import Constants from "expo-constants";

export default function Signup() {
  const router = useRouter();
const API_URL = Constants.expoConfig.extra.API_URL;

  const [name, setName] = useState("");
  const [PhoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !PhoneNumber || !password) {
      return Alert.alert("Missing Fields", "Please fill in all fields.");
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, PhoneNumber, password }),
      });

      const data = await response.json();
      console.log("📤 Signup Response:", data);

      if (data.success) {
        Alert.alert("Success", "OTP has been sent to your WhatsApp!");
        router.push({
          pathname: "/auth",
          params: { userId: data.userId, phoneNumber: PhoneNumber },
        });
      } else {
        Alert.alert("Signup Failed", data.message || "Please try again.");
      }
    } catch (error) {
      console.error("Signup Error:", error);
      Alert.alert("Error", "Something went wrong. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.name}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />
      
      <Text style={styles.name}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={PhoneNumber}
        onChangeText={setPhoneNumber}
      />
  
      <Text style={styles.name}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.loginLink}>
        Already have an account?{" "}
        <Link href="/" style={{ color: "#251dc7ff", fontWeight: "1000" }}>
          Login
        </Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#70728dff",
    paddingHorizontal: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 25 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    color: "#000",
    backgroundColor: "#fff",
  },
  button: {
    width: "100%",
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loginLink: { marginTop: 15, fontSize: 14 },
  name: { alignSelf: "flex-start",
    marginBottom: 5,
    fontWeight: "600" 
  },
});
