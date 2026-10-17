import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const NOTIFICATION_CHANNEL = "default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;

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
      Constants?.eas?.projectId ||
      Constants?.expoConfig?.eas?.projectId ||
      Constants?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await AsyncStorage.setItem("pushToken", token);
    return token;
  } catch (error) {
    console.error("Failed to get Expo push token:", error);
    return null;
  }
}

export async function registerPushTokenWithBackend(
  token,
  apiUrl,
  { userId, phoneNumber, authToken } = {},
) {
  if (!token || !apiUrl) return false;
  if (!userId && !phoneNumber) return false;

  try {
    const response = await fetch(`${apiUrl}/save-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ phoneNumber, expoPushToken: token }),
    });

    if (!response.ok) return false;
    return (await response.json()).success === true;
  } catch (error) {
    console.warn("Push token registration failed:", error);
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

  if (!userId && !phoneNumber) return false;

  const pushToken = await registerForPushNotificationsAsync();
  return registerPushTokenWithBackend(pushToken, apiUrl, {
    userId,
    phoneNumber,
    authToken,
  });
}
