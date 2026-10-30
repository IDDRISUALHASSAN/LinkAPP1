import { useRouter } from "expo-router";
import { isAuthError, clearAuth, getAuthHeaders } from "../services/api";
import { MessageCircle, Send, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchComments, postComment } from "../services/comments";
import { normalizeVideoId } from "../services/videos";
import CommentItem from "./CommentItem";

export default function CommentSheet({
  visible,
  onDismiss,
  videoId,
  videoOwnerId,
  currentUserId,
  onCommentAdded,
}) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const handleAuthError = useCallback(async () => {
    await clearAuth();
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please log in again.",
      [{ text: "OK", onPress: () => router.replace("/(screens)") }],
    );
  }, [router]);

  const [comments, setComments] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const paginationRef = useRef({ cursor: null, hasMore: true, loading: false });

  const loadComments = useCallback(
    async (reset = false) => {
      if (reset) {
        paginationRef.current = { cursor: null, hasMore: true, loading: true };
        setLoading(true);
        setCommentsError(null);
        setComments([]);
        setHasMore(true);
      } else if (
        !paginationRef.current.hasMore ||
        paginationRef.current.loading
      ) {
        return;
      } else {
        paginationRef.current.loading = true;
        setLoading(true);
      }

      try {
        const res = await fetchComments(
          videoId,
          reset ? null : paginationRef.current.cursor,
          20,
        );
        const newComments = res.comments || res.data || [];
        const newCursor = res.nextCursor || res.cursor || null;

        if (reset) {
          setComments(newComments);
        } else {
          setComments((prev) => [...prev, ...newComments]);
        }
        setHasMore(!!newCursor);
        setCommentsError(null);
        paginationRef.current.cursor = newCursor;
        paginationRef.current.hasMore = !!newCursor;
      } catch (err) {
        console.error("Load comments error:", {
          status: err?.status,
          message: err?.message,
          data: err?.data,
        });
        if (isAuthError(err)) {
          handleAuthError();
          return;
        }
        setCommentsError(
          err?.status
            ? `${err.message || "Failed to load comments"} (HTTP ${err.status})`
            : err?.message || "Failed to load comments",
        );
      } finally {
        setLoading(false);
        paginationRef.current.loading = false;
      }
    },
    [videoId, handleAuthError],
  );

  useEffect(() => {
    if (!visible || !videoId) return undefined;

    const loadTimer = setTimeout(() => {
      setInputText("");
      setReplyingTo(null);
      loadComments(true);
    }, 0);

    return () => clearTimeout(loadTimer);
  }, [visible, videoId, loadComments]);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !videoId || sending) return;

    const { Authorization } = await getAuthHeaders();
    if (!Authorization) {
      Alert.alert("Sign in required", "Please sign in to add a comment.");
      return;
    }

    setSending(true);
    try {
      const res = await postComment(videoId, text, replyingTo?.id || null);

      const responseComment = res.comment || res.data?.comment || res.data;
      const newComment = {
        id: responseComment?.id ?? `local-${Date.now()}`,
        userId: currentUserId,
        text,
        createdAt: new Date().toISOString(),
        likes: 0,
        liked: false,
        replyCount: 0,
        ...responseComment,
        isNew: true,
      };

      if (replyingTo) {
        setComments((prev) =>
          prev.map((comment) =>
            normalizeVideoId(comment.id) === normalizeVideoId(replyingTo.id)
              ? {
                  ...comment,
                  replyCount: (comment.replyCount || 0) + 1,
                  replies: [...(comment.replies || []), newComment],
                }
              : comment,
          ),
        );
        onCommentAdded?.();
      } else {
        setComments((prev) => [newComment, ...prev]);
        onCommentAdded?.();
      }

      setInputText("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Send comment error:", err);
      if (isAuthError(err)) {
        handleAuthError();
        return;
      }
      Alert.alert("Error", err?.message || "Failed to send comment");
    } finally {
      setSending(false);
    }
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    setInputText("");
    // Focus the input
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setInputText("");
  };

  const handleUpdateComment = (commentId, updates) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, ...updates } : c)),
    );
  };

  const handleDeleteComment = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentAdded?.();
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadComments(false);
    }
  };

  const renderItem = ({ item }) => (
    <CommentItem
      comment={item}
      videoOwnerId={videoOwnerId}
      currentUserId={currentUserId}
      onReply={handleReply}
      onUpdate={handleUpdateComment}
      onDelete={handleDeleteComment}
    />
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#05a31dff" />
      </View>
    );
  };

  const inputRef = useRef(null);

  const sheetHeight = 500;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      hardwareAccelerated
    >
      <View style={styles.modalContainer}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={Keyboard.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss comments"
        />
        <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetHeight + insets.bottom,
                backgroundColor: isDark ? "#121212" : "#fff",
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sheetHeight, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: isDark ? "#fff" : "#333" }]}>
                Comments
              </Text>
              <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
                <X size={20} color={isDark ? "#fff" : "#333"} />
              </TouchableOpacity>
            </View>

            {loading && comments.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#05a31dff" />
              </View>
            ) : commentsError && comments.length === 0 ? (
              <View style={styles.center}>
                <MessageCircle size={48} color={isDark ? "#555" : "#ccc"} />
                <Text
                  style={[
                    styles.emptyText,
                    { color: isDark ? "#bbb" : "#555" },
                  ]}
                >
                  Comments are temporarily unavailable
                </Text>
                <Text
                  style={[
                    styles.errorDetail,
                    { color: isDark ? "#888" : "#777" },
                  ]}
                >
                  {commentsError}
                </Text>
                <TouchableOpacity
                  style={styles.retryCommentsBtn}
                  onPress={() => loadComments(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading comments"
                >
                  <Text style={styles.retryCommentsText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : comments.length === 0 && !loading ? (
              <View style={styles.center}>
                <MessageCircle size={48} color={isDark ? "#555" : "#ccc"} />
                <Text
                  style={[
                    styles.emptyText,
                    { color: isDark ? "#888" : "#999" },
                  ]}
                >
                  No comments yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) =>
                  item.id?.toString() || Math.random().toString()
                }
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 80 + insets.bottom,
                }}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                showsVerticalScrollIndicator={false}
              />
            )}

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
              style={[
                styles.inputContainer,
                {
                  backgroundColor: isDark ? "#1e1e1e" : "#f8f8f8",
                  paddingBottom: Math.max(insets.bottom, 10),
                  borderTopColor: isDark ? "#333" : "#e0e0e0",
                },
              ]}
            >
              {replyingTo ? (
                <View style={styles.replyChip}>
                  <Text
                    style={[
                      styles.replyText,
                      { color: isDark ? "#aaa" : "#777" },
                    ]}
                  >
                    Replying to @{replyingTo.username || "user"}
                  </Text>
                  <TouchableOpacity onPress={cancelReply}>
                    <X size={16} color={isDark ? "#aaa" : "#777"} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "#2a2a2a" : "#fff",
                      color: isDark ? "#fff" : "#000",
                    },
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Add a comment..."
                  placeholderTextColor={isDark ? "#888" : "#999"}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    { opacity: inputText.trim() ? 1 : 0.4 },
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || sending}
                  accessibilityRole="button"
                  accessibilityLabel="Send comment"
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#05a31dff" />
                  ) : (
                    <Send size={20} color="#05a31dff" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: "center",
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryCommentsBtn: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "#05a31dff",
    justifyContent: "center",
    alignItems: "center",
  },
  retryCommentsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 8,
    zIndex: 2,
    elevation: 2,
  },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  replyText: {
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    zIndex: 3,
    paddingVertical: 8,
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  sendBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
});
