import { query } from "../db/pool";
import { AudioFeatures, classifyTonality } from "./tonality";

export interface ClassifiedTrack {
  trackId: string;
  features: AudioFeatures;
}

export async function loadClassifiableTracks(userId: string): Promise<ClassifiedTrack[]> {
  const rows = await query<{
    track_id: string;
    key: number | null;
    mode: number | null;
    tempo: number | null;
    energy: number | null;
    valence: number | null;
    danceability: number | null;
    acousticness: number | null;
  }>(
    "SELECT tf.track_id, tf.key, tf.mode, tf.tempo, tf.energy, tf.valence, tf.danceability, tf.acousticness " +
      "FROM user_tracks ut JOIN track_features tf ON tf.track_id = ut.track_id WHERE ut.user_id = $1",
    [userId]
  );
  return rows.map((r) => ({
    trackId: r.track_id,
    features: {
      key: r.key,
      mode: r.mode,
      tempo: r.tempo === null ? null : Number(r.tempo),
      energy: r.energy === null ? null : Number(r.energy),
      valence: r.valence === null ? null : Number(r.valence),
      danceability: r.danceability === null ? null : Number(r.danceability),
      acousticness: r.acousticness === null ? null : Number(r.acousticness),
    },
  }));
}

// Attach auto tags (type "auto") such as "minor", "a-minor", "low-energy", "melancholy"
// to every classified track in the user's library. Idempotent: reruns add nothing new.
export async function applyAutoTags(userId: string): Promise<{ tracks: number; tagLinks: number }> {
  const tracks = await loadClassifiableTracks(userId);
  const tagIdByName = new Map<string, string>();
  let tagLinks = 0;

  for (const t of tracks) {
    const { autoTags } = classifyTonality(t.features);
    for (const name of autoTags) {
      let tagId = tagIdByName.get(name);
      if (!tagId) {
        const rows = await query<{ id: string }>(
          "INSERT INTO tags (user_id, name, type) VALUES ($1, $2, 'auto') " +
            "ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
          [userId, name]
        );
        tagId = rows[0].id;
        tagIdByName.set(name, tagId);
      }
      const inserted = await query<{ id: string }>(
        "INSERT INTO track_tags (user_id, track_id, tag_id, weight) VALUES ($1, $2, $3, 1) " +
          "ON CONFLICT (user_id, track_id, tag_id) DO NOTHING RETURNING id",
        [userId, t.trackId, tagId]
      );
      tagLinks += inserted.length;
    }
  }
  return { tracks: tracks.length, tagLinks };
}
