import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
  const IP = "10.176.143.51:3000"; 
  const router = useRouter();
  const { userId: paramUserId } = useLocalSearchParams();
  const [userId, setuserId] = useState(paramUserId || "");
  const [isloading, setIsloading] = useState(true);
  const [otp, setotp] = useState('');

  // Only store userId at first load
  useEffect(() => {
    const loadUserId = async () => {
      try {
        if (!paramUserId) {
          const storedId = await AsyncStorage.getItem("userId");
          if (storedId) setuserId(storedId);
        } else {
          await AsyncStorage.setItem("userId", paramUserId);
          setuserId(paramUserId);
        }
      } catch (error) {
        console.error("AsyncStorage error:", error);
        Alert.alert("Error", "Failed to access local storage.");
      }
    };
    loadUserId();
  }, [paramUserId]);

  const confirm = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID missing, please sign up again.");
      return;
    }
    if (!otp) {
      Alert.alert("Missing OTP", "OTP is required to continue");
      return;
    }
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "OTP must be 6 digits");
      return;
    }

    try {
      const response = await fetch(`http://${IP}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });

      const data = await response.json();
      console.log(" Sent userId:", userId);
      console.log(" Sent OTP:", otp);

      if (data.success) {
        // ✅ Save token and phone only after successful verification
        await AsyncStorage.setItem("userToken", data.token);
        await AsyncStorage.setItem("userId", data.user._id);
        await AsyncStorage.setItem("phoneNumber", data.user.phone);

        Alert.alert("Success", "Verification successful!");
        router.replace("/home");   
      } else {
        Alert.alert("Verification Failed", data.message || "Invalid OTP, please try again.");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      Alert.alert("Error", "Something went wrong, please try again.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsloading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.mainContainer}>
      {isloading ? (
        <ActivityIndicator size="large" color="green" />
      ) : (
        <>
          <Text style={styles.header}>WELCOME TO LINKUP</Text>
          <View style={styles.container_2}>
            <Text style={styles.name}>OTP Confirmation</Text>
            <TextInput
              placeholder="Enter the OTP sent to you"
              value={otp}
              onChangeText={setotp}
              style={styles.NameInput}
              keyboardType="numeric"
            />
            <Button title="Confirm" onPress={confirm} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white' 
  },
  container_2: { 
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center', 
    height: 400, 
    width: 350, 
    backgroundColor: '#8f9690ff', 
    borderRadius: 8, 
    padding: 20 
  },
  header: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 60 
  },
  name: { 
    alignSelf: "flex-start",
    marginLeft: 50, 
    marginTop: 20,
    fontSize: 16, 
    fontWeight: '500', 
    color: '#060615ff'
  },
  NameInput: { 
    padding: 10,
    height: 40,
    width: 250,
    backgroundColor: '#c5ceddff', 
    borderRadius: 10, 
    color: '#060615ff',
    marginBottom: 10 
  }
});
