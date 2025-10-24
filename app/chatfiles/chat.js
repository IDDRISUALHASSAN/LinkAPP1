import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Pressable,
  Linking,
  Image,
  ActivityIndicator,
} from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Video, Audio } from "expo-av";

export default function Chat() {
  const { receiverId, receiverName, profilePic } = useLocalSearchParams();
  const IP = "10.176.143.51:3000";

  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);

  const flatListRef = useRef(null);

  // detect file type by extension
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
    const newPath = `${FileSystem.cacheDirectory}${Date.now()}.tmp`;
    await FileSystem.copyAsync({ from: uri, to: newPath });
    return newPath;
  };

  // 📸 Pick image or video
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

  // 📎 Pick document/audio/other
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

  // 🚀 Upload file
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

      const res = await fetch(`http://${IP}/messages/send-file`, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data", Authorization: token ? `Bearer ${token}` : "" },
        body: formData,
      });

      const data = await res.json();
      console.log("sendFile response:", data);

      if (data.success) {
        socket?.emit("message", data.message);
        setMessages((prev) => [...prev, data.message]);
        setPreviewFile(null);
        setPreviewMeta(null);
      } else {
        Alert.alert("Upload failed", data.message || "Unknown error");
      }
    } catch (err) {
      console.error("sendFile error:", err);
      Alert.alert("Upload failed", err.message || "Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  // 🔌 Socket setup
  useEffect(() => {
    const loadUser = async () => {
      const storedPhone = await AsyncStorage.getItem("phoneNumber");
      if (storedPhone) setUserId(storedPhone);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId || !receiverId) return;
    const newSocket = io(`http://${IP}`, { transports: ["websocket"] });
    setSocket(newSocket);
    newSocket.emit("login", userId);
    newSocket.emit("loadHistory", { from: userId, to: receiverId });

    newSocket.on("history", (history) => {
      setMessages(history || []);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    });

    newSocket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => newSocket.disconnect();
  }, [userId, receiverId]);

  const sendMessage = () => {
    if (!input.trim() || !socket || !userId) return;
    const msg = {
      from: userId,
      to: receiverId,
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };
    socket.emit("message", msg);
    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  const AudioPlayer = ({ uri }) => {
    const [sound, setSound] = useState(null);
    const [playing, setPlaying] = useState(false);

    const togglePlay = async () => {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        setSound(newSound);
        await newSound.playAsync();
        setPlaying(true);
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) setPlaying(false);
        });
      } else {
        const status = await sound.getStatusAsync();
        if (status.isPlaying) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          await sound.playAsync();
          setPlaying(true);
        }
      }
    };

    useEffect(() => {
      return sound ? () => sound.unloadAsync() : undefined;
    }, [sound]);

    return (
      <TouchableOpacity onPress={togglePlay} style={{ padding: 10, backgroundColor: "#ddd", borderRadius: 8 }}>
        <Text>{playing ? "⏸️ Pause" : "▶️ Play Audio"}</Text>
      </TouchableOpacity>
    );
  };

  const AnimatedMessage = ({ item, isMine }) => (
    <Pressable>
      <View style={[styles.messageBox, isMine ? styles.myMessage : styles.theirMessage]}>
        {item.fileUrl ? (
          item.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <Image source={{ uri: item.fileUrl }} style={{ width: 200, height: 200, borderRadius: 8 }} resizeMode="cover" />
          ) : item.fileUrl.match(/\.(mp4|mov)$/i) ? (
            <Video source={{ uri: item.fileUrl }} style={{ width: 200, height: 180, borderRadius: 8 }} useNativeControls resizeMode="contain" />
          ) : item.fileUrl.match(/\.(mp3|m4a|wav)$/i) ? (
            <AudioPlayer uri={item.fileUrl} />
          ) : (
            <TouchableOpacity onPress={() => Linking.openURL(item.fileUrl)} style={{ padding: 8, backgroundColor: "#eee", borderRadius: 8 }}>
              <Text style={{ color: "#333" }}>📎 {item.fileName || "View file"}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
        <Text style={styles.timestamp}>{new Date(item.timestamp || item.createdAt).toLocaleTimeString()}</Text>
      </View>
    </Pressable>
  );

  return (
    <>
      {previewFile && (
        <View style={styles.previewOverlay}>
          {previewMeta?.type?.startsWith("image/") ? (
            <Image source={{ uri: previewFile }} style={{ width: 220, height: 220, borderRadius: 10 }} resizeMode="cover" />
          ) : previewMeta?.type?.startsWith("video/") ? (
            <Video source={{ uri: previewFile }} style={{ width: 250, height: 200 }} useNativeControls resizeMode="contain" />
          ) : previewMeta?.type?.startsWith("audio/") ? (
            <AudioPlayer uri={previewFile} />
          ) : (
            <Text style={{ fontSize: 16, marginBottom: 10, color: "#fff" }}>📄 {previewMeta?.name}</Text>
          )}

          {uploading ? (
            <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
          ) : (
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => sendFile(previewFile, previewMeta)}
                style={{ backgroundColor: "#4CAF50", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginHorizontal: 10 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPreviewFile(null);
                  setPreviewMeta(null);
                }}
                style={{ backgroundColor: "#f44336", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginHorizontal: 10 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        <View style={styles.headerContainer}>
          <Image source={profilePic ? { uri: profilePic } : require("../../assets/images/avatar.png")} style={styles.profilePic} />
          <View>
            <Text style={styles.receiverName}>{receiverName || "User"}</Text>
            <Text style={styles.receiverStatus}>Online</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item?._id || index.toString()}
          renderItem={({ item }) => <AnimatedMessage item={item} isMine={item.from === userId} />}
          contentContainerStyle={{ paddingBottom: 10 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput style={styles.textInput} value={input} onChangeText={setInput} placeholder="Type a message..." />
          <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
            <Text style={{ fontSize: 22 }}>🖼️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={pickDocument}>
            <Text style={{ fontSize: 22 }}>📎</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendText}>👉</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  headerContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#6a22b1ff" },
  profilePic: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  receiverName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  receiverStatus: { color: "#e6e6e6", fontSize: 12 },
  messageBox: { maxWidth: "75%", marginVertical: 6, marginHorizontal: 12, padding: 12, borderRadius: 16 },
  myMessage: { backgroundColor: "#30ae34ff", alignSelf: "flex-end" },
  theirMessage: { backgroundColor: "#9e4d4dff", alignSelf: "flex-start" },
  messageText: { fontSize: 16, color: "#fff" },
  timestamp: { fontSize: 11, color: "#d1d1d1", marginTop: 4, textAlign: "right" },
  inputContainer: { flexDirection: "row", padding: 12, borderTopWidth: 1, borderColor: "#ccc", backgroundColor: "#fff", alignItems: "center" },
  textInput: { flex: 1, height: 48, borderWidth: 1, borderColor: "#bbb", borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  sendButton: { marginLeft: 10, backgroundColor: "#18d82eff", paddingHorizontal: 20, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  iconButton: { marginHorizontal: 6 },
  previewOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});