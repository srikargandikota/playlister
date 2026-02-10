import { apiRequest } from "./client";

export interface Track {
  track_id: string;
  spotify_track_id: string;
  name: string;
  artists: string;
  album: string | null;
  duration_ms: number;
  explicit: boolean;
}

export interface Tag {
  id: string;
  name: string;
  type: string;
  color: string | null;
  icon: string | null;
}

export async function fetchTracks(token: string, limit = 50, offset = 0) {
  return apiRequest<{ items: Track[] }>({
    path: `/tracks?limit=${limit}&offset=${offset}`,
    token
  });
}

export async function fetchTags(token: string) {
  return apiRequest<{ items: Tag[] }>({
    path: "/tracks/tags",
    token
  });
}

export async function createTag(
  token: string,
  payload: { name: string; type: string; color?: string; icon?: string }
) {
  return apiRequest<Tag>({
    path: "/tracks/tags",
    method: "POST",
    body: payload,
    token
  });
}

export async function addTagsToTrack(token: string, trackId: string, tagIds: string[]) {
  await apiRequest<void>({
    path: `/tracks/${trackId}/tags`,
    method: "POST",
    body: { tagIds },
    token
  });
}

export async function removeTagFromTrack(token: string, trackId: string, tagId: string) {
  await apiRequest<void>({
    path: `/tracks/${trackId}/tags/${tagId}`,
    method: "DELETE",
    token
  });
}

