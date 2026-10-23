import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig.extra.API_URL;

export { API_URL };

export async function getAuthHeaders() {
  const token = await AsyncStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
}

export async function getUserId() {
  return await AsyncStorage.getItem("userId");
}

export async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const error = new Error(data.message || `Request failed with ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function getThumbnailUrl(originalUrl) {
  if (!originalUrl) return null;
  return originalUrl.replace(/\.(mp4|mov|webm)$/i, "_thumb.jpg");
}

export async function uploadWithProgress(formData, onProgress, cancelRef) {
  const token = await AsyncStorage.getItem("token");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (cancelRef && typeof cancelRef === "object") {
      cancelRef.current = xhr;
    }

    if (typeof onProgress === "function") {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress((e.loaded / e.total) * 100);
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = { success: true };
        }
        resolve({ status: xhr.status, data });
      } else {
        let errData;
        try {
          errData = JSON.parse(xhr.responseText);
        } catch {
          errData = { message: xhr.responseText };
        }
        const error = new Error(errData.message || `Upload failed (${xhr.status})`);
        error.status = xhr.status;
        error.data = errData;
        reject(error);
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.open("POST", `${API_URL}/videos`);
    xhr.setRequestHeader("Authorization", token ? `Bearer ${token}` : "");
    xhr.send(formData);
  });
}
