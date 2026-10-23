import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import VideoItem from "@/components/VideoItem";
import CommentSheet from "@/components/CommentSheet";
import { fetchVideo, likeVideo, unlikeVideo, followUploader, unfollowUploader } from "@/services/videos";

export default function VideoPlayer() {
  const router = useRouter();
  const { id, openComments } = useLocalSearchParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);

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
      const v = data.video || data;
      setVideo(v);
      setLiked(v.liked || false);
      setLikesCount(v.likes || 0);

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
      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount((c) => c + (newLiked ? 1 : -1));

      try {
        if (newLiked) {
          await likeVideo(videoId);
        } else {
          await unlikeVideo(videoId);
        }
      } catch (_err) {
        setLiked(!newLiked);
        setLikesCount((c) => c + (newLiked ? -1 : 1));
      }
    },
    [liked],
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
  };

  return (
    <View style={styles.container}>
      <VideoItem
        video={videoWithLikes}
        isVisible={true}
        onLike={handleLike}
        onComment={() => setCommentSheetVisible(true)}
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
