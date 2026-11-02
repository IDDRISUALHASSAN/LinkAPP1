import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { normalizeVideoId } from "@/services/videos";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/services/notificationsApi";
import {
  decrementUnread,
  resetUnread as resetGlobalUnread,
} from "@/services/unreadStore";

const TYPE_ICONS = {
  like: "❤️",
  comment: "💬",
  reply: "↪️",
  comment_like: "❤️",
  follow: "👤",
};

function getNotificationId(notification) {
  return normalizeVideoId(notification?.id ?? notification?._id) || "";
}

function getNotificationActor(notification) {
  const actor =
    notification?.actor ||
    notification?.sender ||
    notification?.user ||
    notification?.fromUser ||
    notification?.from ||
    {};

  return {
    id:
      actor.id ??
      actor._id ??
      notification?.userId ??
      notification?.senderId ??
      notification?.actorId,
    name:
      actor.name ||
      actor.username ||
      actor.displayName ||
      actor.fullName ||
      notification?.actorName ||
      notification?.senderName ||
      notification?.userName ||
      notification?.username ||
      notification?.name ||
      "Someone",
    avatar:
      actor.profilePic ||
      actor.avatar ||
      actor.profileImage ||
      notification?.avatar ||
      notification?.profilePic ||
      "",
  };
}

function getNotificationVideoId(notification) {
  return normalizeVideoId(
    notification?.videoId ??
      notification?.video?._id ??
      notification?.video?.id ??
      notification?.target?.videoId ??
      notification?.targetVideoId,
  );
}

function getNotificationText(notification, actorName) {
  if (notification?.text || notification?.message) {
    return notification.text || notification.message;
  }

  const action = {
    like: "liked your video",
    comment: "commented on your video",
    reply: "replied to your comment",
    comment_like: "liked your comment",
    follow: "started following you",
    }[notification?.type || notification?.notificationType];

  return action ? `${actorName} ${action}` : `${actorName} sent you a notification`;
}

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
  const [loadError, setLoadError] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const initialLoadRef = useRef(false);

  const loadNotifications = useCallback(
    async (reset = false) => {
      if (reset) {
        setRefreshing(true);
        setLoading(true);
        setCursor(null);
        setNotifications([]);
        setHasMore(true);
        setLoadError(null);
      } else if (!hasMore || loading) {
        return;
      }

      try {
        const data = await fetchNotifications(reset ? null : cursor, 20);
        const newNotifications = Array.isArray(data.notifications)
          ? data.notifications
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.items)
              ? data.items
              : [];
        const nextCursor = data.nextCursor || data.cursor || data.next || null;

        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);

        const unread = {};
        newNotifications.forEach((n) => {
          const notificationId = getNotificationId(n);
          if (notificationId && !n.read) unread[notificationId] = true;
        });
        if (reset) {
          setUnreadMap(unread);
        } else {
          setUnreadMap((prev) => ({ ...prev, ...unread }));
        }
        setLoadError(null);
      } catch (_err) {
        console.error("Load notifications error:", _err);
        setLoadError(_err?.message || "Unable to load notifications.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursor, hasMore, loading],
  );

  useEffect(() => {
    // The callback also depends on pagination state. Guard the initial load so
    // callback identity changes do not restart the first page request.
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    loadNotifications(true);
  }, [loadNotifications]);

  const handleNotificationPress = async (notification) => {
    const notificationId = getNotificationId(notification);
    const wasUnread = unreadMap[notificationId] !== false && !notification.read;
    setUnreadMap((prev) => ({ ...prev, [notificationId]: false }));

    try {
      if (wasUnread && notificationId) {
        await markNotificationsRead([notificationId]);
        decrementUnread();
      }
    } catch (_err) {
      console.error("Mark read error:", _err);
      if (wasUnread) {
        setUnreadMap((prev) => ({ ...prev, [notificationId]: true }));
      }
    }

    const type = notification?.type || notification?.notificationType;
    const videoId = getNotificationVideoId(notification);
    const actor = getNotificationActor(notification);
    const userId = normalizeVideoId(actor.id);

    if (videoId) {
      const isCommentType =
        type === "comment" || type === "reply" || type === "comment_like";
      router.push({
        pathname: "/(screens)/video/[id]",
        params: {
          id: videoId,
          openComments: isCommentType ? "true" : "false",
        },
      });
    } else if (userId) {
      router.push({
        pathname: "/(drawer)/profile",
        params: { userId: String(userId) },
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const allRead = {};
      notifications.forEach((n) => {
        const notificationId = getNotificationId(n);
        if (notificationId) allRead[notificationId] = false;
      });
      setUnreadMap(allRead);
      resetGlobalUnread();
    } catch (_err) {
      console.error("Mark all read error:", _err);
    }
  };

  const renderItem = ({ item }) => {
    const notificationId = getNotificationId(item);
    const actor = getNotificationActor(item);
    const type = item?.type || item?.notificationType;
    const isUnread = unreadMap[notificationId] !== false && !item.read;
    const icon = TYPE_ICONS[type] || "🔔";
    const notificationText = getNotificationText(item, actor.name);

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
              <UserAvatar uri={actor.avatar} size={44} />
              {icon ? <Text style={styles.typeIcon}>{icon}</Text> : null}
            </View>
          )}

          <View style={styles.textContainer}>
            <Text
              style={[
                styles.actorName,
                { color: isDark ? "#fff" : "#222" },
                isUnread && { fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {actor.name}
            </Text>
            <Text
              style={[
                styles.notificationText,
                { color: isDark ? "#fff" : "#333" },
                isUnread && { fontWeight: "600" },
              ]}
            >
              {notificationText}
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
        {notifications.some(
          (n) => unreadMap[getNotificationId(n)] !== false && !n.read,
        ) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Check size={20} color="#05a31dff" />
          </TouchableOpacity>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#05a31dff" />
        </View>
      ) : loadError && notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: isDark ? "#bbb" : "#555" }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadNotifications(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
          keyExtractor={(item, index) =>
            getNotificationId(item) || `notification-${index}`
          }
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
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#05a31dff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
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
  actorName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
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
