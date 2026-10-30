import { apiRequest } from "./api";
import { normalizeVideoId } from "./videos";

function requireVideoId(videoId) {
  const normalizedId = normalizeVideoId(videoId);
  if (!normalizedId) throw new Error("Invalid video ID");
  return normalizedId;
}

export async function fetchComments(videoId, cursor = null, limit = 20) {
  const normalizedId = requireVideoId(videoId);
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(
    `/videos/${encodeURIComponent(normalizedId)}/comments?${params.toString()}`,
  );
}

export async function postComment(videoId, text, parentId = null) {
  const normalizedId = requireVideoId(videoId);
  const body = { text };
  if (parentId) body.parentId = normalizeVideoId(parentId);

  return apiRequest(`/videos/${encodeURIComponent(normalizedId)}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function requireCommentId(commentId) {
  const normalizedId = normalizeVideoId(commentId);
  if (!normalizedId) throw new Error("Invalid comment ID");
  return normalizedId;
}

export async function likeComment(commentId) {
  const normalizedId = requireCommentId(commentId);
  return apiRequest(`/comments/${encodeURIComponent(normalizedId)}/like`, {
    method: "POST",
  });
}

export async function unlikeComment(commentId) {
  const normalizedId = requireCommentId(commentId);
  return apiRequest(`/comments/${encodeURIComponent(normalizedId)}/like`, {
    method: "DELETE",
  });
}

export async function editComment(commentId, text) {
  const normalizedId = requireCommentId(commentId);
  return apiRequest(`/comments/${encodeURIComponent(normalizedId)}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export async function deleteComment(commentId) {
  const normalizedId = requireCommentId(commentId);
  return apiRequest(`/comments/${encodeURIComponent(normalizedId)}`, {
    method: "DELETE",
  });
}

export async function fetchReplies(commentId, cursor = null, limit = 20) {
  const normalizedId = requireCommentId(commentId);
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(
    `/comments/${encodeURIComponent(normalizedId)}/replies?${params.toString()}`,
  );
}
