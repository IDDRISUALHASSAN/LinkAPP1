import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useVideoFeed } from "@/hooks/useVideoFeed";
import VideoItem from "@/components/VideoItem";
import CommentSheet from "@/components/CommentSheet";
import { followUploader, unfollowUploader } from "@/services/videos";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const ListFooter = ({ loadingMore }) =>
  loadingMore ? (
    <View style={[styles.footer, { height: SCREEN_HEIGHT }]}>
      <ActivityIndicator size="large" color="#05a31dff" />
    </View>
  ) : null;

const EmptyState = ({ loading, refreshing, error, router }) =>
  !loading && !refreshing && !error ? (
    <View style={[styles.emptyContainer, { height: SCREEN_HEIGHT }]}>
      <Text style={styles.emptyText}>No videos yet. Be the first to upload!</Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => router.push("/(screens)/upload")}
      >
        <Plus size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Upload a video</Text>
      </TouchableOpacity>
    </View>
  ) : null;

const ErrorBanner = ({ error, onRetry }) =>
  error ? (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : null;

export default function Explore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    videos,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    toggleLike,
    setVideos,
  } = useVideoFeed();

  const [visibleIndex, setVisibleIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentVideoOwnerId, setCurrentVideoOwnerId] = useState(null);
  const [isFollowing, setIsFollowing] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      const userId = await AsyncStorage.getItem("userId");
      setCurrentUserId(userId);
    };
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const viewabilityConfig = {
    viewAreaCoveragePercentThreshold: 50,
  };

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
      if (viewableItems.length > 0) {
        setVisibleIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const handleLike = useCallback(
    (videoId) => {
      toggleLike(videoId);
    },
    [toggleLike],
  );

  const handleComment = useCallback((video) => {
    setCurrentVideoId(video.id);
    setCurrentVideoOwnerId(video.uploader?.id);
    setCommentSheetVisible(true);
  }, []);

  const handleFollow = useCallback(
    async (uploaderId) => {
      if (!uploaderId) return;
      setIsFollowing((prev) => ({ ...prev, [uploaderId]: !prev[uploaderId] }));

      try {
        const isFollowingNow = isFollowing[uploaderId] || false;
        if (isFollowingNow) {
          await unfollowUploader(uploaderId);
        } else {
          await followUploader(uploaderId);
          setVideos((prev) =>
            prev.map((v) =>
              v.uploader?.id === uploaderId
                ? { ...v, uploader: { ...v.uploader, followed: true } }
                : v,
            ),
          );
        }
      } catch (_err) {
        setIsFollowing((prev) => ({ ...prev, [uploaderId]: !prev[uploaderId] }));
        console.error("Follow error:", _err);
      }
    },
    [isFollowing, setVideos],
  );

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

  const renderItem = ({ item, index }) => (
    <VideoItem
      video={item}
      isVisible={index === visibleIndex}
      onLike={handleLike}
      onComment={() => handleComment(item)}
      onFollow={handleFollow}
      onProfilePress={handleProfilePress}
      currentUserId={currentUserId}
      key={item.id}
    />
  );

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      loadMore();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ErrorBanner error={error} onRetry={refresh} />

      {loading && !refreshing && videos.length === 0 ? (
        <View style={[styles.loadingContainer, { height: SCREEN_HEIGHT }]}>
          <ActivityIndicator size="large" color="#05a31dff" />
        </View>
      ) : (
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          snapToInterval={SCREEN_HEIGHT - insets.top}
          decelerationRate="fast"
          snapToAlignment="start"
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<ListFooter loadingMore={loadingMore} />}
          ListEmptyComponent={
            <EmptyState
              loading={loading}
              refreshing={refreshing}
              error={error}
              router={router}
            />
          }
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}

      {/* Floating Plus button */}
      <TouchableOpacity
        style={[styles.uploadBtn, { bottom: insets.bottom + 24, right: 16 }]}
        onPress={() => router.push("/(screens)/upload")}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>

      {/* Comment Sheet */}
      {currentVideoId && (
        <CommentSheet
          visible={commentSheetVisible}
          onDismiss={() => setCommentSheetVisible(false)}
          videoId={currentVideoId}
          videoOwnerId={currentVideoOwnerId}
          currentUserId={currentUserId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 32,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#05a31dff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#ff3b30",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  uploadBtn: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#05a31dff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
