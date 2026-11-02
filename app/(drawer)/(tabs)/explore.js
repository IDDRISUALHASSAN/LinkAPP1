import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CommentSheet from "@/components/CommentSheet";
import VideoItem from "@/components/VideoItem";
import useVideoFeed from "@/hooks/useVideoFeed";
import { followUploader, unfollowUploader, normalizeVideoId } from "@/services/videos";
  import { clearAuth, isAuthError } from "@/services/api";

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
};

const ListFooter = ({ loadingMore }) =>
  loadingMore ? (
    <View style={styles.footer}>
      <ActivityIndicator size="large" color="#05a31dff" />
    </View>
  ) : null;

const EmptyState = ({
  loading,
  refreshing,
  error,
  router,
  feedMode,
  onChangeFeed,
}) =>
  !loading && !refreshing && !error ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {feedMode === "following"
          ? "No videos from people you follow yet."
          : "No videos yet. Be the first to upload!"}
      </Text>
      {feedMode === "following" ? (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => onChangeFeed("forYou")}
        >
          <Text style={styles.emptyBtnText}>Browse For You</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push("/(screens)/upload")}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.emptyBtnText}>Upload a video</Text>
        </TouchableOpacity>
      )}
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

const MemoizedVideoItem = memo(VideoItem);

export default function Explore() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [feedMode, setFeedMode] = useState("forYou");

  const handleAuthError = useCallback(async (_err) => {
    await clearAuth();
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please log in again.",
      [{ text: "OK", onPress: () => router.replace("/(screens)") }],
    );
  }, [router]);

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
  } = useVideoFeed(handleAuthError, feedMode);

  const [activeIndex, setActiveIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentVideoOwnerId, setCurrentVideoOwnerId] = useState(null);
  const [listHeight, setListHeight] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const listRef = useRef(null);
  const feedModeMountedRef = useRef(false);
  const viewabilityConfig = VIEWABILITY_CONFIG;

  useEffect(() => {
    const loadUser = async () => {
      const userId = await AsyncStorage.getItem("userId");
      setCurrentUserId(userId);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppState(state);
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setActiveIndex(0);
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!feedModeMountedRef.current) {
      feedModeMountedRef.current = true;
      return;
    }
    setActiveIndex(0);
    refresh();
  }, [feedMode, refresh]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    const nextVisibleItem = viewableItems
      .filter(({ index }) => typeof index === "number")
      .sort(
        (a, b) =>
          (b.percentVisible ?? 0) - (a.percentVisible ?? 0) ||
          a.index - b.index,
      )[0];

    if (nextVisibleItem) {
      setActiveIndex(nextVisibleItem.index);
    }
  }, []);

  const handleLike = useCallback(
    (videoId) => {
      toggleLike(videoId);
    },
    [toggleLike],
  );

  const handleComment = useCallback(
    (videoId) => {
      if (!videoId) return;

      const video = videos.find(
        (item) => String(item.id) === String(videoId),
      );
      if (!video) return;

      setCurrentVideoId(video.id);
      setCurrentVideoOwnerId(video.uploader?.id ?? null);
      setCommentSheetVisible(true);
    },
    [videos],
  );

  const handleShare = useCallback(
    (video) => {
      setVideos((prev) =>
        prev.map((v) =>
          normalizeVideoId(v.id) === normalizeVideoId(video.id)
            ? { ...v, shares: (v.shares || 0) + 1 }
            : v,
        ),
      );
    },
    [setVideos],
  );

  const handleFollow = useCallback(
    async (uploaderId) => {
      if (!uploaderId) return;

      const prevVideo = videos.find(
        (v) => normalizeVideoId(v.uploader?.id) === normalizeVideoId(uploaderId),
      );
      const isFollowingNow = prevVideo?.uploader?.followed || false;

      try {
        if (isFollowingNow) {
          await unfollowUploader(uploaderId);
          setVideos((prev) =>
            prev.map((v) =>
              normalizeVideoId(v.uploader?.id) === normalizeVideoId(uploaderId)
                ? { ...v, uploader: { ...v.uploader, followed: false } }
                : v,
            ),
          );
        } else {
          await followUploader(uploaderId);
          setVideos((prev) =>
            prev.map((v) =>
              normalizeVideoId(v.uploader?.id) === normalizeVideoId(uploaderId)
                ? { ...v, uploader: { ...v.uploader, followed: true } }
                : v,
            ),
          );
        }
      } catch (_err) {
        console.error("Follow error:", _err);
        if (isAuthError(_err)) {
          handleAuthError(_err);
        } else {
          Alert.alert("Follow failed", _err.message || "Please try again.");
        }
      }
    },
    [videos, setVideos, handleAuthError],
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

  const handleRefresh = useCallback(() => {
    setActiveIndex(0);
    refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadingMore, loading, loadMore]);

  const renderItem = ({ item, index }) => (
    <MemoizedVideoItem
      video={item}
      isVisible={isFocused && index === activeIndex}
      onLike={handleLike}
      onComment={handleComment}
      onShare={handleShare}
      onFollow={handleFollow}
      onProfilePress={handleProfilePress}
      currentUserId={currentUserId}
      appState={appState}
      itemHeight={listHeight}
    />
  );

  const getItemLayout = useCallback(
    (_data, index) => ({
      length: listHeight,
      offset: listHeight * index,
      index,
    }),
    [listHeight],
  );

  const onLayout = useCallback((event) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (height > 0) {
      setListHeight((currentHeight) =>
        currentHeight === height ? currentHeight : height,
      );
    }
  }, []);

  const handleEndReached = useCallback(() => {
    if (videos.length > 0 && videos.length - activeIndex <= 3) {
      handleLoadMore();
    }
  }, [videos.length, activeIndex, handleLoadMore]);

  return (
    <View style={styles.container}>
      <ErrorBanner error={error} onRetry={handleRefresh} />

      <View style={styles.feedViewport} onLayout={onLayout}>
        <View style={styles.feedSwitcher} accessibilityRole="tablist">
          {[
            { key: "forYou", label: "For You" },
            { key: "following", label: "Following" },
          ].map((option) => {
            const selected = feedMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.feedSwitchOption, selected && styles.feedSwitchSelected]}
                onPress={() => setFeedMode(option.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.feedSwitchText,
                    selected && styles.feedSwitchSelectedText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !refreshing && videos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#05a31dff" />
          </View>
        ) : listHeight === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#05a31dff" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            data={videos}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              normalizeVideoId(item.id) || `video-${index}`
            }
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={<ListFooter loadingMore={loadingMore} />}
            ListEmptyComponent={
              <EmptyState
                loading={loading}
                refreshing={refreshing}
                error={error}
                router={router}
                feedMode={feedMode}
                onChangeFeed={setFeedMode}
              />
            }
            scrollEventThrottle={16}
            removeClippedSubviews
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.uploadBtn, { bottom: insets.bottom + 24, right: 16 }]}
        onPress={() => router.push("/(screens)/upload")}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>

      {currentVideoId && (
        <CommentSheet
          visible={commentSheetVisible}
          onDismiss={() => setCommentSheetVisible(false)}
          videoId={currentVideoId}
          videoOwnerId={currentVideoOwnerId}
          currentUserId={currentUserId}
          onCommentAdded={() => {
            setVideos((prev) =>
              prev.map((v) =>
                normalizeVideoId(v.id) === normalizeVideoId(currentVideoId)
                  ? { ...v, comments: (v.comments || 0) + 1 }
                  : v,
              ),
            );
          }}
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
  feedViewport: {
    flex: 1,
    position: "relative",
  },
  feedSwitcher: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,20,0.82)",
    zIndex: 20,
    elevation: 8,
  },
  feedSwitchOption: {
    minWidth: 82,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  feedSwitchSelected: {
    backgroundColor: "#05a31d",
  },
  feedSwitchText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
  },
  feedSwitchSelectedText: {
    color: "#fff",
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    height: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
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
  muteBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 22,
    padding: 8,
    zIndex: 10,
  },
});
