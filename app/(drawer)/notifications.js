import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import UserAvatar from "@/components/UserAvatar";
import {
  fetchNotifications,
  markAllNotificationsRead,
} from "@/services/notificationsApi";
import {
  setUnreadCount as setGlobalUnreadCount,
  resetUnread as resetGlobalUnread,
} from "@/services/unreadStore";

const TYPE_ICONS = {
  like: "❤️",
  comment: "💬",
  reply: "↪️",
  comment_like: "❤️",
  follow: "👤",
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [notifications, setNotifications] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});

  const loadNotifications = useCallback(
    async (reset = false) => {
      if (reset) {
        setRefreshing(true);
        setCursor(null);
        setNotifications([]);
        setHasMore(true);
      } else if (!hasMore || loading) {
        return;
      }

      try {
        const data = await fetchNotifications(reset ? null : cursor, 20);
        const newNotifications = data.notifications || data.data || [];
        const nextCursor = data.nextCursor || data.cursor || null;

        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);

        const unread = {};
        newNotifications.forEach((n) => {
          if (!n.read) unread[n.id] = true;
        });
        if (reset) {
          setUnreadMap(unread);
        } else {
          setUnreadMap((prev) => ({ ...prev, ...unread }));
        }

        const unreadCount = newNotifications.filter((n) => !n.read).length;
        setGlobalUnreadCount(unreadCount);
      } catch (_err) {
        console.error("Load notifications error:", _err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursor, hasMore, loading],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications(true);
  }, [loadNotifications]);

  const handleNotificationPress = async (notification) => {
    setUnreadMap((prev) => ({ ...prev, [notification.id]: false }));

    try {
      await markAllNotificationsRead([notification.id]);
      const remaining = notifications.filter(
        (n) => n.id !== notification.id && !n.read,
      ).length;
      setGlobalUnreadCount(remaining);
    } catch (_err) {
      console.error("Mark read error:", _err);
    }

    const { type, videoId } = notification;

    if (type && videoId) {
      const isCommentType =
        type === "comment" || type === "reply" || type === "comment_like";
      router.push({
        pathname: "/(screens)/video/[id]",
        params: {
          id: videoId,
          openComments: isCommentType ? "true" : "false",
        },
      });
    } else if (notification.userId) {
      router.push({
        pathname: "/(drawer)/profile",
        params: { userId: notification.userId },
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const allRead = {};
      notifications.forEach((n) => {
        allRead[n.id] = false;
      });
      setUnreadMap(allRead);
      resetGlobalUnread();
    } catch (_err) {
      console.error("Mark all read error:", _err);
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = unreadMap[item.id] !== false && !item.read;
    const icon = TYPE_ICONS[item.type] || "🔔";

     return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          {
            backgroundColor: isDark ? "#121212" : "#fff",
            borderBottomColor: isDark ? "#222" : "#eee",
          },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          {item.videoThumbnail ? (
            <View style={styles.thumbnailWrap}>
              <UserAvatar uri={item.videoThumbnail} size={44} />
              {icon ? <Text style={styles.typeIcon}>{icon}</Text> : null}
            </View>
          ) : (
            <View style={styles.avatarWrap}>
              <UserAvatar uri={item.avatar} size={44} />
              {icon ? <Text style={styles.typeIcon}>{icon}</Text> : null}
            </View>
          )}

          <View style={styles.textContainer}>
            <Text
              style={[
                styles.notificationText,
                { color: isDark ? "#fff" : "#333" },
                isUnread && { fontWeight: "600" },
              ]}
            >
              {item.text || item.title || "New notification"}
            </Text>
            <Text style={[styles.timeText, { color: isDark ? "#888" : "#999" }]}>
              {formatTimeAgo(item.createdAt || item.time)}
            </Text>
          </View>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#05a31dff" />
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#000" : "#f5f5f5",
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#333" }]}>
          Notifications
        </Text>
        {notifications.some((n) => !n.read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Check size={20} color="#05a31dff" />
          </TouchableOpacity>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#05a31dff" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: isDark ? "#888" : "#999" }]}>
            You have no notifications yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNotifications(true)}
              tintColor={isDark ? "#fff" : "#000"}
            />
          }
          onEndReached={() => {
            if (hasMore && !loading) loadNotifications(false);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
    width: 44,
    height: 44,
  },
  thumbnailWrap: {
    position: "relative",
    width: 44,
    height: 44,
  },
  typeIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    fontSize: 16,
    backgroundColor: "#05a31dff",
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 18,
  },
  textContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 12,
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#05a31dff",
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
