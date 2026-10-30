import { VideoView, useVideoPlayer } from "expo-video";
import {
  Download,
  Heart,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { getPlayableVideoUrl } from "../services/media";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { downloadAndSaveVideo, shareVideo } from "../services/videos";
import ActionButton from "./ActionButton";
import UserAvatar from "./UserAvatar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MAX_CAPTION_LINES = 3;

function ExpandableCaption({ text }) {
  const [expanded, setExpanded] = useState(false);

  const shouldShowMore = (text?.length ?? 0) > 100;

  return (
    <TouchableOpacity
      onPress={
        shouldShowMore ? () => setExpanded((value) => !value) : undefined
      }
      activeOpacity={0.7}
      style={{ marginTop: 6 }}
    >
      <Text
        style={styles.caption}
        numberOfLines={expanded ? undefined : MAX_CAPTION_LINES}
      >
        {text || ""}
      </Text>
      {shouldShowMore && (
        <TouchableOpacity
          onPress={() => setExpanded((value) => !value)}
          activeOpacity={0.7}
          style={{ marginTop: 4 }}
        >
          <Text style={styles.moreText}>
            {expanded ? "Show less" : "Show more"}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function VideoItem({
  video,
  isVisible,
  onLike,
  onComment,
  onShare,
  onDownload,
  onFollow,
  onProfilePress,
  onUpload,
  currentUserId,
}) {
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const sharingRef = useRef(false);

  const playableVideoUrl = getPlayableVideoUrl(video?.videoUrl);
  const player = useVideoPlayer(playableVideoUrl || undefined, (p) => {
    p.loop = true;
  });

  const [videoStatus, setVideoStatus] = useState("idle");
  const [videoError, setVideoError] = useState(null);

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("statusChange", (payload) => {
      setVideoStatus(payload.status);
      if (payload.status === "error") {
        const message =
          payload.error?.message || "This video could not be played.";
        console.error("Video playback error:", payload.error || message);
        setVideoError(message);
      } else if (payload.status === "readyToPlay") {
        setVideoError(null);
      }
    });

    return () => subscription?.remove?.();
  }, [player]);

  useEffect(() => {
    if (!player) return;
    // eslint-disable-next-line react-hooks/immutability
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    if (!player || !playableVideoUrl || videoError) return;

    if (isVisible && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, playableVideoUrl, isVisible, paused, videoError]);

  useEffect(() => {
    if (!player || !playableVideoUrl || videoStatus === "readyToPlay") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      if (player.status !== "readyToPlay") {
        setVideoError("Video is taking too long to load.");
      }
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [player, playableVideoUrl, videoStatus]);

  const handleVideoTap = () => {
    setShowPlayOverlay(true);
    setPaused((p) => !p);
    setTimeout(() => setShowPlayOverlay(false), 800);
  };

  const handleRetry = async () => {
    if (!player || !playableVideoUrl) return;

    setVideoError(null);
    setVideoStatus("loading");
    try {
      await player.replaceAsync(playableVideoUrl);
      if (isVisible && !paused) player.play();
    } catch (error) {
      const message = error?.message || "This video could not be played.";
      setVideoStatus("error");
      setVideoError(message);
    }
  };

  const handleLike = () => {
    if (!video?.id || typeof onLike !== "function") return;
    onLike(video.id);
  };

  const handleComment = () => {
    if (!video?.id || typeof onComment !== "function") return;
    onComment(video.id);
  };

  const liked = video.liked;
  const likesCount = video.likes;

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(video);
      return;
    }
    try {
      setIsDownloading(true);
      await downloadAndSaveVideo(video.id, (progress) => {});
      Alert.alert(
        "Success",
        Platform.OS === "web"
          ? "Your video download has started."
          : "Video saved to gallery.",
      );
    } catch (_err) {
      Alert.alert("Download failed", _err.message || "Could not save video");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;

    try {
      if (onShare) {
        onShare(video);
      } else {
        setIsSharing(true);
        const link =
          Platform.OS === "web" && typeof window !== "undefined"
            ? new URL(
                `/video/${encodeURIComponent(video.id)}`,
                window.location.origin,
              ).toString()
            : `linkapp://video/${video.id}`;
        const message = [video.caption, link].filter(Boolean).join("\n");

        if (Platform.OS === "web") {
          if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share({
              title: video.uploader?.username
                ? `Video by @${video.uploader.username}`
                : "LinkApp video",
              text: video.caption || "",
              url: link,
            });
          } else if (
            typeof navigator !== "undefined" &&
            navigator.clipboard?.writeText
          ) {
            await navigator.clipboard.writeText(message);
            Alert.alert("Link copied", "The video link is ready to share.");
          } else {
            throw new Error("Sharing is not available in this browser.");
          }
        } else {
          await Share.share({ message, url: link });
        }
      }

      try {
        await shareVideo(video.id);
      } catch (error) {
        console.error("Share count update failed:", error);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Share error:", error);
        Alert.alert(
          "Share failed",
          error.message || "Could not share this video.",
        );
      }
    } finally {
      sharingRef.current = false;
      setIsSharing(false);
    }
  };

  const isOwnVideo = currentUserId === video.uploader?.id;
  const alreadyFollowed = video.uploader?.followed;
  const showFollow = !isOwnVideo && !alreadyFollowed;

  return (
    <View
      style={[styles.container, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
    >
      <Pressable style={styles.videoWrapper} onPress={handleVideoTap}>
        {videoError ? (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <View style={styles.videoErrorContent}>
              <Text style={styles.videoErrorText}>
                {videoError || "Failed to load video"}
              </Text>
              <TouchableOpacity
                style={styles.retryVideoBtn}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry video playback"
              >
                <Text style={styles.retryVideoText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : playableVideoUrl ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            playsInline
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {showPlayOverlay && (
          <View style={styles.playOverlay}>
            {paused ? (
              <Play size={60} color="#fff" />
            ) : (
              <Pause size={60} color="#fff" />
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.muteBtn, { top: insets.top + 12 }]}
          onPress={() => setIsMuted((m) => !m)}
          activeOpacity={0.7}
        >
          {isMuted ? (
            <VolumeX size={22} color="#fff" />
          ) : (
            <Volume2 size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </Pressable>

      {/* Bottom-left overlay */}
      <View
        style={[styles.bottomLeft, { left: 16, bottom: insets.bottom + 60 }]}
      >
        <View style={styles.uploaderRow}>
          <TouchableOpacity onPress={() => onProfilePress(video.uploader)}>
            <UserAvatar uri={video.uploader?.profilePic} size={44} showBorder />
          </TouchableOpacity>

          <Text style={styles.username}>
            @{video.uploader?.username || "user"}
          </Text>

          <TouchableOpacity
            style={styles.followChip}
            onPress={() => onFollow(video.uploader?.id)}
            activeOpacity={0.7}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.followText}>Follow</Text>
          </TouchableOpacity>
        </View>

        <ExpandableCaption text={video.caption} />

        <View style={styles.musicRow}>
          <Music size={14} color="#fff" />
          <Text style={styles.musicText} numberOfLines={1}>
            {video.musicTitle || "Original Sound"}
          </Text>
        </View>
      </View>

      {/* Right-side action column */}
      <View
        style={[styles.rightColumn, { right: 12, bottom: insets.bottom + 120 }]}
      >
        {showFollow && (
          <TouchableOpacity
            style={styles.followAvatarWrapper}
            onPress={() => onFollow(video.uploader?.id)}
            activeOpacity={0.7}
          >
            <UserAvatar uri={video.uploader?.profilePic} size={44} showBorder />
            <View style={styles.smallPlusBtn}>
              <Plus size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        <ActionButton
          icon={Heart}
          count={likesCount}
          onPress={handleLike}
          active={liked}
          iconProps={{ color: liked ? "#ff3b30" : "#fff" }}
        />

        <TouchableOpacity
          style={[styles.actionItem, styles.commentButton]}
          onPress={handleComment}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open comments"
        >
          <MessageCircle size={32} color="#fff" />
          <Text style={styles.actionCount}>{video.comments || 0}</Text>
        </TouchableOpacity>

        <ActionButton
          icon={Share2}
          count={video.shares || 0}
          onPress={handleShare}
          iconProps={{ color: isSharing ? "#aaa" : "#fff" }}
        />

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleDownload}
          activeOpacity={0.7}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Download size={28} color="#fff" />
          )}
        </TouchableOpacity>

        <View style={styles.actionItem}>
          <View style={styles.musicDisc}>
            <Music size={24} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
  },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  videoErrorContent: {
    alignItems: "center",
    gap: 12,
  },
  videoErrorText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "500",
  },
  retryVideoBtn: {
    backgroundColor: "#05a31dff",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retryVideoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  muteBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 22,
    padding: 8,
    zIndex: 10,
  },
  bottomLeft: {
    position: "absolute",
    left: 0,
    bottom: 0,
    right: 160,
    paddingRight: 10,
  },
  uploaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  username: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  followChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ff3b30",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  followText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  caption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  captionToggle: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  moreText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.9,
  },
  musicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  musicText: {
    color: "#fff",
    fontSize: 13,
    opacity: 0.9,
  },
  rightColumn: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    gap: 2,
  },
  actionItem: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  commentButton: {
    minWidth: 44,
    minHeight: 44,
    zIndex: 2,
    elevation: 2,
  },
  actionCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  followAvatarWrapper: {
    position: "relative",
    marginBottom: 10,
  },
  smallPlusBtn: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    padding: 2,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  musicDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 10,
  },
});

export default VideoItem;
