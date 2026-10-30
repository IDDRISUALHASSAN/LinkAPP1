import * as FileSystem from "expo-file-system";
import { cacheDirectory } from "expo-file-system";
import { Platform } from "react-native";
import { apiRequest, uploadWithProgress } from "./api";

export function normalizeVideoId(value) {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized || null;
  }

  if (value && typeof value === "object" && typeof value.$oid === "string") {
    const normalized = value.$oid.trim();
    return normalized || null;
  }

  return null;
}

export function normalizeVideo(video) {
  if (!video || typeof video !== "object") return null;

  const id =
    normalizeVideoId(video.id) ?? normalizeVideoId(video._id);
  return id ? { ...video, id } : null;
}

function requireVideoId(videoId) {
  const normalizedId = normalizeVideoId(videoId);
  if (!normalizedId) throw new Error("Invalid video ID");
  return normalizedId;
}

export async function fetchVideos(cursor = null, limit = 10) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/videos?${params.toString()}`);
}

export async function fetchVideo(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}`);
}

export async function likeVideo(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}/like`, {
    method: "POST",
  });
}

export async function unlikeVideo(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}/like`, {
    method: "DELETE",
  });
}

export async function shareVideo(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}/share`, {
    method: "POST",
  });
}

export async function followUploader(userId) {
  return apiRequest(`/users/${userId}/follow`, { method: "POST" });
}

export async function unfollowUploader(userId) {
  return apiRequest(`/users/${userId}/follow`, { method: "DELETE" });
}

export async function getVideoDownloadUrl(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}/download`);
}

export async function downloadAndSaveVideo(videoId, onProgress) {
  const normalizedId = requireVideoId(videoId);
  const { downloadUrl } = await getVideoDownloadUrl(normalizedId);
  if (!downloadUrl) throw new Error("Could not get download URL");

  if (Platform.OS === "web") {
    if (typeof document === "undefined") {
      throw new Error("Video downloads are only available in a browser.");
    }

    const filename = `linkapp-video-${normalizedId}.mp4`;
    let fileUrl = downloadUrl;
    let shouldRevokeUrl = false;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Could not download video data.");
      fileUrl = URL.createObjectURL(await response.blob());
      shouldRevokeUrl = true;
    } catch (error) {
      console.warn(
        "Blob download unavailable; opening video URL instead:",
        error,
      );
    }

    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename;
    if (!shouldRevokeUrl) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (shouldRevokeUrl) {
      setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    }
    onProgress?.(100);
    return { success: true, web: true };
  }

  const filename =
    downloadUrl.substring(downloadUrl.lastIndexOf("/") + 1) ||
    `linkapp_video_${Date.now()}.mp4`;

  const cachePath = `${cacheDirectory}${filename}`;
  const downloadRes = await FileSystem.downloadAsync(downloadUrl, cachePath);

  if (!downloadRes || !downloadRes.uri) {
    throw new Error("Download failed");
  }

  let progress = 100;
  if (onProgress) {
    try {
      const info = await FileSystem.getInfoAsync(downloadRes.uri);
      progress = info.exists ? 100 : 0;
      onProgress(progress);
    } catch {
      onProgress(100);
    }
  }

  let MediaLibrary;
  if (Platform.OS !== "web") {
    MediaLibrary = require("expo-media-library");
  }
  if (!MediaLibrary) {
    throw new Error(
      "Saving to media library is not supported on this platform",
    );
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Media library permission denied");
  }

  const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
  await MediaLibrary.createAlbumAsync("LinkApp Videos", asset, false);

  return { success: true, asset };
}

export async function deleteVideo(videoId) {
  const normalizedId = requireVideoId(videoId);
  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}`, {
    method: "DELETE",
  });
}

export async function fetchUserVideos(userId) {
  return apiRequest(`/users/${userId}/videos`);
}

export async function fetchUserProfile(userId) {
  return apiRequest(`/users/${userId}`);
}

export { uploadWithProgress };
