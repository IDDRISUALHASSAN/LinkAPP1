import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export default function Auth() {
const API_URL = Constants.expoConfig.extra.API_URL;
  const router = useRouter();
  const { userId: paramUserId, phoneNumber: paramPhone } = useLocalSearchParams();

  const [userId, setUserId] = useState(paramUserId || "");
  const [phoneNumber, setPhoneNumber] = useState(paramPhone || "");
  const [isLoading, setIsLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);

  // Load data from params or AsyncStorage
  useEffect(() => {
    const loadData = async () => {
      try {
        if (paramUserId) {
          await AsyncStorage.setItem("userId", paramUserId);
          setUserId(paramUserId);
        } else {
          const storedId = await AsyncStorage.getItem("userId");
          if (storedId) setUserId(storedId);
        }

        if (paramPhone) {
          await AsyncStorage.setItem("phoneNumber", paramPhone);
          setPhoneNumber(paramPhone);
        } else {
          const storedPhone = await AsyncStorage.getItem("phoneNumber");
          if (storedPhone) setPhoneNumber(storedPhone);
        }
      } catch (error) {
        console.error("AsyncStorage error:", error);
        Alert.alert("Error", "Failed to access local storage.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [paramUserId, paramPhone]);

  const confirm = async () => {
    if (!userId) return Alert.alert("Error", "User ID missing, please sign up again.");
    if (!otp) return Alert.alert("Missing OTP", "OTP is required to continue");
    if (otp.length !== 6) return Alert.alert("Invalid OTP", "OTP must be 6 digits");

    try {
      const response = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp }),
      });

      const data = await response.json();
      console.log(" Verify Response:", data);

      if (data.success && data.user) {
        await AsyncStorage.setItem("userToken", data.token ?? "");
        await AsyncStorage.setItem("userId", data.user._id ?? "");
        await AsyncStorage.setItem("phoneNumber", data.user.PhoneNumber ?? "");

        Alert.alert("Success", "Verification successful!");
        router.replace("/home");
      } else {
        Alert.alert("Verification Failed", data.message || "Invalid OTP.");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      Alert.alert("Error", "Something went wrong, please try again.");
    }
  };

  const resendOtp = async () => {
    try {
      setResending(true);
      const response = await fetch(`${API_URL}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PhoneNumber: phoneNumber }),
      });
      const data = await response.json();

      console.log("📩 Resend OTP Response:", data);
      if (data.success) {
        Alert.alert("OTP Resent", "A new OTP has been sent to your WhatsApp.");
      } else {
        Alert.alert("Failed", data.message || "Could not resend OTP.");
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color="green" />
      ) : (
        <View style={styles.container}>
          <Text style={styles.header}>Verify Your Account</Text>

          <TextInput
            placeholder="Enter OTP"
            value={otp}
            onChangeText={setOtp}
            style={styles.input}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.confirmButton} onPress={confirm}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={resendOtp}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? "Resending..." : "Resend OTP"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    width: "90%",
    maxWidth: 350,
    backgroundColor: "#e1e5ee",
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
  },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: {
    width: "100%",
    height: 45,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  confirmButton: {
    backgroundColor: "#2e7d32",
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resendButton: { marginTop: 15 },
  resendText: { color: "#2e7d32", fontSize: 15, fontWeight: "500" },
});
