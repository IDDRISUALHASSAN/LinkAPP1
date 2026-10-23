import { apiRequest, uploadWithProgress } from "./api";
import * as FileSystem from "expo-file-system";
import { cacheDirectory } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export async function fetchVideos(cursor = null, limit = 10) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/videos?${params.toString()}`);
}

export async function fetchVideo(videoId) {
  return apiRequest(`/videos/${videoId}`);
}

export async function likeVideo(videoId) {
  return apiRequest(`/videos/${videoId}/like`, { method: "POST" });
}

export async function unlikeVideo(videoId) {
  return apiRequest(`/videos/${videoId}/like`, { method: "DELETE" });
}

export async function shareVideo(videoId) {
  return apiRequest(`/videos/${videoId}/share`, { method: "POST" });
}

export async function followUploader(userId) {
  return apiRequest(`/users/${userId}/follow`, { method: "POST" });
}

export async function unfollowUploader(userId) {
  return apiRequest(`/users/${userId}/follow`, { method: "DELETE" });
}

export async function getVideoDownloadUrl(videoId) {
  return apiRequest(`/videos/${videoId}/download`);
}

export async function downloadAndSaveVideo(videoId, onProgress) {
  const { downloadUrl } = await getVideoDownloadUrl(videoId);
  if (!downloadUrl) throw new Error("Could not get download URL");

  const filename = downloadUrl.substring(downloadUrl.lastIndexOf("/") + 1) || `linkapp_video_${Date.now()}.mp4`;

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Media library permission denied");
  }

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

  const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
  await MediaLibrary.createAlbumAsync("LinkApp Videos", asset, false);

  return { success: true, asset };
}

export async function deleteVideo(videoId) {
  return apiRequest(`/videos/${videoId}`, { method: "DELETE" });
}

export async function fetchUserVideos(userId) {
  return apiRequest(`/users/${userId}/videos`);
}

export async function fetchUserProfile(userId) {
  return apiRequest(`/users/${userId}`);
}

export { uploadWithProgress };
