import * as FileSystem from "expo-file-system";
import { cacheDirectory } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    ChevronLeft,
    Image as ImageIcon,
    Music,
    Play,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MusicPicker from "@/components/MusicPicker";
import TrimBar from "@/components/TrimBar";
import { uploadWithProgress, isAuthError, clearAuth } from "@/services/api";

const STEPS = {
  PICK: "pick",
  TRIM: "trim",
  CAPTION: "caption",
  UPLOADING: "uploading",
};

const MAX_CAPTION_LENGTH = 300;

export default function Upload() {
  const router = useRouter();
  const handleAuthError = async () => {
    await clearAuth();
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please log in again.",
      [{ text: "OK", onPress: () => router.replace("/(screens)") }],
    );
  };
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [step, setStep] = useState(STEPS.PICK);
  const [videoUri, setVideoUri] = useState(null);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoFileName, setVideoFileName] = useState(null);
  const [videoMimeType, setVideoMimeType] = useState(null);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [caption, setCaption] = useState("");
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicVolume, setMusicVolume] = useState(50);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [musicPickerVisible, setMusicPickerVisible] = useState(false);
  const cancelRef = useRef(null);
  const captionInputRef = useRef(null);

  const handleBack = () => {
    if (uploading) {
      Alert.alert("Cancel upload?", "Your video will not be uploaded.", [
        { text: "Continue uploading", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: cancelUpload,
        },
      ]);
    } else if (step === STEPS.TRIM) {
      setStep(STEPS.PICK);
      setVideoUri(null);
      setLocalVideoUri(null);
      setVideoFile(null);
    } else if (step === STEPS.CAPTION) {
      setStep(STEPS.TRIM);
    } else {
      router.back();
    }
  };

  const getLocalPath = async (uri) => {
    if (!uri.startsWith("content://")) return uri;
    const tempFile = `${cacheDirectory}${Date.now()}_video.mp4`;
    await FileSystem.copyAsync({ from: uri, to: tempFile });
    return tempFile;
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 120,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = await getLocalPath(asset.uri);
      setVideoUri(uri);
      setLocalVideoUri(uri);
      setVideoFile(asset.file || null);
      setVideoFileName(asset.fileName || asset.file?.name || null);
      setVideoMimeType(asset.mimeType || asset.file?.type || null);
      setStep(STEPS.TRIM);
      setStartSec(0);
      setEndSec(0);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 120,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = await getLocalPath(asset.uri);
        setVideoUri(uri);
        setLocalVideoUri(uri);
        setVideoFile(asset.file || null);
        setStep(STEPS.TRIM);
        setStartSec(0);
        setEndSec(0);
      }
    } catch (_err) {
      console.error("Camera error:", _err);
      Alert.alert(
        "Error",
        "Could not open camera. Please try picking from library.",
      );
    }
  };

  const handleTrimChange = (newStart, newEnd) => {
    setStartSec(newStart);
    setEndSec(newEnd);
  };

  const proceedToCaption = () => {
    const selectedLength = endSec - startSec;
    if (selectedLength < 1) {
      Alert.alert("Too short", "Selected length must be at least 1 second.");
      return;
    }
    if (selectedLength > 120) {
      Alert.alert("Too long", "Selected length must be at most 120 seconds.");
      return;
    }
    setStep(STEPS.CAPTION);
  };

  const proceedToUpload = () => {
    if (!localVideoUri) {
      Alert.alert("Error", "No video to upload.");
      return;
    }
    setStep(STEPS.UPLOADING);
    doUpload();
  };

  const cancelUpload = () => {
    if (cancelRef.current) {
      cancelRef.current.abort();
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const doUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        let browserVideoFile = videoFile;
        if (!browserVideoFile) {
          const videoResponse = await fetch(localVideoUri);
          if (!videoResponse.ok) {
            throw new Error("Could not read the selected video file.");
          }
          browserVideoFile = await videoResponse.blob();
        }
        formData.append(
          "video",
          browserVideoFile,
          videoFileName || videoFile?.name || "upload.mp4",
        );
      } else {
        formData.append("video", {
          uri: localVideoUri,
          name: videoFileName || "upload.mp4",
          type: videoMimeType || "video/mp4",
        });
      }
      formData.append("caption", caption || "");
      formData.append("startSec", String(startSec));
      formData.append("endSec", String(endSec));
      if (selectedMusic?.id) {
        formData.append("musicId", selectedMusic.id);
      }
      formData.append("musicVolume", String(musicVolume / 100));

      const { data } = await uploadWithProgress(
        formData,
        (progress) => {
          setUploadProgress(progress);
        },
        cancelRef,
      );

      if (data.success !== false) {
        Alert.alert("Success", "Video uploaded!", [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]);
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthError();
        return;
      }
      if (error.message && error.message.includes("aborted")) {
        setUploadError("Upload cancelled");
      } else {
        setUploadError(error.message || "Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    doUpload();
  };

  const handleDone = () => {
    router.back();
  };

  const renderHeader = () => {
    const titles = {
      [STEPS.PICK]: "Upload Video",
      [STEPS.TRIM]: "Trim Video",
      [STEPS.CAPTION]: "Add Caption",
      [STEPS.UPLOADING]: "Uploading...",
    };

    const canGoBack = step !== STEPS.PICK;

    return (
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? "#000" : "#fff",
            borderBottomColor: isDark ? "#222" : "#e0e0e0",
            paddingTop: insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={handleBack}
          disabled={uploading}
        >
          <ChevronLeft size={24} color={isDark ? "#fff" : "#333"} />
          <Text
            style={[styles.headerBackText, { color: isDark ? "#fff" : "#333" }]}
          >
            {canGoBack ? "Back" : "Cancel"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#333" }]}>
          {titles[step]}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
    );
  };

  const renderPickStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.pickOptions}>
        <TouchableOpacity
          style={[
            styles.pickOption,
            { backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0" },
          ]}
          onPress={pickFromLibrary}
        >
          <ImageIcon size={48} color={isDark ? "#fff" : "#333"} />
          <Text
            style={[styles.pickOptionText, { color: isDark ? "#fff" : "#333" }]}
          >
            Pick from Library
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pickOption,
            { backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0" },
          ]}
          onPress={recordVideo}
        >
          <Play size={48} color={isDark ? "#fff" : "#333"} />
          <Text
            style={[styles.pickOptionText, { color: isDark ? "#fff" : "#333" }]}
          >
            Record Video
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTrimStep = () => {
    const selectedLength = endSec - startSec;
    const canProceed = selectedLength >= 1 && selectedLength <= 120;

    return (
      <>
        {videoUri && (
          <TrimBar videoUri={videoUri} onTrimChange={handleTrimChange} />
        )}

        <View style={styles.trimFooter}>
          <View style={styles.trimInfo}>
            <Text
              style={[styles.trimInfoText, { color: isDark ? "#aaa" : "#777" }]}
            >
              Selected: {selectedLength.toFixed(1)}s (max 120s, min 1s)
            </Text>
            <Text
              style={[
                styles.trimStatus,
                { color: canProceed ? "#05a31dff" : "#ff3b30" },
              ]}
            >
              {canProceed ? "Valid" : "Not valid"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: canProceed ? "#05a31dff" : "#888" },
              { opacity: canProceed ? 1 : 0.6 },
            ]}
            onPress={proceedToCaption}
            disabled={!canProceed}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderCaptionStep = () => (
    <KeyboardAvoidingView
      style={styles.captionContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.captionSection}>
        <Text
          style={[styles.captionLabel, { color: isDark ? "#fff" : "#333" }]}
        >
          Caption
        </Text>
        <TextInput
          ref={captionInputRef}
          style={[
            styles.captionInput,
            {
              backgroundColor: isDark ? "#1e1e1e" : "#f8f8f8",
              color: isDark ? "#fff" : "#000",
            },
          ]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption..."
          placeholderTextColor={isDark ? "#888" : "#999"}
          multiline
          maxLength={MAX_CAPTION_LENGTH}
        />
        <View style={styles.charCounterContainer}>
          <Text
            style={[
              styles.charCounter,
              {
                color:
                  caption.length >= MAX_CAPTION_LENGTH
                    ? "#ff3b30"
                    : isDark
                      ? "#888"
                      : "#999",
              },
            ]}
          >
            {caption.length}/{MAX_CAPTION_LENGTH}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.musicBtn,
            { backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0" },
          ]}
          onPress={() => setMusicPickerVisible(true)}
        >
          <Music size={20} color="#05a31dff" />
          <Text
            style={[styles.musicBtnText, { color: isDark ? "#fff" : "#333" }]}
          >
            {selectedMusic ? selectedMusic.title : "Add Music"}
          </Text>
          {selectedMusic && (
            <View style={styles.musicDot}>
              <Text style={styles.musicDotText}>●</Text>
            </View>
          )}
        </TouchableOpacity>

        {selectedMusic && (
          <View style={styles.musicInfo}>
            <Text
              style={[styles.musicTitle, { color: isDark ? "#fff" : "#333" }]}
            >
              {selectedMusic.title}
            </Text>
            <Text
              style={[styles.musicArtist, { color: isDark ? "#aaa" : "#777" }]}
            >
              {selectedMusic.artist || "Unknown artist"}
            </Text>
            <View style={styles.volumeRow}>
              <Text
                style={[
                  styles.volumeLabel,
                  { color: isDark ? "#aaa" : "#777" },
                ]}
              >
                Volume: {musicVolume}%
              </Text>
              <View
                style={[
                  styles.volumeBar,
                  { backgroundColor: isDark ? "#333" : "#e0e0e0" },
                ]}
              >
                <View
                  style={[styles.volumeFill, { width: `${musicVolume}%` }]}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.nextBtn,
          { backgroundColor: "#05a31dff" },
          { opacity: uploading ? 0.6 : 1 },
        ]}
        onPress={proceedToUpload}
        disabled={uploading}
      >
        <Text style={styles.nextBtnText}>Upload Video</Text>
      </TouchableOpacity>

      <MusicPicker
        visible={musicPickerVisible}
        onDismiss={() => setMusicPickerVisible(false)}
        onSelect={(track) => {
          setSelectedMusic(track);
        }}
        selectedMusic={selectedMusic}
        onVolumeChange={(vol) => setMusicVolume(Math.round(vol * 100))}
        currentVolume={musicVolume}
      />
    </KeyboardAvoidingView>
  );

  const renderUploadingStep = () => (
    <View style={styles.uploadingContainer}>
      <View style={styles.uploadingContent}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressPercent}>
            {Math.round(uploadProgress)}%
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[styles.progressBarFill, { width: `${uploadProgress}%` }]}
          />
        </View>

        <Text
          style={[styles.uploadingStatus, { color: isDark ? "#fff" : "#333" }]}
        >
          {uploadError
            ? "Upload failed"
            : uploading
              ? "Uploading..."
              : "Preparing..."}
        </Text>

        {uploadError && (
          <Text style={styles.uploadErrorText}>{uploadError}</Text>
        )}

        {!uploadError ? (
          <TouchableOpacity
            style={styles.cancelUploadBtn}
            onPress={uploading ? cancelUpload : handleDone}
          >
            <Text style={styles.cancelUploadText}>
              {uploading ? "Cancel" : "Done"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.cancelUploadBtn, { backgroundColor: "#05a31dff" }]}
            onPress={handleRetry}
          >
            <Text style={styles.cancelUploadText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: isDark ? "#000" : "#fff" }]}
    >
      {renderHeader()}

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistInViewport={false}
      >
        {step === STEPS.PICK && renderPickStep()}
        {step === STEPS.TRIM && renderTrimStep()}
        {step === STEPS.CAPTION && renderCaptionStep()}
        {step === STEPS.UPLOADING && renderUploadingStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  headerRightPlaceholder: {
    width: 80,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
  },
  pickOptions: {
    gap: 20,
    marginTop: 40,
  },
  pickOption: {
    alignItems: "center",
    paddingVertical: 32,
    borderRadius: 16,
    gap: 12,
  },
  pickOptionText: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    flex: 1,
  },
  trimFooter: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  trimInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  trimInfoText: {
    fontSize: 14,
  },
  trimStatus: {
    fontSize: 14,
    fontWeight: "600",
  },
  nextBtn: {
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: "center",
    marginHorizontal: 16,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  captionContainer: {
    flex: 1,
  },
  captionSection: {
    flex: 1,
    padding: 24,
    paddingBottom: 100,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  captionInput: {
    width: "100%",
    minHeight: 100,
    maxHeight: 160,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    includeFontPadding: false,
  },
  charCounterContainer: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  charCounter: {
    fontSize: 13,
  },
  musicBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  musicBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  musicDot: {
    marginLeft: "auto",
  },
  musicInfo: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  musicTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  musicArtist: {
    fontSize: 13,
    marginBottom: 8,
  },
  volumeRow: {
    gap: 6,
  },
  volumeLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  volumeBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    backgroundColor: "#05a31dff",
    borderRadius: 2,
  },
  uploadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 24,
  },
  uploadingContent: {
    alignItems: "center",
    width: "100%",
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: "#e0e0e0",
    borderLeftColor: "#05a31dff",
    justifyContent: "center",
    alignItems: "center",
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: "bold",
  },
  progressBarContainer: {
    width: "80%",
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#05a31dff",
  },
  uploadingStatus: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
  },
  uploadErrorText: {
    color: "#ff3b30",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  cancelUploadBtn: {
    backgroundColor: "#ff3b30",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  cancelUploadText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
