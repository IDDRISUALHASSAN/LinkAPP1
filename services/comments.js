import { apiRequest } from "./api";

export async function fetchComments(videoId, cursor = null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/videos/${videoId}/comments?${params.toString()}`);
}

export async function postComment(videoId, text, parentId = null) {
  const body = { text };
  if (parentId) body.parentId = parentId;

  return apiRequest(`/videos/${videoId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function likeComment(commentId) {
  return apiRequest(`/comments/${commentId}/like`, { method: "POST" });
}

export async function unlikeComment(commentId) {
  return apiRequest(`/comments/${commentId}/like`, { method: "DELETE" });
}

export async function editComment(commentId, text) {
  return apiRequest(`/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export async function deleteComment(commentId) {
  return apiRequest(`/comments/${commentId}`, { method: "DELETE" });
}

export async function fetchReplies(commentId, cursor = null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/comments/${commentId}/replies?${params.toString()}`);
}
