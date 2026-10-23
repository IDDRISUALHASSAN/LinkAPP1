import { useState, useEffect, useCallback } from "react";
import { AppState } from "react-native";
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
  const [socketReady, setSocketReady] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await countUnreadNotifications();
      const count = data.count || data.unreadCount || data.unread || 0;
      setGlobalUnreadCount(count);
    } catch (_err) {
      console.error("Unread count error:", _err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      resetGlobalUnread();
    } catch (_err) {
      console.error("Mark all read error:", _err);
    }
  }, []);

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
