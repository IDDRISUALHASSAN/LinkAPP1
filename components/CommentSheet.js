import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { Send, X, MessageCircle } from "lucide-react-native";
import { Colors } from "../constants/theme";
import CommentItem from "./CommentItem";
import { fetchComments, postComment } from "../services/comments";

export default function CommentSheet({
  visible,
  onDismiss,
  videoId,
  videoOwnerId,
  currentUserId,
  onCommentAdded,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const [currentPreviewUri, setCurrentPreviewUri] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);

  const loadComments = async (reset = false) => {
    if (reset) {
      setRefreshing(true);
      setCursor(null);
      setComments([]);
      setHasMore(true);
    } else if (!hasMore || loading) {
      return;
    }

    try {
      const res = await fetchComments(
        videoId,
        reset ? null : cursor,
        20,
      );
      const newComments = res.comments || res.data || [];
      const newCursor = res.nextCursor || res.cursor || null;

      if (reset) {
        setComments(newComments);
      } else {
        setComments((prev) => [...prev, ...newComments]);
      }
      setCursor(newCursor);
      setHasMore(!!newCursor);
    } catch (err) {
      console.error("Load comments error:", err);
      Alert.alert("Error", "Failed to load comments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible && videoId) {
      loadComments(true);
    } else {
      setComments([]);
      setCursor(null);
      setHasMore(true);
    }
  }, [visible, videoId]);

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

  useEffect(() => {
    const showKeyboard = () => {
      Keyboard.dismiss();
      setInputText("");
      setReplyingTo(null);
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    setSending(true);
    try {
      const res = await postComment(
        videoId,
        inputText.trim(),
        replyingTo ? { id: replyingTo.id } : null,
      );

      const newComment = res.comment || res.data;
      if (newComment) {
        if (replyingTo) {
          setComments((prev) => [
            ...prev,
            {
              ...newComment,
              isNew: true,
            },
          ]);
          // If replying to a top-level comment, update its reply count
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyingTo.id
                ? { ...c, replyCount: (c.replyCount || 0) + 1 }
                : c,
            ),
          );
        } else {
          setComments((prev) => [newComment, ...prev]);
          onCommentAdded?.();
        }
      }

      setInputText("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Send comment error:", err);
      Alert.alert("Error", "Failed to send comment");
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
      prev.map((c) =>
        c.id === commentId ? { ...c, ...updates } : c,
      ),
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetHeight + insets.bottom,
                backgroundColor: isDark ? "#121212" : "#fff",
                transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }],
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
            ) : comments.length === 0 && !loading ? (
              <View style={styles.center}>
                <MessageCircle size={48} color={isDark ? "#555" : "#ccc"} />
                <Text style={[styles.emptyText, { color: isDark ? "#888" : "#999" }]}>
                  No comments yet
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={comments}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                renderItem={renderItem}
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
                  <Text style={[styles.replyText, { color: isDark ? "#aaa" : "#777" }]}>
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
                  style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.4 }]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || sending}
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
      </TouchableWithoutFeedback>
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
    paddingVertical: 8,
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  sendBtn: {
    padding: 8,
  },
});
