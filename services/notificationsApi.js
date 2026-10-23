import { apiRequest } from "./api";

export async function fetchNotifications(cursor = null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/notifications?${params.toString()}`);
}

export async function countUnreadNotifications() {
  return apiRequest("/notifications/unread-count");
}

export async function markNotificationsRead(notificationIds) {
  return apiRequest("/notifications/read", {
    method: "POST",
    body: JSON.stringify({ ids: notificationIds }),
  });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/mark-all-read", { method: "POST" });
}
