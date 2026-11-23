import axios, { AxiosError } from "axios";
import { SPOTIFY_API_BASE_URL } from "../config/spotify";
import { query } from "../db/pool";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string } | null;
  duration_ms: number;
  explicit: boolean;
}

interface SavedTracksPage {
  items: Array<{ track: SpotifyTrack | null }>;
  next: string | null;
  total: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Walk every page of the user's saved tracks through the official Web API (50 per page,
// following the `next` link) and honor Retry-After on 429s.
export async function fetchAllLikedTracks(
  accessToken: string,
  opts: { maxTracks?: number; getPage?: (url: string) => Promise<SavedTracksPage> } = {}
): Promise<SpotifyTrack[]> {
  const getPage =
    opts.getPage ??
    (async (url: string) => {
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await axios.get<SavedTracksPage>(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          return res.data;
        } catch (err) {
          const e = err as AxiosError;
          if (e.response?.status !== 429 || attempt >= 5) throw err;
          const retryAfter = Number(e.response.headers?.["retry-after"]) || 1;
          await sleep(retryAfter * 1000);
        }
      }
    });

  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${SPOTIFY_API_BASE_URL}/me/tracks?limit=50&offset=0`;
  while (url) {
    const page: SavedTracksPage = await getPage(url);
    for (const item of page.items) {
      // Local files and unavailable tracks come back with a null track or null id.
      if (item.track && item.track.id) tracks.push(item.track);
    }
    if (opts.maxTracks && tracks.length >= opts.maxTracks) return tracks.slice(0, opts.maxTracks);
    url = page.next;
  }
  return tracks;
}

// Upsert tracks and the user's library links in one statement per page of 500,
// using unnest so a 5,000 track library is 10 round trips instead of 10,000.
export async function upsertLibrary(userId: string, input: SpotifyTrack[]): Promise<number> {
  // Deduplicate up front: the same track can appear twice in a library listing, and a
  // repeat landing in a later batch would otherwise be counted twice.
  const tracks = [...new Map(input.map((t) => [t.id, t])).values()];
  let linked = 0;
  for (let i = 0; i < tracks.length; i += 500) {
    const batch = tracks.slice(i, i + 500);
    const rows = await query<{ id: string }>(
      "WITH input AS ( " +
        "SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::bool[]) " +
        "AS x(spotify_track_id, name, artists, album, duration_ms, explicit) ), " +
        "upserted AS ( " +
        "INSERT INTO tracks (spotify_track_id, name, artists, album, duration_ms, explicit) " +
        "SELECT DISTINCT ON (spotify_track_id) * FROM input " +
        "ON CONFLICT (spotify_track_id) DO UPDATE SET name = EXCLUDED.name, artists = EXCLUDED.artists, " +
        "album = EXCLUDED.album, duration_ms = EXCLUDED.duration_ms, explicit = EXCLUDED.explicit " +
        "RETURNING id ) " +
        "INSERT INTO user_tracks (user_id, track_id, liked) SELECT $7, id, TRUE FROM upserted " +
        "ON CONFLICT (user_id, track_id) DO UPDATE SET liked = TRUE RETURNING id",
      [
        batch.map((t) => t.id),
        batch.map((t) => t.name),
        batch.map((t) => t.artists.map((a) => a.name).join(", ")),
        batch.map((t) => t.album?.name ?? null),
        batch.map((t) => t.duration_ms),
        batch.map((t) => t.explicit),
        userId,
      ]
    );
    linked += rows.length;
  }
  return linked;
}
