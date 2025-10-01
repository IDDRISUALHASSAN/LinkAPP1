import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

export default function Chat() {
  const { receiverId, receiverName } = useLocalSearchParams();
  const IP = "http://10.24.105.51:3000";

  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId, setuserId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastAnimatedIndex, setLastAnimatedIndex] = useState(-1);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedPhone = await AsyncStorage.getItem("phoneNumber");
        if (storedPhone) {
          setuserId(storedPhone);
        } else {
          Alert.alert("Error", "User not logged in properly.");
        }
      } catch (err) {
        console.error("AsyncStorage error:", err);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const newSocket = io(IP, { transports: ["websocket"] });
    setSocket(newSocket);

    newSocket.emit("login", userId);
    newSocket.emit("loadHistory", { from: userId, to: receiverId });

    newSocket.on("history", (history) => {
      setMessages(history);
      setLastAnimatedIndex(history.length - 1);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    });

    newSocket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    newSocket.on("typing", () => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 1500);
    });

    return () => newSocket.disconnect();
  }, [userId]);

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
  };

  const AnimatedMessage = ({ item, isMine, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
      if (index > lastAnimatedIndex) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, []);

    const animatedStyle =
      index > lastAnimatedIndex
        ? { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        : {};

    return (
      <Animated.View style={animatedStyle}>
        <View
          style={[
            styles.messageBox,
            isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp || item.createdAt).toLocaleTimeString()}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Text style={styles.header}>Chat with {receiverName}</Text>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <AnimatedMessage item={item} isMine={item.from === userId} index={index} />
        )}
        contentContainerStyle={{ paddingBottom: 10 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <Text style={styles.typingIndicator}>{receiverName} is typing...</Text>
      )}

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
          />
        </Animated.View>
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  header: {
    fontSize: 20,
    fontWeight: "600",
    paddingVertical: 18,
    backgroundColor: "#1e88e5",
    color: "#fff",
    textAlign: "center",
    elevation: 4,
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
  marginHorizontal: 10,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 16,        
  shadowColor: "#000",     
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 3,
  elevation: 2,
},

  myMessage: {
    backgroundColor: "#6a22b1ff",
    alignSelf: "flex-end",
  },
  theirMessage: {
    backgroundColor: "#9e4d4dff",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
    color: "#fff",
  },
  timestamp: {
    fontSize: 11,
    color: "#d1d1d1",
    marginTop: 4,
    textAlign: "right",
  },
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
  sendText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});