import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from './services/notifications';


// --- Helpers ---

const handleNotificationReceived = (notification) => {
  console.log('Notification Received:', notification);
};

const handleNotificationResponse = (response, router) => {
  console.log('Notification Clicked:', response);

  try {
    const chatId = response?.notification?.request?.content?.data?.chatId;

    if (!chatId) return;

    // Safely convert to string — guards against Symbol, null, undefined
    const safeId = typeof chatId === 'string' ? chatId : JSON.stringify(chatId);

    router.push({
      pathname: "/chatfiles/chat",
      params: { receiverId: safeId },
    });
  } catch (error) {
    console.warn('Notification navigation failed:', error.message);
  }
};

// --- Hook ---

const usePushNotifications = () => {
  const router = useRouter();

  const onResponse = useCallback(
    (response) => handleNotificationResponse(response, router),
    [router]
  );

  useEffect(() => {
    registerForPushNotificationsAsync();

    const notificationListener =
      Notifications.addNotificationReceivedListener(handleNotificationReceived);

    const responseListener =
      Notifications.addNotificationResponseReceivedListener(onResponse);

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [onResponse]);
};

export default usePushNotifications;