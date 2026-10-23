import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Heart,
  MessageCircle,
  Share2,
  Download,
  Music,
  Plus,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import UserAvatar from "./UserAvatar";
import ActionButton from "./ActionButton";
import {
  downloadAndSaveVideo,
  shareVideo,
} from "../services/videos";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MAX_CAPTION_LINES = 3;

function ExpandableCaption({ text }) {
  const [expanded, setExpanded] = useState(false);

  const shouldShowMore = text && text.length > 100;

  return (
    <Pressable
      onPress={shouldShowMore ? () => setExpanded((e) => !e) : undefined}
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
          onPress={() => setExpanded((e) => !e)}
          style={{ marginTop: 4 }}
        >
          <Text style={styles.moreText}>
            {expanded ? "Show less" : "Show more"}
          </Text>
        </TouchableOpacity>
      )}
    </Pressable>
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

  const player = useVideoPlayer(video?.videoUrl || undefined, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!player) return;
    // eslint-disable-next-line react-hooks/immutability
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    if (!player || !video?.videoUrl) return;

    // eslint-disable-next-line react-hooks/immutability
    player.uri = video.videoUrl;

    if (isVisible && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, video?.videoUrl, isVisible, paused]);

  const handleVideoTap = () => {
    setShowPlayOverlay(true);
    setPaused((p) => !p);
    setTimeout(() => setShowPlayOverlay(false), 800);
  };

  const handleLike = () => {
    onLike(video.id);
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
      Alert.alert("Success", "Video saved to gallery");
     } catch (_err) {
      Alert.alert("Download failed", _err.message || "Could not save video");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare(video);
      return;
    }
    try {
      setIsSharing(true);
      shareVideo(video.id);
      const link = `linkapp://video/${video.id}`;
      await Share.share({
        message: video.caption || "",
        url: link,
      });
    } catch (_err) {
      console.error("Share error:", _err);
    } finally {
      setIsSharing(false);
    }
  };

  const isOwnVideo = currentUserId === video.uploader?.id;
  const alreadyFollowed = video.uploader?.followed;
  const showFollow = !isOwnVideo && !alreadyFollowed;

  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      <Pressable style={styles.videoWrapper} onPress={handleVideoTap}>
        {video.videoUrl ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
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
      <View style={[styles.bottomLeft, { left: 16, bottom: insets.bottom + 60 }]}>
        <View style={styles.uploaderRow}>
          <TouchableOpacity onPress={() => onProfilePress(video.uploader)}>
            <UserAvatar uri={video.uploader?.profilePic} size={44} showBorder />
          </TouchableOpacity>

          <Text style={styles.username}>@{video.uploader?.username || "user"}</Text>

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
      <View style={[styles.rightColumn, { right: 12, bottom: insets.bottom + 120 }]}>
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

        <TouchableOpacity style={styles.actionItem} onPress={() => onComment(video.id)}>
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
