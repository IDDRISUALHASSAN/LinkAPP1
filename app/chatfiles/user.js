import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

const { width, height } = Dimensions.get("window");

export default function UserProfileScreen() {
  const { phone } = useLocalSearchParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullView, setIsFullView] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(null);
  const IP = "10.176.143.51:3000";

  // Fetch user info
  useEffect(() => {
    fetch(`http://${IP}/user-info/${phone}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [phone]);

  const handleTap = () => {
    // single tap pulse animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
      // double tap detected → open full view
      setIsFullView(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      lastTap.current = now;
      handleTap();
    }
  };

  const handleCloseFullView = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setIsFullView(false));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6a22b1ff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#666" }}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Picture */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <Animated.View
          style={[styles.imageWrapper, { transform: [{ scale: scaleAnim }] }]}
        >
          <Image
            source={{ uri: user.profilePic || "https://placehold.co/200x200" }}
            style={styles.profileImage}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.phone}>{user.PhoneNumber}</Text>

      {/* Full-screen Image Overlay */}
      {isFullView && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={handleCloseFullView}>
            <View style={styles.fullViewContainer}>
              <Image
                source={{
                  uri: user.profilePic || "https://placehold.co/400x400",
                }}
                style={styles.fullImage}
              />
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f4ff",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  imageWrapper: {
    borderRadius: 100,
    padding: 6,
    backgroundColor: "#fff",
    elevation: 10,
    shadowColor: "#6a22b1ff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  profileImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#6a22b1ff",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3a1c73ff",
    marginTop: 20,
  },
  phone: {
    fontSize: 17,
    color: "#666",
    marginTop: 5,
  },
  overlay: {
    position: "absolute",
    width,
    height,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  fullViewContainer: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: 15,
    resizeMode: "contain",
  },
});
