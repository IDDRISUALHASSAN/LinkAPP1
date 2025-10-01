import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import React, { useState } from "react";
import { useRouter, Link } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function Signup() {
  const IP = "10.24.105.51:3000"; 
  const router = useRouter();

  const [name, setname] = useState("");
  const [PhoneNumber, setPhoneNumber] = useState("");
  const [password, setpassword] = useState("");
  const [isloading, setIsloading] = useState(false);

  const signup = async () => {
    if (!name || !PhoneNumber || !password) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    setIsloading(true);

    try {
      const response = await fetch(`http://${IP}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, PhoneNumber, password }),
      });

      const data = await response.json();
      console.log("🔍 Signup Response:", data);

      if (data.success) {
        // ✅ Save userId in AsyncStorage
        await AsyncStorage.setItem("userId", data.userId);

        Alert.alert("OTP Sent", "Please check your phone for the OTP");
        router.push({ pathname: "/auth", params: { userId: data.userId } });
      } else {
        Alert.alert("Signup Failed", data.message || "Something went wrong");
      }
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setIsloading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      {isloading ? (
        <ActivityIndicator size="large" color="#2e7d32" />
      ) : (
        <Animated.View entering={FadeInDown.duration(800)} style={styles.container_2}>
          <Text style={styles.header}>Create Account</Text>

          
          <Text style={styles.name}>Name</Text>
          <TextInput
            placeholder="Enter your name"
            value={name}
            onChangeText={setname}
            style={styles.NameInput}
          />

          {/* Phone */}
          <Text style={styles.name}>Phone Number</Text>
          <TextInput
            placeholder="Enter your phone number"
            value={PhoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.NameInput}
            keyboardType="phone-pad"
          />

          {/* Password */}
          <Text style={styles.name}>Password</Text>
          <TextInput
            placeholder="Enter your password"
            value={password}
            onChangeText={setpassword}
            style={styles.NameInput}
            secureTextEntry
          />

          {/* Sign up button */}
          <TouchableOpacity
            style={styles.signupButton}
            onPress={signup}
            activeOpacity={0.8}
          >
            <Text style={styles.signupText}>Sign Up</Text>
          </TouchableOpacity>

          {/* Link to Login */}
          <Text style={styles.loginLink}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#2e7d32", fontWeight: "600" }}>
              Login
            </Link>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
    paddingHorizontal: 20,
  },
  container_2: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#e1e5ee",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#2e2e2e",
    textAlign: "center",
  },
  name: {
    alignSelf: "flex-start",
    marginTop: 15,
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  NameInput: {
    paddingHorizontal: 12,
    height: 45,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    marginTop: 5,
    marginBottom: 10,
    color: "#060615ff",
  },
  signupButton: {
    backgroundColor: "#2e7d32",
    marginTop: 20,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  signupText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loginLink: {
    marginTop: 20,
    fontSize: 14,
    textAlign: "center",
    color: "#444",
  },
});
