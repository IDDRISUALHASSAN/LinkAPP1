import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { registerCurrentDeviceForPush } from "../services/notifications";

const Notifications =
  Platform.OS !== "web" ? require("expo-notifications") : null;

const API_URL = Constants.expoConfig.extra.API_URL;

const handleNotificationReceived = (notification) => {
  console.log("Notification received:", notification.request?.content?.title);
};

const handleNotificationResponse = (response, router) => {
  try {
    const data = response?.notification?.request?.content?.data;

    // Video notification: navigate to the video player
    const videoId = data?.videoId;
    const notifType = data?.type;

    if (videoId && notifType) {
      const id =
        typeof videoId === "string" ? videoId : JSON.stringify(videoId);
      router.push({
        pathname: "/(screens)/video/[id]",
        params: { id },
      });
      return;
    }

    // Chat notification: navigate to chat
    const chatId = data?.senderId || data?.chatId;
    if (!chatId) return;

    router.push({
      pathname: "/chatfiles/chat",
      params: { receiverId: String(chatId) },
    });
  } catch (error) {
    console.warn("Notification navigation failed:", error.message);
  }
};

export default function usePushNotifications() {
  const router = useRouter();
  const onResponse = useCallback(
    (response) => handleNotificationResponse(response, router),
    [router],
  );

  useEffect(() => {
    if (!Notifications) return;
    const receivedListener = Notifications.addNotificationReceivedListener(
      handleNotificationReceived,
    );
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(onResponse);

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [onResponse]);

  useEffect(() => {
    if (!Notifications) return;
    const register = () => {
      registerCurrentDeviceForPush(API_URL).catch((error) => {
        console.warn("Push notification registration failed:", error.message);
      });
    };

    register();
    const appStateListener = AppState.addEventListener("change", (state) => {
      if (state === "active") register();
    });

    let tokenListener;
    try {
      tokenListener = Notifications.addPushTokenListener(register);
    } catch (error) {
      console.warn("[Push] addPushTokenListener not available:", error.message);
    }

    return () => {
      appStateListener.remove();
      tokenListener?.remove();
    };
  }, []);
}
