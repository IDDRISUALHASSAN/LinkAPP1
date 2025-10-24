import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const API = "http://10.176.143.51:3000";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // 🔹 Fade-in animation for smooth load
  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  // 🔹 Fetch user profile
  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        fadeIn();
      } else {
        Alert.alert("Error", data.message || "Failed to load profile");
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  
  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera roll access is needed.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        uploadImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Image pick error:", err);
    }
  };

  
  const uploadImage = async (uri) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const formData = new FormData();
      formData.append("picture", {
        uri,
        name: "profile.jpg",
        type: "image/jpeg",
      });

      const res = await fetch(`${API}/profilepic`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUser((prev) => ({ ...prev, profilePic: data.imageUrl }));
        fadeIn();
        Alert.alert(" Success", "Profile picture updated!");
      } else {
        Alert.alert(" Upload failed", data.message || "Try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Error", "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.avatarWrapper, { opacity: fadeAnim }]}>
        <Image
          source={
            user.profilePic
              ? { uri: user.profilePic }
              : require("../../assets/images/avatar.png")
          }
          style={styles.avatar}
        />

        {/* Camera icon */}
        <TouchableOpacity style={styles.cameraIcon} onPress={pickImage}>
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="camera" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.name}>{user?.name ?? "No Name"}</Text>
      <Text style={styles.phone}>{user?.PhoneNumber ?? "No Phone"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    paddingTop: 50,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarWrapper: {
    position: "relative",
    borderWidth: 3,
    borderColor: "#007bff",
    borderRadius: 80,
    padding: 3,
    shadowColor: "#007bff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#2aed54ff",
    borderRadius: 20,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 15,
    color: "#333",
  },
  phone: { fontSize: 16, color: "#555", marginTop: 5 },
});
