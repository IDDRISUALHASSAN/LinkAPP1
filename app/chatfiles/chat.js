import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { io } from "socket.io-client";

const { width, height } = Dimensions.get("window");

function AudioAttachmentPlayer({ uri }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <TouchableOpacity
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={styles.audioBtn}
    >
      <Text>{status.playing ? "⏸️ Pause" : "▶️ Play"}</Text>
    </TouchableOpacity>
  );
}

function VideoAttachmentPlayer({ uri, style }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls
      contentFit="contain"
    />
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

  const flatListRef = useRef(null);
  const shakeAnim = useMemo(() => new Animated.Value(0), []);
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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const uri = await getLocalPath(asset.uri);
        const name = asset.fileName || uri.split("/").pop();
        const type = asset.type === "video" ? "video/mp4" : "image/jpeg";
        setPreviewFile(uri);
        setPreviewMeta({ name, type });
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
        setPreviewMeta({ name, type });
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
      formData.append("file", { uri: fileUri, name, type });

      const res = await fetch(`${API_URL}/messages/send-file`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
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
    const newSocket = io(`${API_URL}`, { transports: ["websocket"] });
    socketRef.current = newSocket;
    newSocket.emit("login", userId);
    newSocket.emit("viewChat", { phoneNumber: userId, chatWith: receiverId });
    newSocket.emit("loadHistory", { from: userId, to: receiverId });

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

    // Notify the backend when the app transitions between foreground / background
    const handleAppStateChange = (nextAppState) => {
      const state =
        nextAppState === "active" ? "active" : "background";
      newSocket.emit("appState", { phoneNumber: userId, state });
    };
    const appStateListener = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      newSocket.emit("leaveChat", { phoneNumber: userId });
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

  const AnimatedMessage = ({ item, isMine }) => (
    <Pressable
      onPress={() =>
        item.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ? setImageModal({ visible: true, uri: item.fileUrl })
          : null
      }
      onLongPress={() => isMine && confirmDelete(item)}
    >
      <View
        style={[
          styles.messageBox,
          isMine ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {item.fileUrl ? (
          item.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <Image
              source={{ uri: item.fileUrl }}
              style={styles.imgMsg}
              resizeMode="cover"
            />
          ) : item.fileUrl.match(/\.(mp4|mov)$/i) ? (
            <VideoAttachmentPlayer uri={item.fileUrl} style={styles.videoMsg} />
          ) : item.fileUrl.match(/\.(mp3|m4a|wav)$/i) ? (
            <AudioAttachmentPlayer uri={item.fileUrl} />
          ) : (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.fileUrl)}
              style={styles.fileBox}
            >
              <Text style={styles.fileText}>
                📎 {item.fileName || "View file"}
              </Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.timestamp || item.createdAt).toLocaleTimeString()}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <>
      {/* Delete modal */}
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

      {/* Image zoom */}
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

      {/* Preview before send */}
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
            <Text style={styles.previewFileText}>📄 {previewMeta?.name}</Text>
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
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
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

       <Animated.View
  style={[
    styles.inputContainer,
    {
      paddingBottom: Math.max(insets.bottom, 10),
      transform: [{ translateX: shakeAnim }],
    },
  ]}
>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#7a7a7a"
            multiline
            maxLength={500}
          />

          {/* Single button that opens options for image or document */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              Alert.alert(
                "Attach",
                "Choose a file type to attach",
                [
                  { text: "Image / Video", onPress: pickImage },
                  { text: "Document", onPress: pickDocument },
                  { text: "Cancel", style: "cancel" },
                ],
                { cancelable: true },
              )
            }
            onPressIn={() => {
              Animated.sequence([
                Animated.timing(shakeAnim, {
                  toValue: -5,
                  duration: 50,
                  useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                  toValue: 5,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                  toValue: 0,
                  duration: 50,
                  useNativeDriver: true,
                }),
              ]).start();
            }}
          >
            <Text style={{ fontSize: 22 }}>📎</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </Animated.View>
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
    maxWidth: "75%",
    marginVertical: 6,
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  myMessage: {
    backgroundColor: "#cd640eff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 0,
  },
  theirMessage: {
    backgroundColor: "#3065b9ff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
    color: "#222",
  },
  timestamp: {
    fontSize: 10,
    color: "#555",
    alignSelf: "flex-end",
    marginTop: 4,
  },

  /** MEDIA MESSAGES **/
  imgMsg: {
    width: 220,
    height: 200,
    borderRadius: 10,
  },
  videoMsg: {
    width: 250,
    height: 200,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  audioBtn: {
    padding: 10,
    backgroundColor: "#e7f0f7",
    borderRadius: 8,
  },
  fileBox: {
    padding: 8,
    backgroundColor: "#e8f0fe",
    borderRadius: 8,
  },
  fileText: {
    color: "#333",
    fontWeight: "500",
  },

  /** INPUT AREA **/
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
 textInput: {
  flex: 1,
  minHeight: 42,
  maxHeight: 120,
  fontSize: 16,
  lineHeight: 22,
  paddingHorizontal: 14,
  paddingVertical: 8,
  backgroundColor: "#fff",
  borderRadius: 22,
  borderWidth: 1,
  borderColor: "#e5e5e5",
  marginRight: 8,
  color: "#111",
  textAlignVertical: "center",
  includeFontPadding: false,
},
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#e4e4e4",
  },
  sendButton: {
    width: 42,
    height: 42,
    backgroundColor: "#25D366",
    borderRadius: 21,
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  sendText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
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
    borderRadius: 10,
  },
  previewVideo: {
    width: 400,
    height: 600,
  },
  previewFileText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
  },
  previewButtons: {
    flexDirection: "row",
    marginTop: 20,
  },
  sendBtn: {
    backgroundColor: "#25D366",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginHorizontal: 8,
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
    marginHorizontal: 8,
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
    width: width * 1,
    height: height * 1,
    borderRadius: 10,
  },
});
