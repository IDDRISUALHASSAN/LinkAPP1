import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { registerCurrentDeviceForPush } from "../app/services/notifications";

const API_URL = Constants.expoConfig.extra.API_URL;

const handleNotificationReceived = (notification) => {
  console.log("Notification received:", notification.request?.content?.title);
};

const handleNotificationResponse = (response, router) => {
  try {
    const data = response?.notification?.request?.content?.data;
    const chatId = data?.senderId || data?.chatId;
    if (!chatId) return;

    router.push({
      pathname: "/chatfiles/chat",
      params: { receiverId: String(chatId) },
    });
  } catch (error) {
    console.warn("Notification navigation failed:", error);
  }
};

export default function usePushNotifications() {
  const router = useRouter();
  const onResponse = useCallback(
    (response) => handleNotificationResponse(response, router),
    [router],
  );

  useEffect(() => {
    registerCurrentDeviceForPush(API_URL).catch((error) => {
      console.warn("Push notification registration failed:", error);
    });

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
}
