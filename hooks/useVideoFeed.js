import { useState, useCallback } from "react";
import { fetchVideos, likeVideo, unlikeVideo } from "../services/videos";

export default function useVideoFeed() {
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
        const newVideos = data.videos || data.data || [];
        const nextCursor = data.nextCursor || data.cursor || null;

        if (reset) {
          setVideos(newVideos);
        } else {
          setVideos((prev) => [...prev, ...newVideos]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
        setError(null);
      } catch (_err) {
        console.error("Load videos error:", _err);
        setError(_err.message || "Failed to load videos");
        if (reset) setRefreshing(false);
        if (!reset) setLoadingMore(false);
      } finally {
        setLoading(false);
        if (reset) setRefreshing(false);
        if (!reset) setLoadingMore(false);
      }
    },
    [cursor, hasMore, loadingMore],
  );

  const toggleLike = useCallback(
    async (videoId) => {
      const prev = videos.find((v) => v.id === videoId);
      if (!prev) return;

      const newLiked = !prev.liked;
      const newLikes = prev.likes + (newLiked ? 1 : -1);

      setVideos((prevVideos) =>
        prevVideos.map((v) =>
          v.id === videoId
            ? { ...v, liked: newLiked, likes: newLikes }
            : v,
        ),
      );

      try {
        if (newLiked) {
          await likeVideo(videoId);
        } else {
          await unlikeVideo(videoId);
        }
      } catch (_err) {
        setVideos((prevVideos) =>
          prevVideos.map((v) =>
            v.id === videoId
              ? { ...v, liked: prev.liked, likes: prev.likes }
              : v,
          ),
        );
      }
    },
    [videos],
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
    loadMore: () => loadVideos(false),
    refresh: () => loadVideos(true),
    toggleLike,
    removeVideo,
    updateVideo,
    setVideos,
  };
}
