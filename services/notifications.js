import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

const Notifications =
  Platform.OS !== "web" ? require("expo-notifications") : null;

const NOTIFICATION_CHANNEL = "default";
let activeChatId = null;

export function setActiveNotificationChat(chatId) {
  activeChatId = chatId ? String(chatId) : null;
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request?.content?.data;
      const notificationChatId = data?.senderId || data?.chatId;
      const isOpenChat =
        activeChatId && String(notificationChatId) === activeChatId;

      return {
        shouldShowBanner: !isOpenChat,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice || !Notifications) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: "LinkApp notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#05A31D",
    }).catch((error) => {
      console.warn("Notification channel setup failed:", error);
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus === "granted"
      ? existingStatus
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") {
    console.warn("Notifications are not granted.");
    return null;
  }

  try {
    const projectId =
      Constants?.easConfig?.projectId ||
      Constants?.eas?.projectId ||
      Constants?.expoConfig?.eas?.projectId ||
      Constants?.expoConfig?.extra?.eas?.projectId;
    console.log("[Push] projectId:", projectId ? "found" : "NOT FOUND");
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    console.log("[Push] Expo token generated:", token?.slice(0, 12) + "...");
    await AsyncStorage.setItem("pushToken", token);
    return token;
  } catch (error) {
    console.error("[Push] Failed to get Expo push token:", error.message || error);
    if (
      error.message?.includes("Expo Go") ||
      error.message?.includes("Development build")
    ) {
      console.error(
        "[Push] *** ANDROID EXPO GO LIMITATION *** Push tokens do not work in Expo Go on Android (SDK 53+). Build a development client with: eas build --profile development --platform android",
      );
    }
    return null;
  }
}

export async function registerPushTokenWithBackend(
  token,
  apiUrl,
  { phoneNumber, authToken } = {},
) {
  if (
    !token ||
    typeof token !== "string" ||
    !/^(Expo|Exponent)PushToken\[[^\]]+\]$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    console.warn(
      "Push token registration skipped: token format is invalid.",
      token ? `token="${token}"` : "token is null/undefined",
    );
    return false;
  }
  if (!apiUrl || !phoneNumber) return false;

  try {
    console.log("[Push] Registering token for phoneNumber:", phoneNumber);
    const response = await fetch(`${apiUrl}/save-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ phoneNumber, expoPushToken: token }),
    });

    console.log("[Push] /save-token response status:", response.status);

    if (!response.ok) {
      const body = await response.text();
      console.warn(
        "[Push] /save-token failed:",
        response.status,
        body.substring(0, 200),
      );
      return false;
    }
    const data = await response.json();
    console.log("[Push] /save-token success:", data.message);
    if (data.success !== true) {
      console.warn("Push token registration was not accepted by the server.");
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Push token registration request failed:", error.message);
    return false;
  }
}

export async function registerCurrentDeviceForPush(apiUrl, user = {}) {
  const storedUserId = await AsyncStorage.getItem("userId");
  const storedPhoneNumber = await AsyncStorage.getItem("phoneNumber");
  const authToken =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("userToken"));
  const userId = user.userId || storedUserId;
  const phoneNumber = user.phoneNumber || storedPhoneNumber;

  console.log("[Push] registerCurrentDeviceForPush", {
    hasUserId: !!userId,
    hasPhoneNumber: !!phoneNumber,
    hasAuthToken: !!authToken,
    hasApiUrl: !!apiUrl,
  });

  if (!userId && !phoneNumber) {
    console.log("[Push] No userId or phoneNumber — not registered yet");
    return false;
  }

  const pushToken = await registerForPushNotificationsAsync();
  if (!pushToken) {
    console.warn("[Push] Could not obtain Expo push token — skipping registration");
    return false;
  }
  return registerPushTokenWithBackend(pushToken, apiUrl, {
    userId,
    phoneNumber,
    authToken,
  });
}
