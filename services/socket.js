import { io } from "socket.io-client";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig.extra.API_URL;

let socket = null;
let currentUserId = null;
const listeners = new Map();

export function initSocket(userId) {
  if (!userId) return null;
  if (socket && socket.connected) {
    currentUserId = userId;
    return socket;
  }

  currentUserId = userId;
  socket = io(API_URL, { transports: ["websocket"] });

  socket.on("connect", () => {
    socket.emit("login", userId);
  });

  socket.on("notification", (data) => {
    const callbacks = listeners.get("notification") || [];
    callbacks.forEach((cb) => cb(data));
  });

  socket.on("disconnect", () => {});

  return socket;
}

export function emit(event, payload) {
  if (socket && socket.connected) {
    socket.emit(event, payload);
  }
}

export function onNotification(callback) {
  if (!listeners.has("notification")) {
    listeners.set("notification", []);
  }
  const arr = listeners.get("notification");
  arr.push(callback);
  return () => {
    listeners.set(
      "notification",
      arr.filter((cb) => cb !== callback),
    );
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
}

export function getSocket() {
  return socket;
}
