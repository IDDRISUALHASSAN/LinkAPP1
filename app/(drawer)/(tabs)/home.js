import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";

  const IP = "10.176.143.51:3000";
export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const router = useRouter();

  // 🔹 Fetch conversations
  const loadConversations = async () => {
    try {
      // read stored value and try to parse (handles both raw strings and JSON)
      const stored = await AsyncStorage.getItem("phoneNumber");
      let phone = null;
      if (stored) {
        try {
          phone = JSON.parse(stored);
        } catch (e) {
          phone = stored;
        }
      }
      if (!phone) return;

      const url = `http://${IP}/conversations/${encodeURIComponent(phone)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log("Failed to fetch conversations:", res.status);
        return;
      }
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.log("Error loading conversations:", error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // 🔹 Re-fetch when returning from chat
  useFocusEffect(
    React.useCallback(() => {
      loadConversations();
    }, [])
  );

  const defaultAvatar =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.phone}
        renderItem={({ item }) => {
          // ✅ Use profilePic from server or fallback avatar
          const imageSource = item.profilePic
            ? { uri: item.profilePic }
            : { uri: defaultAvatar };

          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/chatfiles/chat",
                  params: {
                    receiverId: item.phone,
                    receiverName: item.name,
                  },
                })
              }
            >
              <Image source={imageSource} style={styles.avatar} />

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || item.phone}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage || "No messages yet"}
                </Text>
              </View>

              {/* 🔹 Show unread count if > 0 */}
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
    backgroundColor: "#ddd",
  },
  name: { fontSize: 16, fontWeight: "bold" },
  lastMessage: { color: "#666", marginTop: 4, fontSize: 13 },
  badge: {
    backgroundColor: "red",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontWeight: "bold" },
});
