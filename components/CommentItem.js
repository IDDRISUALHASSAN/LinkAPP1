import { Heart, MoreVertical, Reply, Trash2, X, Check, ChevronDown, Edit3 } from "lucide-react-native";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from "react-native";
import { Colors } from "../constants/theme";
import {
    deleteComment,
    editComment,
    fetchReplies,
    likeComment,
    unlikeComment
} from "../services/comments";
import { isAuthError, clearAuth } from "../services/api";
import UserAvatar from "./UserAvatar";

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export default function CommentItem({
  comment,
  videoOwnerId,
  currentUserId,
  onReply,
  onUpdate,
  onDelete,
  depth = 0,
  showReply = true,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || "");
  const [liked, setLiked] = useState(comment.liked);
  const [likesCount, setLikesCount] = useState(comment.likes);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const likingRef = useRef(false);
  const maxDepth = 2;

  const router = useRouter();

  const effectiveReplies = comment.replies?.length > 0 ? comment.replies : replies;
  const effectiveReplyCount = comment.replyCount || 0;
  const shouldShowViewReplies = effectiveReplyCount > 0 && depth < maxDepth;

  const handleAuthError = async () => {
    await clearAuth();
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please log in again.",
      [{ text: "OK", onPress: () => router.replace("/(screens)") }],
    );
  };

  const isOwnComment = currentUserId === comment.userId;
  const canEdit = isOwnComment;
  const canDelete = isOwnComment || currentUserId === videoOwnerId;

  const handleLike = async () => {
    if (likingRef.current) return;
    likingRef.current = true;

    const previousLiked = Boolean(liked);
    const previousLikesCount = Number(likesCount) || 0;
    const newLiked = !previousLiked;
    setLiked(newLiked);
    setLikesCount(Math.max(0, previousLikesCount + (newLiked ? 1 : -1)));

    try {
      if (newLiked) {
        await likeComment(comment.id);
      } else {
        await unlikeComment(comment.id);
      }
    } catch (error) {
      console.error("Toggle comment like error:", error);
      setLiked(previousLiked);
      setLikesCount(previousLikesCount);
      if (isAuthError(error)) {
        handleAuthError();
      } else {
        Alert.alert("Like failed", error.message || "Please try again.");
      }
    } finally {
      likingRef.current = false;
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      const res = await editComment(comment.id, editText);
      onUpdate?.(comment.id, { text: editText, edited: true });
      setIsEditing(false);
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthError();
      } else {
        Alert.alert("Error", "Failed to edit comment");
      }
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert("Delete comment", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            onDelete?.(comment.id);
          } catch (err) {
            if (isAuthError(err)) {
              handleAuthError();
            } else {
              Alert.alert("Error", "Failed to delete comment");
            }
          }
        },
      },
    ]);
  };

  const handleReply = () => {
    if (showReply && onReply && depth < maxDepth) {
      onReply(comment);
    }
  };

  const handleLoadReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    setLoadingReplies(true);
    try {
      const res = await fetchReplies(comment.id, null, 20);
      setReplies(res.replies || res.data || []);
      setShowReplies(true);
    } catch (err) {
      console.error("Load replies error:", err);
      if (isAuthError(err)) handleAuthError();
    } finally {
      setLoadingReplies(false);
    }
   };

  return (
    <View style={[styles.container, { paddingLeft: 12 + depth * 16 }]}>
      <View style={styles.row}>
        <UserAvatar uri={comment.profilePic} size={32} style={styles.avatar} />

        <View style={styles.content}>
          <View
            style={[
              styles.commentBubble,
              { backgroundColor: isDark ? "#1e1e1e" : "#f0f0f0" },
            ]}
          >
            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: isDark ? "#2a2a2a" : "#fff",
                      color: isDark ? "#fff" : "#000",
                    },
                  ]}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  autoFocus
                  maxLength={300}
                />
                <TouchableOpacity onPress={handleSaveEdit}>
                  <Check size={20} color="#05a31dff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditing(false);
                    setEditText(comment.text || "");
                  }}
                >
                  <X size={20} color={isDark ? "#ccc" : "#999"} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text
                  style={[
                    styles.commentText,
                    { color: isDark ? "#e0e0e0" : "#333" },
                  ]}
                >
                  {comment.text}
                </Text>
                {comment.edited && (
                  <Text
                    style={[
                      styles.editedLabel,
                      { color: isDark ? "#999" : "#777" },
                    ]}
                  >
                    {"  edited"}
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={styles.metaRow}>
            <Text
              style={[styles.timeText, { color: isDark ? "#888" : "#888" }]}
            >
              {formatTimeAgo(comment.createdAt)}
            </Text>

            {showReply && depth < maxDepth && (
              <TouchableOpacity onPress={handleReply} style={styles.metaBtn}>
                <Reply size={14} color={isDark ? "#aaa" : "#999"} />
                <Text
                  style={[
                    styles.replyText,
                    { color: isDark ? "#aaa" : "#999" },
                  ]}
                >
                  Reply
                </Text>
              </TouchableOpacity>
            )}

            {shouldShowViewReplies && (
              <TouchableOpacity
                onPress={handleLoadReplies}
                style={styles.metaBtn}
              >
                {loadingReplies ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#aaa" : "#999"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.replyText,
                      { color: isDark ? "#aaa" : "#999" },
                    ]}
                  >
                    View {!showReplies ? effectiveReplyCount : 0}{" "}
                    {effectiveReplyCount === 1 ? "reply" : "replies"}
                    <ChevronDown
                      size={12}
                      color={isDark ? "#aaa" : "#999"}
                      style={{
                        transform: [
                          { rotate: showReplies ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleLike} style={styles.metaBtn}>
              <Heart
                size={14}
                color={liked ? "#ff3b30" : isDark ? "#aaa" : "#999"}
                fill={liked ? "#ff3b30" : "none"}
              />
              {likesCount > 0 && (
                <Text
                  style={[
                    styles.likesCount,
                    { color: liked ? "#ff3b30" : isDark ? "#aaa" : "#888" },
                  ]}
                >
                  {likesCount}
                </Text>
              )}
            </TouchableOpacity>

            {canEdit && !isEditing && (
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={styles.metaBtn}
              >
                <MoreVertical size={14} color={isDark ? "#aaa" : "#999"} />
              </TouchableOpacity>
            )}

            {!isOwnComment && depth === 0 && (
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={styles.metaBtn}
              >
                <MoreVertical size={14} color={isDark ? "#aaa" : "#999"} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Replies */}
      {(showReplies || comment?.replies?.length > 0) && (
        <View style={{ marginTop: 4 }}>
          {effectiveReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              videoOwnerId={videoOwnerId}
              currentUserId={currentUserId}
              depth={depth + 1}
              showReply={depth < maxDepth - 1}
            />
          ))}
        </View>
      )}

      {/* Menu modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View
            style={[
              styles.menuBox,
              { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
            ]}
          >
            {canEdit && !isEditing && (
              <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                <Edit3 size={20} color={isDark ? "#fff" : "#333"} />
                <Text
                  style={[styles.menuText, { color: isDark ? "#fff" : "#333" }]}
                >
                  Edit
                </Text>
              </TouchableOpacity>
            )}
            {canDelete && !isEditing && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Trash2 size={20} color="#ff3b30" />
                <Text style={[styles.menuText, { color: "#ff3b30" }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  avatar: {
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: "italic",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    padding: 8,
    borderRadius: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    marginLeft: 8,
  },
  metaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  replyText: {
    fontSize: 11,
    fontWeight: "500",
  },
  likesCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBox: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 160,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 15,
  },
});
