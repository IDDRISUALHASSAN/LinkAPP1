import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  fetchVideos,
  likeVideo,
  normalizeVideo,
  normalizeVideoId,
  unlikeVideo,
} from "../services/videos";
import { isAuthError } from "../services/api";

export default function useVideoFeed(onAuthError) {
  const likingVideoIds = useRef(new Set());
  const [videos, setVideos] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const loadVideos = useCallback(
    async (reset = false) => {
      if (reset) {
        setRefreshing(true);
        setCursor(null);
        setVideos([]);
        setHasMore(true);
        setError(null);
      } else if (!hasMore || loadingMore) {
        return;
      }

      if (!reset) setLoadingMore(true);

      try {
        const data = await fetchVideos(reset ? null : cursor, 10);
        const rawVideos = Array.isArray(data.videos)
          ? data.videos
          : Array.isArray(data.data)
            ? data.data
            : [];
        const newVideos = rawVideos.map(normalizeVideo).filter(Boolean);
        const nextCursor = data.nextCursor || data.cursor || null;

        if (reset) {
          setVideos(newVideos);
        } else {
          setVideos((prev) => [...prev, ...newVideos]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
        setError(null);
      } catch (err) {
        console.error("Load videos error:", err);
        setError(err.message || "Failed to load videos");
        if (isAuthError(err) && onAuthError) {
          onAuthError(err);
        }
        if (reset) setRefreshing(false);
        if (!reset) setLoadingMore(false);
      } finally {
        setLoading(false);
        if (reset) setRefreshing(false);
        if (!reset) setLoadingMore(false);
      }
    },
    [cursor, hasMore, loadingMore, onAuthError],
  );

  const loadVideosRef = useRef(loadVideos);
  useEffect(() => {
    loadVideosRef.current = loadVideos;
  }, [loadVideos]);
  const loadMore = useCallback(() => loadVideosRef.current(false), []);
  const refresh = useCallback(() => loadVideosRef.current(true), []);

  const toggleLike = useCallback(
    async (videoId) => {
      if (!videoId || likingVideoIds.current.has(videoId)) return;
      const targetId = normalizeVideoId(videoId);
      const prev = videos.find(
        (video) => normalizeVideoId(video.id) === targetId,
      );
      if (!prev?.id || !targetId) return;

      likingVideoIds.current.add(targetId);
      const wasLiked = Boolean(prev.liked);
      const previousLikes = Number(prev.likes) || 0;
      const newLiked = !wasLiked;
      const newLikes = Math.max(0, previousLikes + (newLiked ? 1 : -1));

      setVideos((prevVideos) =>
        prevVideos.map((video) =>
          normalizeVideoId(video.id) === targetId
            ? { ...video, liked: newLiked, likes: newLikes }
            : video,
        ),
      );

      try {
        if (newLiked) {
          await likeVideo(targetId);
        } else {
          await unlikeVideo(targetId);
        }
      } catch (err) {
        console.error("Toggle video like error:", err);
        setVideos((prevVideos) =>
          prevVideos.map((video) =>
            normalizeVideoId(video.id) === targetId
              ? { ...video, liked: wasLiked, likes: previousLikes }
              : video,
          ),
        );
        if (isAuthError(err) && onAuthError) {
          onAuthError(err);
        } else {
          Alert.alert("Like failed", err.message || "Please try again.");
        }
      } finally {
        likingVideoIds.current.delete(targetId);
      }
    },
    [videos, onAuthError],
  );

  const removeVideo = useCallback((videoId) => {
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
  }, []);

  const updateVideo = useCallback((videoId, updates) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, ...updates } : v)),
    );
  }, []);

  return {
    videos,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    loadVideos,
    loadMore,
    refresh,
    toggleLike,
    removeVideo,
    updateVideo,
    setVideos,
  };
}
