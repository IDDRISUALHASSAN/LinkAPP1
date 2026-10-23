import { apiRequest } from "./api";

export async function fetchMusicTracks(cursor = null, limit = 20) {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("limit", limit);

  return apiRequest(`/music?${params.toString()}`);
}
