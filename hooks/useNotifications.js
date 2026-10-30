import { useState, useEffect, useCallback } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { isAuthError, clearAuth } from "../services/api";
import { countUnreadNotifications, markAllNotificationsRead } from "../services/notificationsApi";
import { initSocket, onNotification } from "../services/socket";
import {
  setUnreadCount as setGlobalUnreadCount,
  incrementUnread as incrementGlobalUnread,
  resetUnread as resetGlobalUnread,
  useUnreadCount as useGlobalUnreadCount,
} from "../services/unreadStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function useNotifications() {
  const router = useRouter();
  const [socketReady, setSocketReady] = useState(false);

  const handleAuthError = useCallback(async () => {
    await clearAuth();
    router.replace("/(screens)");
  }, [router]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const data = await countUnreadNotifications();
      const count = data.count || data.unreadCount || data.unread || 0;
      setGlobalUnreadCount(count);
    } catch (err) {
      if (isAuthError(err)) {
        await handleAuthError();
      } else {
        console.error("Unread count error:", err);
      }
    }
  }, [handleAuthError]);

  const markAllRead = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      await markAllNotificationsRead();
      resetGlobalUnread();
    } catch (err) {
      if (isAuthError(err)) {
        await handleAuthError();
      } else {
        console.error("Mark all read error:", err);
      }
    }
  }, [handleAuthError]);

  const initSocketConnection = useCallback(async () => {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    initSocket(userId);
    setSocketReady(true);

    onNotification(() => {
      incrementGlobalUnread();
      fetchUnreadCount();
    });
  }, [fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    initSocketConnection();

    const appStateListener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchUnreadCount();
      }
    });

    return () => {
      appStateListener.remove();
    };
  }, [fetchUnreadCount, initSocketConnection]);

  return {
    unreadCount: useGlobalUnreadCount(),
    fetchUnreadCount,
    markAllRead,
    socketReady,
  };
}
