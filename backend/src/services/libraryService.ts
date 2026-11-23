import { query } from "../db/pool";
import { LibraryTrack } from "./recommend";

// Loads the user's whole library with tag names and audio features in one query,
// in the shape the pure recommendation functions expect.
export async function loadLibrary(userId: string): Promise<LibraryTrack[]> {
  const rows = await query<{
    track_id: string;
    spotify_track_id: string;
    name: string;
    artists: string;
    tags: string[] | null;
    key: number | null;
    mode: number | null;
    tempo: string | null;
    energy: string | null;
    valence: string | null;
    danceability: string | null;
    acousticness: string | null;
    has_features: boolean;
  }>(
    "SELECT t.id AS track_id, t.spotify_track_id, t.name, t.artists, " +
      "ARRAY_REMOVE(ARRAY_AGG(DISTINCT lower(tg.name)), NULL) AS tags, " +
      "tf.key, tf.mode, tf.tempo, tf.energy, tf.valence, tf.danceability, tf.acousticness, " +
      "(tf.track_id IS NOT NULL) AS has_features " +
      "FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id " +
      "LEFT JOIN track_tags tt ON tt.track_id = t.id AND tt.user_id = ut.user_id " +
      "LEFT JOIN tags tg ON tg.id = tt.tag_id " +
      "LEFT JOIN track_features tf ON tf.track_id = t.id " +
      "WHERE ut.user_id = $1 " +
      "GROUP BY t.id, tf.track_id",
    [userId]
  );

  // pg returns NUMERIC columns as strings, so convert them here.
  const num = (v: string | number | null) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    trackId: r.track_id,
    spotifyTrackId: r.spotify_track_id,
    name: r.name,
    artists: r.artists,
    tags: r.tags ?? [],
    features: r.has_features
      ? {
          key: r.key,
          mode: r.mode,
          tempo: num(r.tempo),
          energy: num(r.energy),
          valence: num(r.valence),
          danceability: num(r.danceability),
          acousticness: num(r.acousticness),
        }
      : null,
  }));
}

export async function manualTagNames(userId: string): Promise<Set<string>> {
  const rows = await query<{ name: string }>(
    "SELECT lower(name) AS name FROM tags WHERE user_id = $1 AND type <> 'auto'",
    [userId]
  );
  return new Set(rows.map((r) => r.name));
}

export async function allTagNames(userId: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    "SELECT lower(name) AS name FROM tags WHERE user_id = $1 ORDER BY name",
    [userId]
  );
  return rows.map((r) => r.name);
}
