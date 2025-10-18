import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Pressable,
  Image,
} from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

export default function Chat() {
  const { receiverId, receiverName, profilePic } = useLocalSearchParams();
  const IP = "10.223.221.51:3000";

  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastAnimatedIndex, setLastAnimatedIndex] = useState(-1);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  // Checks content-type before parsing JSON to avoid "Unexpected character: <"
  const safeFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";

    // If non-OK, return text or json for debugging
    if (!res.ok) {
      const body = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
      console.warn("safeFetch non-OK response:", res.status, body);
      throw { status: res.status, body };
    }

    if (contentType.includes("application/json")) return res.json();
    return res.text();
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedPhone = await AsyncStorage.getItem("phoneNumber");
        if (storedPhone) {
          setUserId(storedPhone);
          console.log("Loaded phoneNumber from storage:", storedPhone);
        } else {
          Alert.alert("Error", "User not logged in properly.");
          console.warn("phoneNumber missing in AsyncStorage");
        }
      } catch (err) {
        console.error("AsyncStorage error:", err);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!receiverId) {
      console.warn(
        "No receiverId provided — skipping socket connect until params exist"
      );
      return;
    }

    const newSocket = io(`http://${IP}`, { transports: ["websocket"] });
    setSocket(newSocket);

    console.log("Socket connecting, login emit:", userId);
    newSocket.emit("login", userId);
    newSocket.emit("loadHistory", { from: userId, to: receiverId });

    newSocket.on("history", (history) => {
      console.log(
        "history received:",
        Array.isArray(history) ? history.length : typeof history
      );
      setMessages(history || []);
      setLastAnimatedIndex((history && history.length - 1) || -1);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    });

    newSocket.on("message", (msg) => {
      console.log("socket message received:", msg && msg._id ? msg._id : msg);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    newSocket.on("typing", (payload) => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 1500);
    });

    newSocket.on("messagesRead", (payload) => {
      console.log("messagesRead event:", payload);
    });

    const markRead = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        // use safeFetch to avoid JSON parsing errors for non-json responses
        const data = await safeFetch(`http://${IP}/messages/mark-read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined,
          },
          body: JSON.stringify({ from: receiverId, to: userId }),
        });

        if (data && data.success) {
          console.log("Marked read:", data.modifiedCount);
          newSocket?.emit("messagesRead", { from: receiverId, to: userId });
        } else {
          console.warn("mark-read response:", data);
        }
      } catch (err) {
        console.warn("mark-read failed:", err);
      }
    };
    markRead();

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
    // We only want to re-run this effect when userId or receiverId change
  }, [userId, receiverId]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const sendMessage = () => {
    if (!input.trim() || !socket || !userId) {
      triggerShake();
      return;
    }

    const msg = {
      from: userId,
      to: receiverId,
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.emit("message", msg);
    setMessages((prev) => [...prev, msg]);
    setInput("");
    setLastAnimatedIndex((prev) => prev + 1);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const deleteMessage = async (id) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Not authenticated. Please log in again.");
        return;
      }
      const data = await safeFetch(`http://${IP}/messages/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("deleteMessage response:", data);
      if (data && data.success) {
        setMessages((prev) => prev.filter((msg) => msg._id !== id));
      } else {
        Alert.alert("Delete failed", (data && data.message) || "Unknown error");
      }
    } catch (err) {
      console.error("Error deleting:", err);
      if (err && err.body) {
        const text = typeof err.body === "string" ? err.body : JSON.stringify(err.body);
        Alert.alert("Delete error", text);
      } else {
        Alert.alert("Delete error", "Check console for details");
      }
    }
  };

  const AnimatedMessage = ({ item, isMine, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
      if (index > lastAnimatedIndex) {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        setLastAnimatedIndex(index);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const animatedStyle =
      index > lastAnimatedIndex ? { opacity: fadeAnim, transform: [{ translateY: slideAnim }] } : {};

    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onLongPress={() =>
            Alert.alert("Delete", "Do you want to delete this message?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deleteMessage(item._id) },
            ])
          }
          delayLongPress={400}
        >
          <View style={[styles.messageBox, isMine ? styles.myMessage : styles.theirMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp || item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.headerContainer}>
  {profilePic ? (
    <Image
      source={{ uri: profilePic }}
      style={styles.profilePic}
    />
  ) : (
    <Image
      source={require("../../assets/images/avatar.png")} // make sure you have an avatar image
      style={styles.profilePic}
    />
  )}
  <View>
    <Text style={styles.receiverName}>{receiverName || "User"}</Text>
    <Text style={styles.receiverStatus}>Online</Text>
  </View>
</View>


      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item, index }) => (
          <AnimatedMessage item={item} isMine={item.from === userId} index={index} />
        )}
        contentContainerStyle={{ paddingBottom: 10 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && <Text style={styles.typingIndicator}>{`${receiverName || "User"} is typing...`}</Text>}

      <View style={styles.inputContainer}>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }], flex: 1 }}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              socket?.emit("typing", receiverId);
            }}
            placeholder="Type a message..."
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
        </Animated.View>
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>👉</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    fontSize: 20,
    fontWeight: "600",
    paddingVertical: 18,
    color: "#fff",
    textAlign: "center",
    elevation: 4,
    paddingHorizontal: 12,
  },
  /* added headerContainer and profile/receiver styles used in JSX */
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#6a22b1ff",
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    backgroundColor: "#ddd",
  },
  receiverName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  receiverStatus: {
    color: "#e6e6e6",
    fontSize: 12,
  },
  typingIndicator: {
    fontStyle: "italic",
    color: "#555",
    textAlign: "center",
    marginBottom: 6,
  },
  messageBox: {
    maxWidth: "75%",
    marginVertical: 6,
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 16,
    shadowColor: "#413c3cff",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  myMessage: { backgroundColor: "#6a22b1ff", alignSelf: "flex-end" },
  theirMessage: { backgroundColor: "#9e4d4dff", alignSelf: "flex-start" },
  messageText: { fontSize: 16, color: "#fff" },
  timestamp: { fontSize: 11, color: "#d1d1d1", marginTop: 4, textAlign: "right" },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#18d82eff",
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
