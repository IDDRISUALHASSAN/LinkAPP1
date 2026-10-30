import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    PanResponder,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from "react-native";

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
  const [playerError, setPlayerError] = useState(null);

  const barContainerWidth = SCREEN_WIDTH - 64;

  const player = useVideoPlayer(videoUri || undefined, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.timeUpdateEventInterval = 0.1;
  });

  const effectiveDuration = playerDuration || endSec || 0;

  useEffect(() => {
    if (!player) return;

    const updateDuration = () => {
      const d = player.duration || 0;
      const durSec = d > 0 ? d : 0;

      if (durSec > 0 && durSec !== playerDuration) {
        setPlayerDuration(durSec);

        if (endSec === 0 || endSec > durSec) {
          const initEnd = Math.min(durSec, MAX_DURATION);
          setEndSec(initEnd);
          onTrimChange?.(0, initEnd);
        }
      }
    };

    const sourceSub = player.addListener("sourceLoad", (event) => {
      setPlayerError(null);
      updateDuration();
      if (event.duration > 0 && event.duration !== playerDuration) {
        setPlayerDuration(event.duration);
        const initEnd = Math.min(event.duration, MAX_DURATION);
        setEndSec(initEnd);
        onTrimChange?.(0, initEnd);
      }
    });
    const statusSub = player.addListener("statusChange", (event) => {
      if (event.status === "error") {
        setPlayerError(
          event.error?.message ||
            "This video could not be played in your browser.",
        );
      }
      updateDuration();
    });
    const timeSub = player.addListener("timeUpdate", () => {
      if (startSec < endSec && endSec > 0) {
        const current = player.currentTime || 0;
        if (current >= endSec - 0.2) {
          player.currentTime = startSec;
          player.play();
        } else if (!player.isPlaying) {
          player.play();
        }
      }
    });

    updateDuration();
    const durationPoll = setInterval(updateDuration, 250);

    if (videoUri && endSec > 0 && startSec < endSec) {
      player.play();
    }

    return () => {
      sourceSub?.remove?.();
      statusSub?.remove?.();
      timeSub?.remove?.();
      clearInterval(durationPoll);
    };
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
  const isValid =
    selectedLength >= MIN_DURATION && selectedLength <= MAX_DURATION;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasDuration = effectiveDuration > 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.previewWrapper}>
        <VideoView
          player={player}
          style={styles.preview}
          contentFit="contain"
          nativeControls={false}
        />
        {!hasDuration && (
          <View style={styles.previewMessage}>
            <Text
              style={{ color: playerError ? "#ff6b6b" : "#fff", fontSize: 13 }}
            >
              {playerError || "Loading video..."}
            </Text>
          </View>
        )}
      </View>

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
  previewMessage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
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
