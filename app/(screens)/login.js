import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import React, { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function Home() {
  const IP = "10.24.105.51:3000"; // ✅ Your server
  const router = useRouter();

  const [isloading, setIsloading] = useState(true);
  const [PhoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  // ✅ Check saved session
  useEffect(() => {
    const checkSession = async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        router.replace("/home");
      }
      setIsloading(false);
    };
    checkSession();
  }, []);

  const signIn = async () => {
    try {
      if (!PhoneNumber || !password) {
        Alert.alert("Missing Info", "Please fill in all fields");
        return;
      }

      setLoadingLogin(true);

      const respond = await fetch(`http://${IP}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PhoneNumber, password }),
      });

      const data = await respond.json();

      if (!data.success) {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      } else {
        Alert.alert("Success", "Login successful 🎉");

        // ✅ Save token + user info for Chat
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("phoneNumber", PhoneNumber);

        if (data.user?._id) {
          await AsyncStorage.setItem("userId", data.user._id);
        }

        // clear inputs
        setPhoneNumber("");
        setPassword("");

        router.replace("/home");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong, please try again");
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <View style={styles.main}>
      {isloading ? (
        <ActivityIndicator size="large" color="green" />
      ) : (
        <Animated.View
          entering={FadeInDown.duration(1000)}
          style={{ alignItems: "center" }}
        >
          <Text style={styles.header}>WELCOME TO LINKUP</Text>
          <View style={styles.container_2}>
            <Text style={styles.name}>Phone Number</Text>
            <TextInput
              placeholder="Enter your phone number"
              value={PhoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.NameInput}
              keyboardType="numeric"
            />

            <Text style={styles.name}>Password</Text>
            <TextInput
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              style={styles.NameInput}
              secureTextEntry
            />

            {loadingLogin ? (
              <ActivityIndicator
                size="small"
                color="white"
                style={{ marginVertical: 10 }}
              />
            ) : (
              <Button title="Login" onPress={signIn} />
            )}

            <Text style={{ marginTop: 20 }}>
              <Link href="/signUp" style={{ color: "white", fontWeight: "600" }}>
                Don’t have an account? Signup
              </Link>
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  container_2: {
    alignContent: "center",
    justifyContent: "center",
    alignItems: "center",
    height: 400,
    width: 350,
    backgroundColor: "#05a31dff",
    borderRadius: 8,
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 60,
  },
  name: {
    alignSelf: "flex-start",
    marginTop: 20,
    fontSize: 16,
    fontWeight: "500",
    color: "#060615ff",
    marginLeft: 50,
  },
  NameInput: {
    padding: 10,
    height: 40,
    width: 250,
    backgroundColor: "#c5ceddff",
    borderRadius: 10,
    color: "#060615ff",
    marginBottom: 10,
  },
});
