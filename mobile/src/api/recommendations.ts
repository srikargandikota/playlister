import { apiRequest } from "./client";

export interface Tonality {
  trackId: string;
  keyName: string | null;
  mode: "major" | "minor" | null;
  camelot: string | null;
  energyBand: "low" | "medium" | "high" | null;
  mood: string | null;
  autoTags: string[];
}

export interface SongRecommendation {
  trackId: string;
  spotifyTrackId: string;
  name: string;
  artists: string;
  score: number;
  reasons: string[];
}

export interface PlaylistSuggestion {
  name: string;
  basis: string[];
  size: number;
  tracks: Array<{ trackId: string; spotifyTrackId: string; name: string; artists: string }>;
}

export async function fetchTonality(token: string, trackId: string) {
  return apiRequest<Tonality>({ path: `/tracks/${trackId}/tonality`, token });
}

export async function fetchSongRecommendations(token: string, seedTrackId: string, limit = 10) {
  return apiRequest<{ items: SongRecommendation[] }>({
    path: `/recommendations/songs?seed=${encodeURIComponent(seedTrackId)}&limit=${limit}`,
    token
  });
}

export async function fetchPlaylistSuggestions(token: string) {
  return apiRequest<{ items: PlaylistSuggestion[] }>({ path: "/recommendations/playlists", token });
}
