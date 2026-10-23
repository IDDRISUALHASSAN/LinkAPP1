import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Alert,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Scissors } from "lucide-react-native";
import { useColorScheme } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MAX_DURATION = 120;
const MIN_DURATION = 1;
const HANDLE_SIZE = 24;

export default function TrimBar({ videoUri, onTrimChange, style }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  const barContainerWidth = SCREEN_WIDTH - 64;

  const player = useVideoPlayer(videoUri || undefined);

  const effectiveDuration = playerDuration || endSec || 0;

  useEffect(() => {
    if (!player) return;
    player.loop = true;
    player.muted = true;

    const sub = player.addListener(() => {
      const d = player.duration || 0;
      const durSec = d > 0 ? d / 1000 : 0;

      if (durSec > 0 && durSec !== playerDuration) {
        setPlayerDuration(durSec);

        if (endSec === 0 || endSec > durSec) {
          const initEnd = Math.min(durSec, MAX_DURATION);
          setEndSec(initEnd);
          onTrimChange?.(0, initEnd);
        }
      }

      if (startSec < endSec && endSec > 0) {
        const current = player.currentTime || 0;
        if (current >= endSec * 1000 - 200) {
          player.currentTime = startSec * 1000;
          player.play();
        } else if (!player.isPlaying) {
          player.play();
        }
      }
    });

    if (videoUri && endSec > 0 && startSec < endSec) {
      player.play();
    }

    return () => sub?.remove?.();
  }, [player, videoUri, startSec, endSec, playerDuration]);

  const secToX = (sec) => {
    if (effectiveDuration <= 0) return 0;
    const ratio = sec / effectiveDuration;
    return ratio * barContainerWidth;
  };

  const xToSec = (x) => {
    const clamped = Math.max(0, Math.min(barContainerWidth, x));
    const ratio = barContainerWidth > 0 ? clamped / barContainerWidth : 0;
    return Math.round(ratio * effectiveDuration);
  };

  const validateAndClamp = (newStart, newEnd) => {
    if (effectiveDuration <= 0) return { start: 0, end: 0 };

    let s = Math.max(0, Math.min(newStart, effectiveDuration - MIN_DURATION));
    let e = Math.min(effectiveDuration, Math.max(newEnd, s + MIN_DURATION));

    if (e - s > MAX_DURATION) {
      e = s + MAX_DURATION;
      if (e > effectiveDuration) {
        e = effectiveDuration;
        s = Math.max(0, e - MAX_DURATION);
      }
    }

    return { start: s, end: e };
  };

  const updateRange = (newStart, newEnd) => {
    const { start: s, end: e } = validateAndClamp(newStart, newEnd);
    setStartSec(s);
    setEndSec(e);
    onTrimChange?.(s, e);
  };

  const leftPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const newStart = xToSec(gesture.moveX - 20);
          updateRange(newStart, endSec);
        },
        onPanResponderRelease: () => {
          const selected = endSec - startSec;
          if (selected > MAX_DURATION) {
            Alert.alert("Too long", `Maximum video length is ${MAX_DURATION}s`);
          }
        },
      }),
    [endSec, effectiveDuration],
  );

  const rightPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const newEnd = xToSec(gesture.moveX - 20);
          updateRange(startSec, newEnd);
        },
        onPanResponderRelease: () => {
          const selected = endSec - startSec;
          if (selected > MAX_DURATION) {
            Alert.alert("Too long", `Maximum video length is ${MAX_DURATION}s`);
          }
        },
      }),
    [startSec, effectiveDuration],
  );

  const selectedLength = endSec - startSec;
  const isValid = selectedLength >= MIN_DURATION && selectedLength <= MAX_DURATION;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasDuration = effectiveDuration > 0;

  return (
    <View style={[styles.container, style]}>
      {!hasDuration ? (
        <View style={[styles.previewWrapper, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ color: "#888", fontSize: 13 }}>Loading video...</Text>
        </View>
      ) : (
        <View style={styles.previewWrapper}>
          <VideoView
            player={player}
            style={styles.preview}
            contentFit="cover"
            nativeControls={false}
          />
        </View>
      )}

      <View
        style={[
          styles.barContainer,
          {
            width: barContainerWidth,
            height: barHeight,
            backgroundColor: isDark ? "#222" : "#e0e0e0",
            marginLeft: 20,
          },
        ]}
      >
        <View
          style={[
            styles.trackBg,
            { backgroundColor: isDark ? "#444" : "#ccc" },
          ]}
        >
          {hasDuration && (
            <View
              style={[
                styles.selectedRange,
                {
                  left: secToX(startSec),
                  width: secToX(endSec) - secToX(startSec),
                  backgroundColor: "#05a31dff",
                },
              ]}
            />
          )}

          {hasDuration && (
            <>
              <View
                style={[
                  styles.handle,
                  { left: secToX(startSec) - HANDLE_SIZE / 2 },
                ]}
                {...leftPanResponder.panHandlers}
              >
                <View style={styles.handleInner} />
              </View>

              <View
                style={[
                  styles.handle,
                  { left: secToX(endSec) - HANDLE_SIZE / 2 },
                ]}
                {...rightPanResponder.panHandlers}
              >
                <View style={styles.handleInner} />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.labelsRow}>
        <Text style={[styles.label, { color: isDark ? "#fff" : "#333" }]}>
          Start: {formatTime(startSec)}
        </Text>
        <Text style={[styles.label, { color: isDark ? "#fff" : "#333" }]}>
          End: {formatTime(endSec)}
        </Text>
        <Text
          style={[
            styles.lengthLabel,
            { color: isValid ? "#05a31dff" : "#ff3b30" },
          ]}
        >
          Length: {formatTime(selectedLength)} ({selectedLength.toFixed(1)}s)
        </Text>
      </View>
    </View>
  );
}

const barHeight = 40;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 12,
  },
  previewWrapper: {
    width: SCREEN_WIDTH - 64,
    height: 160,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#000",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  barContainer: {
    justifyContent: "center",
  },
  trackBg: {
    height: 20,
    justifyContent: "center",
    position: "relative",
  },
  selectedRange: {
    position: "absolute",
    height: 20,
    borderRadius: 10,
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    top: -6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  handleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#05a31dff",
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: SCREEN_WIDTH - 64,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  lengthLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
