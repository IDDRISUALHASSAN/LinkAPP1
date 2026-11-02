import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { io } from "socket.io-client";
import {
  Heart,
  Download,
  Check,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
} from "lucide-react-native";
import { setActiveNotificationChat } from "../../services/notifications";
import {
  getCloudinaryAttachmentUrl,
  getPlayableVideoUrl,
} from "../../services/media";
import { downloadMessageFile } from "../../services/videos";

const { width, height } = Dimensions.get("window");

function AudioAttachmentPlayer({ uri }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <TouchableOpacity
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={styles.audioBtn}
    >
      <Text>{status.playing ? "Pause" : "Play"}</Text>
    </TouchableOpacity>
  );
}

function VideoAttachmentPlayer({ uri, style }) {
  const playableUri = getPlayableVideoUrl(uri);
  const player = useVideoPlayer(playableUri || undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("statusChange", (payload) => {
      if (payload.status === "error") {
        setError(payload.error?.message || "Video could not be played.");
      } else if (payload.status === "readyToPlay") {
        setError(null);
      }
    });

    return () => subscription?.remove?.();
  }, [player]);

  if (error) {
    return (
      <TouchableOpacity
        style={[style, styles.videoAttachmentError]}
        onPress={async () => {
          if (!player || !playableUri) return;
          setError(null);
          try {
            await player.replaceAsync(playableUri);
            player.play();
          } catch (retryError) {
            setError(retryError?.message || "Video could not be played.");
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Retry video attachment"
      >
        <Text style={styles.videoAttachmentErrorText}>Tap to retry video</Text>
      </TouchableOpacity>
    );
  }

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls
      contentFit="contain"
      playsInline
    />
  );
}

const isImage = (filename) =>
  /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(filename || "");
const isVideo = (filename) =>
  /\.(mp4|mov|avi|mkv|webm|3gp|3gpp)$/i.test(filename || "");
const isAudio = (filename) =>
  /\.(mp3|m4a|wav|aac|ogg|flac|wma)$/i.test(filename || "");
const isPdf = (filename) => /\.pdf$/i.test(filename || "");

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getSafeFileName = (uri, fileName) => {
  const fallbackName = uri?.split("/").pop()?.split("?")[0] || "download";
  return (fileName || fallbackName).replace(/[\\/:*?\"<>|]/g, "_");
};

const triggerBrowserDownload = (href, name) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const previewPdf = async (uri) => {
  try {
    const fileName = uri.split("/").pop().split("?")[0] || "download";
    const correctedUrl = getCloudinaryAttachmentUrl(uri, fileName) || uri;
    await WebBrowser.openBrowserAsync(correctedUrl);
  } catch (error) {
    console.error("Open PDF error:", error);
    Alert.alert("Could not open PDF", "Download the file to view it.");
  }
};

const downloadFile = async (uri, fileName) => {
  if (!uri) return;
  try {
    const name = getSafeFileName(uri, fileName);
    // For PDFs and raw files, open directly in browser (no fetch needed)
    const isPdfOrRaw =
      name.toLowerCase().endsWith(".pdf") || uri.includes("/raw/upload/");
    if (isPdfOrRaw && Platform.OS === "web") {
      const correctedUrl = getCloudinaryAttachmentUrl(uri, name) || uri;
      const link = document.createElement("a");
      link.href = correctedUrl;
      link.download = name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    const attachmentUrl = getCloudinaryAttachmentUrl(uri, name) || uri;
    const downloadUrls = [...new Set([uri, attachmentUrl])];

    // PDFs uploaded as images need the raw delivery path.
    const fixedUrls = downloadUrls.map((url) => {
      if (
        url.includes("/image/upload/") &&
        name.toLowerCase().endsWith(".pdf")
      ) {
        return url.replace("/image/upload/", "/raw/upload/");
      }
      return url;
    });

    if (Platform.OS === "web") {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }

      let objectUrl = null;
      let lastResponseError = null;
      let shouldUseBrowserFallback = false;

      try {
        for (const downloadUrl of fixedUrls) {
          try {
            const response = await fetch(downloadUrl, {
              mode: "cors",
            });
            if (!response.ok) {
              lastResponseError = new Error(
                `Download failed with HTTP ${response.status}`,
              );
              lastResponseError.status = response.status;
              continue;
            }

            const blob = await response.blob();
            if (!blob.size) throw new Error("The downloaded file is empty.");
            objectUrl = URL.createObjectURL(blob);
            triggerBrowserDownload(objectUrl, name);
            return;
          } catch (requestError) {
            if (requestError?.status !== 401 && requestError?.status !== 403) {
              shouldUseBrowserFallback = true;
            }
            lastResponseError = requestError;
          }
        }

        if (shouldUseBrowserFallback && lastResponseError?.status == null) {
          triggerBrowserDownload(attachmentUrl, name);
          return;
        }

        throw lastResponseError || new Error("Could not download file.");
      } finally {
        if (objectUrl) {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        }
      }
    }

    let downloadedFile;
    let lastDownloadError;
    for (const downloadUrl of fixedUrls) {
      try {
        downloadedFile = await FileSystem.File.downloadFileAsync(
          downloadUrl,
          new FileSystem.File(FileSystem.Paths.document, name),
          { idempotent: true },
        );
        break;
      } catch (error) {
        lastDownloadError = error;
      }
    }

    if (!downloadedFile) {
      throw lastDownloadError || new Error("Could not download file.");
    }

    if (downloadedFile?.uri) {
      Alert.alert("Download complete", `${name} saved to your device.`);
    }
  } catch (error) {
    console.error("File download error:", {
      fileUrl: uri,
      status: error?.status,
      message: error?.message,
    });
    const message =
      error?.status === 401 || error?.status === 403
        ? "The file host denied access. The server must make this file downloadable or provide a signed download link."
        : error?.message || "Could not download file.";
    Alert.alert("Download failed", message);
  }
};

const FileMessage = ({ item }) => {
  const uri = item.fileUrl || item.videoUrl || item.imageUrl || item.audioUrl;
  if (!uri) return null;

  const fileName =
    item.fileName || uri.split("/").pop().split("?")[0] || "file";
  const fileSize = formatFileSize(item.fileSize);

  if (isImage(fileName)) {
    return (
      <View style={styles.filePreview}>
        <Image source={{ uri }} style={styles.fileImage} resizeMode="cover" />
        <FileMeta name={fileName} size={fileSize} />
        <DownloadButton uri={uri} fileName={fileName} />
      </View>
    );
  }
  if (isVideo(fileName)) {
    return (
      <View style={styles.filePreview}>
        <VideoAttachmentPlayer uri={uri} style={styles.fileVideo} />
        <FileMeta name={fileName} size={fileSize} />
        <DownloadButton uri={uri} fileName={fileName} />
      </View>
    );
  }

  if (isAudio(fileName)) {
    return (
      <View style={styles.filePreview}>
        <AudioAttachmentPlayer uri={uri} />
        <FileMeta name={fileName} size={fileSize} />
        <DownloadButton uri={uri} fileName={fileName} />
      </View>
    );
  }

  if (isPdf(fileName)) {
    return (
      <View
        style={[
          styles.fileBox,
          { flexDirection: "row", alignItems: "center", gap: 8 },
        ]}
      >
        <FileText size={24} color="#ff3b30" />
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => previewPdf(uri)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${fileName}`}
        >
          <Text style={styles.fileText}>
            {fileName.length > 30 ? fileName.slice(0, 27) + "..." : fileName}
          </Text>
          {fileSize ? (
            <Text style={styles.fileSizeText}>{fileSize}</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={async () => {
            if (item._id) {
              try {
                const data = await downloadMessageFile(item._id);
                if (data?.downloadUrl) {
                  const link = document.createElement("a");
                  link.href = data.downloadUrl;
                  link.download = data.fileName || fileName;
                  link.target = "_blank";
                  link.rel = "noopener noreferrer";
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }
              } catch (err) {
                console.error("PDF download error:", err);
                Alert.alert("Download failed", "Could not download the PDF.");
              }
            } else {
              downloadFile(uri, fileName);
            }
          }}
          accessibilityLabel={`Download ${fileName}`}
        >
          <Download size={18} color="#666" />
        </TouchableOpacity>
      </View>
    );
  }

  const Icon = isImage(fileName) ? ImageIcon : FileText;
  return (
    <TouchableOpacity
      style={styles.fileBox}
      onPress={() => downloadFile(uri, fileName)}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={20} color="#3b82f6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.fileText}>
            {fileName.length > 30 ? fileName.slice(0, 27) + "..." : fileName}
          </Text>
          {fileSize ? (
            <Text style={styles.fileSizeText}>{fileSize}</Text>
          ) : null}
        </View>
        <Download size={16} color="#666" />
      </View>
    </TouchableOpacity>
  );
};

function FileMeta({ name, size }) {
  return (
    <View style={styles.fileInfoRow}>
      <Text style={styles.fileText}>
        {name.length > 30 ? name.slice(0, 27) + "..." : name}
      </Text>
      {size ? <Text style={styles.fileSizeText}>{size}</Text> : null}
    </View>
  );
}

function DownloadButton({ uri, fileName }) {
  return (
    <TouchableOpacity
      style={styles.downloadBtn}
      onPress={() => downloadFile(uri, fileName)}
      accessibilityLabel={`Download ${fileName}`}
    >
      <Download size={18} color="#666" />
    </TouchableOpacity>
  );
}

export default function Chat() {
  const { receiverId, receiverName, profilePic } = useLocalSearchParams();
  const API_URL = Constants.expoConfig.extra.API_URL;

  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [imageModal, setImageModal] = useState({ visible: false, uri: null });
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    message: null,
  });
  const [copied, setCopied] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);

  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  const guessMimeTypeFromName = (name) => {
    if (!name) return "application/octet-stream";
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      txt: "text/plain",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      mp4: "video/mp4",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
    };
    return map[ext] || "application/octet-stream";
  };

  const getLocalPath = async (uri) => {
    if (!uri.startsWith("content://")) return uri;
    const tempFile = new FileSystem.File(
      FileSystem.Paths.cache,
      `${Date.now()}.tmp`,
    );
    await FileSystem.copyAsync({ from: uri, to: tempFile.uri });
    return tempFile.uri;
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const uri = await getLocalPath(asset.uri);
        const name = asset.fileName || uri.split("/").pop();
        const type =
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg");
        setPreviewFile(uri);
        setPreviewMeta({ name, type, file: asset.file });
      }
    } catch (err) {
      console.error("pickImage error:", err);
      Alert.alert("Error", "Could not pick image or video.");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      const file = result.assets?.[0] || result;
      if (file && file.uri && file.type !== "cancel") {
        const uri = await getLocalPath(file.uri);
        const name = file.name || uri.split("/").pop();
        const type = file.mimeType || guessMimeTypeFromName(name);
        setPreviewFile(uri);
        setPreviewMeta({ name, type, file: file.file });
      }
    } catch (err) {
      console.error("pickDocument error:", err);
      Alert.alert("Error", "Could not pick file.");
    }
  };

  const sendFile = async (fileUri, meta) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem("token");
      const name = meta.name || fileUri.split("/").pop();
      const type = meta.type || guessMimeTypeFromName(name);
      const formData = new FormData();
      formData.append("from", userId);
      formData.append("to", receiverId);
      if (Platform.OS === "web") {
        let browserFile = meta.file;
        if (!browserFile) {
          const fileResponse = await fetch(fileUri);
          if (!fileResponse.ok) {
            throw new Error("Could not read the selected file.");
          }
          browserFile = await fileResponse.blob();
        }
        formData.append("file", browserFile, name);
      } else {
        formData.append("file", { uri: fileUri, name, type });
      }

      const res = await fetch(`${API_URL}/messages/send-file`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: formData,
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const data = JSON.parse(text);
      if (data.success) {
        socketRef.current?.emit("message", data.message);
        setMessages((prev) => [...prev, data.message]);
        setPreviewFile(null);
        setPreviewMeta(null);
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      console.error("sendFile error:", err);
      Alert.alert("Upload failed", err.message || "Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const storedPhone = await AsyncStorage.getItem("phoneNumber");
      if (storedPhone) setUserId(storedPhone);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId || !receiverId) return;
    setActiveNotificationChat(receiverId);
    const newSocket = io(`${API_URL}`, { transports: ["websocket"] });
    socketRef.current = newSocket;

    const sendPresence = (isActive) => {
      newSocket.emit("appState", {
        phoneNumber: userId,
        state: isActive ? "active" : "background",
      });
      if (isActive) {
        newSocket.emit("viewChat", {
          phoneNumber: userId,
          chatWith: receiverId,
        });
        newSocket.emit("loadHistory", { from: userId, to: receiverId });
      } else {
        newSocket.emit("leaveChat", { phoneNumber: userId });
      }
    };

    newSocket.on("connect", () => {
      newSocket.emit("login", userId);
      sendPresence(AppState.currentState === "active");
    });

    newSocket.on("history", (history) => {
      setMessages(history || []);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
      fetch(`${API_URL}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: receiverId, to: userId }),
      });
    });

    newSocket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    });

    newSocket.on("messageDeleted", (deletedId) => {
      setMessages((prev) => prev.filter((m) => m._id !== deletedId));
    });

    newSocket.on(
      "messageLikeUpdate",
      ({ messageId, userId: likerId, liked, likesCount }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  liked: likerId === userId ? liked : m.liked,
                  likesCount: likesCount,
                  likes:
                    likerId === userId
                      ? liked
                        ? [...(m.likes || []), likerId]
                        : (m.likes || []).filter(
                            (l) => l !== userId && l?._id !== userId,
                          )
                      : m.likes,
                }
              : m,
          ),
        );
      },
    );

    const handleAppStateChange = (nextAppState) => {
      const isActive = nextAppState === "active";
      sendPresence(isActive);
      if (isActive) {
        setActiveNotificationChat(receiverId);
      } else {
        setActiveNotificationChat(null);
      }
    };
    const appStateListener = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      newSocket.emit("leaveChat", { phoneNumber: userId });
      setActiveNotificationChat(null);
      appStateListener.remove();
      newSocket.disconnect();
    };
  }, [API_URL, userId, receiverId]);

  const confirmDelete = (message) => setDeleteModal({ visible: true, message });
  const deleteMessage = async () => {
    try {
      const msgId = deleteModal.message?._id;
      if (!msgId) return;

      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/messages/${msgId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
        socketRef.current.emit("messageDeleted", msgId);
      } else {
        Alert.alert("Error", data.message || "Failed to delete message.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to delete message.");
    } finally {
      setDeleteModal({ visible: false, message: null });
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current || !userId) return;
    const msg = {
      from: userId,
      to: receiverId,
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit("message", msg);
    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  const handleLike = (item) => {
    if (!socketRef.current || !userId || !item?._id) return;
    const alreadyLiked = (item.likes || []).some(
      (l) => l === userId || l?._id === userId,
    );
    socketRef.current.emit("likeMessage", {
      messageId: item._id,
      userId,
      phoneNumber: userId,
    });
    setMessages((prev) =>
      prev.map((m) =>
        m._id === item._id
          ? {
              ...m,
              liked: !alreadyLiked,
              likesCount: alreadyLiked
                ? Math.max(0, (m.likesCount || 0) - 1)
                : (m.likesCount || 0) + 1,
              likes: alreadyLiked
                ? (m.likes || []).filter(
                    (l) => l !== userId && l?._id !== userId,
                  )
                : [...(m.likes || []), userId],
            }
          : m,
      ),
    );
  };

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Copied", "Text copied to clipboard.");
    }
  };

  const handleMessagePress = (item) => {
    const uri = item.fileUrl || item.videoUrl || item.imageUrl || item.audioUrl;
    const fileName = item.fileName || uri?.split("/").pop() || "";
    if (item.text) {
      copyToClipboard(item.text);
    } else if (uri) {
      if (isImage(fileName)) {
        setImageModal({ visible: true, uri });
      } else if (!isAudio(fileName) && !isVideo(fileName) && !isPdf(fileName)) {
        downloadFile(uri, fileName);
      }
    }
  };

  const AnimatedMessage = ({ item, isMine }) => {
    const isLiked = (item.likes || []).some(
      (l) => l === userId || l?._id === userId,
    );
    const likesCountNum = item.likesCount ?? (item.likes || []).length;

    return (
      <Pressable
        onPress={() => handleMessagePress(item)}
        onLongPress={() => isMine && confirmDelete(item)}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "80%",
        }}
      >
        <View
          style={[
            styles.messageBox,
            isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          {item.text ? (
            <Text
              style={styles.messageText}
              onLongPress={() => copyToClipboard(item.text)}
            >
              {item.text}
            </Text>
          ) : null}
          {item.fileUrl || item.videoUrl || item.imageUrl || item.audioUrl ? (
            <FileMessage item={item} />
          ) : null}
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp || item.createdAt).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </Text>
            <TouchableOpacity
              onPress={() => handleLike(item)}
              style={styles.likeButton}
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityLabel={isLiked ? "Unlike" : "Like"}
            >
              <Heart
                size={16}
                color={isLiked ? "#ff3b30" : "#888"}
                fill={isLiked ? "#ff3b30" : "none"}
              />
              {likesCountNum > 0 && (
                <Text
                  style={[styles.likeCount, isLiked && styles.likeCountActive]}
                >
                  {likesCountNum}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Modal visible={deleteModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{ fontSize: 16, marginBottom: 10 }}>
              Delete this message?
            </Text>
            <View
              style={{ flexDirection: "row", justifyContent: "space-around" }}
            >
              <TouchableOpacity
                onPress={deleteMessage}
                style={[styles.modalBtn, { backgroundColor: "#e53935" }]}
              >
                <Text style={{ color: "#fff" }}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setDeleteModal({ visible: false, message: null })
                }
                style={[styles.modalBtn, { backgroundColor: "#ccc" }]}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={imageModal.visible}
        transparent
        onRequestClose={() => setImageModal({ visible: false, uri: null })}
      >
        <Pressable
          style={styles.zoomContainer}
          onPress={() => setImageModal({ visible: false, uri: null })}
        >
          <Image
            source={{ uri: imageModal.uri }}
            style={styles.zoomImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>

      {copied && (
        <View style={styles.copyToast}>
          <Check size={16} color="#fff" />
          <Text style={styles.copyToastText}>Copied to clipboard</Text>
        </View>
      )}

      {previewFile && (
        <View style={styles.previewOverlay}>
          {previewMeta?.type?.startsWith("image/") ? (
            <Image
              source={{ uri: previewFile }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : previewMeta?.type?.startsWith("video/") ? (
            <VideoAttachmentPlayer
              uri={previewFile}
              style={styles.previewVideo}
            />
          ) : previewMeta?.type?.startsWith("audio/") ? (
            <AudioAttachmentPlayer uri={previewFile} />
          ) : (
            <View style={styles.previewFileRow}>
              <FileText size={48} color="#fff" />
              <Text style={styles.previewFileText}>{previewMeta?.name}</Text>
            </View>
          )}
          {uploading ? (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{ marginTop: 20 }}
            />
          ) : (
            <View style={styles.previewButtons}>
              <TouchableOpacity
                onPress={() => sendFile(previewFile, previewMeta)}
                style={styles.sendBtn}
              >
                <Text style={styles.sendTxt}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPreviewFile(null);
                  setPreviewMeta(null);
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.headerContainer}>
          <Image
            source={
              profilePic
                ? { uri: profilePic }
                : require("../../assets/images/profile.png")
            }
            style={styles.profilePic}
          />
          <View>
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: "./user",
                  params: { phone: receiverId },
                });
              }}
            >
              <Text style={styles.receiverName}>{receiverName || "User"}</Text>
              <Text style={styles.receiverStatus}>Online</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, i) => item?._id || i.toString()}
          renderItem={({ item }) => (
            <AnimatedMessage item={item} isMine={item.from === userId} />
          )}
          contentContainerStyle={{ paddingBottom: 14 + insets.bottom }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {attachmentMenuVisible && (
          <View style={styles.attachmentMenu}>
            <TouchableOpacity
              style={styles.attachmentMenuItem}
              onPress={() => {
                setAttachmentMenuVisible(false);
                pickImage();
              }}
              accessibilityRole="button"
            >
              <ImageIcon size={20} color="#666" />
              <Text style={styles.attachmentMenuText}>Image / Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachmentMenuItem}
              onPress={() => {
                setAttachmentMenuVisible(false);
                pickDocument();
              }}
              accessibilityRole="button"
            >
              <FileText size={20} color="#666" />
              <Text style={styles.attachmentMenuText}>Document</Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setAttachmentMenuVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel="Choose an attachment"
          >
            <Paperclip size={20} color="#666" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />

          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ece5dd",
  },

  /** HEADER **/
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#693486ff",
    elevation: 3,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  receiverName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  receiverStatus: {
    color: "#d0f0d0",
    fontSize: 12,
  },

  /** MESSAGE BUBBLES **/
  messageBox: {
    marginVertical: 4,
    marginHorizontal: 8,
    padding: 10,
    borderRadius: 16,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    backgroundColor: "#cd640eff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: "#3065b9ff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#222",
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  likeCount: {
    fontSize: 10,
    color: "#888",
  },
  likeCountActive: {
    color: "#ff3b30",
    fontWeight: "600",
  },

  /** FILE MESSAGES **/
  filePreview: {
    marginVertical: 6,
  },
  fileInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  fileText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  fileSizeText: {
    fontSize: 11,
    color: "#888",
  },
  downloadBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  fileImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
  },
  fileVideo: {
    width: 250,
    height: 200,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  videoAttachmentError: {
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    borderRadius: 8,
  },
  videoAttachmentErrorText: {
    color: "#fff",
    textAlign: "center",
  },
  audioBtn: {
    padding: 10,
    backgroundColor: "#e7f0f7",
    borderRadius: 8,
    alignItems: "center",
  },
  fileBox: {
    padding: 10,
    backgroundColor: "#e8f0fe",
    borderRadius: 8,
  },

  /** INPUT AREA **/
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  attachmentMenu: {
    alignSelf: "flex-start",
    marginLeft: 10,
    marginBottom: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  attachmentMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachmentMenuText: {
    color: "#333",
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginRight: 8,
    color: "#111",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    elevation: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    backgroundColor: "#25D366",
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  /** PREVIEW OVERLAY **/
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  previewImage: {
    width: 250,
    height: 250,
    borderRadius: 12,
  },
  previewVideo: {
    width: 400,
    height: 600,
    borderRadius: 12,
  },
  previewFileRow: {
    alignItems: "center",
    gap: 12,
  },
  previewFileText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
  },
  previewButtons: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  sendBtn: {
    backgroundColor: "#25D366",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  sendTxt: {
    color: "#fff",
    fontWeight: "600",
  },
  cancelBtn: {
    backgroundColor: "#d9534f",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  cancelTxt: {
    color: "#fff",
    fontWeight: "600",
  },

  /** DELETE MODAL **/
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 90,
    alignItems: "center",
  },

  /** IMAGE ZOOM **/
  zoomContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomImage: {
    width: width,
    height: height,
    borderRadius: 10,
  },

  /** COPY TOAST **/
  copyToast: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    zIndex: 1000,
  },
  copyToastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
});
