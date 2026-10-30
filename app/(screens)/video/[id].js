import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import CommentSheet from "@/components/CommentSheet";
import VideoItem from "@/components/VideoItem";
import {
    fetchVideo,
    followUploader,
    likeVideo,
    normalizeVideo,
    unfollowUploader,
    unlikeVideo,
  } from "@/services/videos";

export default function VideoPlayer() {
  const router = useRouter();
  const { id, openComments } = useLocalSearchParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const likingRef = useRef(false);

  useEffect(() => {
    const loadUser = async () => {
      const userId = await AsyncStorage.getItem("userId");
      setCurrentUserId(userId);
    };
    loadUser();
  }, []);

  const loadVideo = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchVideo(id);
      const v = normalizeVideo(data.video || data);
      if (!v) throw new Error("Invalid video ID");
      setVideo(v);
      setLiked(v.liked || false);
      setLikesCount(v.likes || 0);
      setCommentCount(v.comments || 0);
      setShareCount(v.shares || 0);

      if (openComments === "true" || openComments === "1") {
        setCommentSheetVisible(true);
      }
    } catch (_err) {
      console.error("Load video error:", _err);
      Alert.alert("Error", "Could not load video");
    } finally {
      setLoading(false);
    }
  }, [id, openComments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVideo();
  }, [loadVideo]);

  const handleLike = useCallback(
    async (videoId) => {
      if (likingRef.current) return;
      likingRef.current = true;

      const previousLiked = liked;
      const previousLikesCount = likesCount;
      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount(Math.max(0, previousLikesCount + (newLiked ? 1 : -1)));

      try {
        if (newLiked) {
          await likeVideo(videoId);
        } else {
          await unlikeVideo(videoId);
        }
      } catch (error) {
        console.error("Toggle video like error:", error);
        setLiked(previousLiked);
        setLikesCount(previousLikesCount);
        Alert.alert("Like failed", error.message || "Please try again.");
      } finally {
        likingRef.current = false;
      }
    },
    [liked, likesCount],
  );

  const handleFollow = async (uploaderId) => {
    if (!uploaderId) return;
    try {
      if (video?.uploader?.followed) {
        await unfollowUploader(uploaderId);
        setVideo((prev) => ({
          ...prev,
          uploader: { ...prev.uploader, followed: false },
        }));
      } else {
        await followUploader(uploaderId);
        setVideo((prev) => ({
          ...prev,
          uploader: { ...prev.uploader, followed: true },
        }));
      }
    } catch (_err) {
      console.error("Follow error:", _err);
    }
  };

  const handleProfilePress = useCallback(
    (uploader) => {
      if (!uploader?.id) return;
      router.push({
        pathname: "/(drawer)/profile",
        params: { userId: uploader.id },
      });
    },
    [router],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Video not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoWithLikes = {
    ...video,
    liked,
    likes: likesCount,
    comments: commentCount,
    shares: shareCount,
  };

  return (
    <View style={styles.container}>
      <VideoItem
        video={videoWithLikes}
        isVisible={true}
        onLike={handleLike}
        onComment={() => setCommentSheetVisible(true)}
        onShare={() => setShareCount((prev) => prev + 1)}
        onFollow={handleFollow}
        onProfilePress={handleProfilePress}
        currentUserId={currentUserId}
      />

      <CommentSheet
        visible={commentSheetVisible}
        onDismiss={() => setCommentSheetVisible(false)}
        videoId={video.id}
        videoOwnerId={video.uploader?.id}
        currentUserId={currentUserId}
        onCommentAdded={() => setCommentCount((prev) => prev + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
  },
  backText: {
    color: "#05a31dff",
    fontSize: 16,
    fontWeight: "600",
  },
});
