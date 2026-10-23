import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { Play, Pause, Check, X, Volume2, VolumeX } from "lucide-react-native";
import { Colors } from "../constants/theme";
import UserAvatar from "./UserAvatar";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { fetchMusicTracks } from "../services/music";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 64;
const THUMB_SIZE = 18;

export default function MusicPicker({
  visible,
  onDismiss,
  onSelect,
  selectedMusic,
  onVolumeChange,
  currentVolume = 50,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [tracks, setTracks] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const [volume, setVolume] = useState(currentVolume);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (player) {
      player.muted = false;
    }
  }, [player]);

  useEffect(() => {
    if (visible) {
      loadTracks(true);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const loadTracks = async (reset = false) => {
    if (reset) {
      setRefreshing(true);
      setCursor(null);
      setTracks([]);
      setHasMore(true);
    } else if (!hasMore || loading) {
      return;
    }

    try {
      const res = await fetchMusicTracks(reset ? null : cursor, 20);
      const newTracks = res.tracks || res.data || [];
      const newCursor = res.nextCursor || res.cursor || null;

      if (reset) {
        setTracks(newTracks);
      } else {
        setTracks((prev) => [...prev, ...newTracks]);
      }
      setCursor(newCursor);
      setHasMore(!!newCursor);
    } catch (err) {
      console.error("Load tracks error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePreview = (track) => {
    if (!player) return;

    if (playingPreviewId === track.id) {
      player.pause();
      setPlayingPreviewId(null);
      return;
    }

    try {
      player.uri = track.previewUrl || track.preview;
      player.play();
      setPlayingPreviewId(track.id);
    } catch (err) {
      console.error("Preview error:", err);
    }
  };

  useEffect(() => {
    if (status?.didJustFinish) {
      setPlayingPreviewId(null);
    }
  }, [status?.didJustFinish]);

  // Volume slider with PanResponder
  const volumeSlideAnim = useRef(new Animated.Value(0)).current;

  const volumePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const posX = Math.max(0, Math.min(SLIDER_WIDTH, gesture.moveX - 32));
          const newVolume = Math.round((posX / SLIDER_WIDTH) * 100);
          setVolume(newVolume);
          onVolumeChange?.(newVolume / 100);
        },
        onPanResponderRelease: (_, gesture) => {
          const posX = Math.max(0, Math.min(SLIDER_WIDTH, gesture.moveX - 32));
          const newVolume = Math.round((posX / SLIDER_WIDTH) * 100);
          setVolume(newVolume);
          onVolumeChange?.(newVolume / 100);
        },
      }),
    [],
  );

  const handleSelect = (track) => {
    if (player && playingPreviewId) {
      player.pause();
    }
    setPlayingPreviewId(null);
    onSelect?.(track);
    onDismiss();
  };

  const handleVolumeTap = (e) => {
    // Handle tap on the slider to set volume
    const { locationX } = e.nativeEvent;
    const newVolume = Math.round((locationX / SLIDER_WIDTH) * 100);
    setVolume(Math.max(0, Math.min(100, newVolume)));
    onVolumeChange?.(newVolume / 100);
  };

  const renderTrack = ({ item }) => {
    const isPlaying = playingPreviewId === item.id;
    const isSelected = selectedMusic?.id === item.id;
    const isDarkMode = isDark;

    return (
      <TouchableOpacity
        style={[
          styles.trackItem,
          { backgroundColor: isDarkMode ? "#1e1e1e" : "#f8f8f8" },
          isSelected && { backgroundColor: isDarkMode ? "#2a2a2a" : "#e8e8ff" },
        ]}
        onPress={() => handlePreview(item)}
        onLongPress={() => handleSelect(item)}
      >
        <View style={styles.trackLeft}>
          {item.artwork ? (
            <View style={styles.trackArtworkWrap}>
              <UserAvatar uri={item.artwork} size={40} showBorder={isSelected} />
            </View>
          ) : (
            <View
              style={[
                styles.trackArtworkWrap,
                { backgroundColor: isDarkMode ? "#333" : "#e0e0e0" },
              ]}
            >
              <View style={styles.trackNote} />
            </View>
          )}

          <View style={styles.trackInfo}>
            <Text
              style={[
                styles.trackTitle,
                { color: isDarkMode ? "#fff" : "#333" },
                isSelected && { fontWeight: "bold" },
              ]}
              numberOfLines={1}
            >
              {item.title || item.name || "Unknown"}
            </Text>
            <Text
              style={[
                styles.trackArtist,
                { color: isDarkMode ? "#aaa" : "#777" },
              ]}
              numberOfLines={1}
            >
              {item.artist || ""}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation();
            handlePreview(item);
          }}
        >
          {isPlaying ? (
            <Pause size={20} color="#05a31dff" />
          ) : (
            <Play size={20} color={isDarkMode ? "#fff" : "#333"} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const sheetHeight = 480;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      hardwareAccelerated
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight + insets.bottom,
              backgroundColor: isDark ? "#121212" : "#fff",
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [sheetHeight, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? "#fff" : "#333" }]}>
              Add Music
            </Text>
            <TouchableOpacity onPress={onDismiss}>
              <X size={20} color={isDark ? "#fff" : "#333"} />
            </TouchableOpacity>
          </View>

          {loading && tracks.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#05a31dff" />
            </View>
          ) : tracks.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: isDark ? "#888" : "#999" }]}>
                No music available
              </Text>
            </View>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
              renderItem={renderTrack}
              contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
              onEndReached={() => {
                if (hasMore && !loading) loadTracks(false);
              }}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Volume slider at bottom */}
          <View
            style={[
              styles.volumeSection,
              {
                backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0",
                paddingBottom: Math.max(insets.bottom, 10),
                borderTopColor: isDark ? "#333" : "#e0e0e0",
              },
            ]}
          >
            <View style={styles.volumeRow}>
              {volume === 0 ? (
                <VolumeX size={20} color={isDark ? "#fff" : "#333"} />
              ) : (
                <Volume2 size={20} color="#05a31dff" />
              )}

              <TouchableOpacity
                style={styles.sliderTrack}
                onPress={handleVolumeTap}
                activeOpacity={1}
              >
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${volume}%`, backgroundColor: "#05a31dff" },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.sliderThumb,
                    { left: `${volume}%` },
                  ]}
                  {...volumePanResponder.panHandlers}
                />
              </TouchableOpacity>

              <Text style={[styles.volumeLabel, { color: isDark ? "#fff" : "#333" }]}>
                {volume}%
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  trackLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  trackArtworkWrap: {
    width: 44,
    height: 44,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  trackArtist: {
    fontSize: 13,
    marginTop: 2,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  volumeSection: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 3,
    position: "relative",
    marginHorizontal: 8,
  },
  sliderFill: {
    height: "100%",
    borderRadius: 3,
  },
  sliderThumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#05a31dff",
    top: -10,
    left: 0,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  volumeLabel: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 36,
    textAlign: "right",
  },
});
