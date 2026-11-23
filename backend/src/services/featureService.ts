import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { query } from "../db/pool";
import { AudioFeatures } from "./tonality";

// Spotify blocked new apps from its Audio Features endpoint on Nov 27, 2024, so features
// come from ReccoBeats, a free API that accepts Spotify track IDs and returns Spotify style
// features (key, mode, tempo, energy, valence, ...). No API key is required.

export interface FeatureRow extends AudioFeatures {
  spotifyTrackId: string;
}

interface ReccoBeatsFeature {
  id?: string;
  href?: string; // usually https://open.spotify.com/track/<spotifyId>
  key?: number;
  mode?: number;
  tempo?: number;
  energy?: number;
  valence?: number;
  danceability?: number;
  acousticness?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function spotifyIdFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const m = /track\/([A-Za-z0-9]{22})/.exec(href);
  return m ? m[1] : null;
}

function toFeatureRow(spotifyTrackId: string, f: ReccoBeatsFeature): FeatureRow {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    spotifyTrackId,
    key: num(f.key),
    mode: num(f.mode),
    tempo: num(f.tempo),
    energy: num(f.energy),
    valence: num(f.valence),
    danceability: num(f.danceability),
    acousticness: num(f.acousticness),
  };
}

async function getWithRetry<T>(url: string, params: Record<string, string>, maxTries = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await axios.get<T>(url, { params, timeout: 15_000 });
      return res.data;
    } catch (err) {
      const e = err as AxiosError;
      const status = e.response?.status;
      const retryable = status === 429 || (status !== undefined && status >= 500) || !e.response;
      if (!retryable || attempt >= maxTries) throw err;
      const retryAfter = Number(e.response?.headers?.["retry-after"]);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      await sleep(waitMs);
    }
  }
}

// Fetch features for many Spotify IDs. Requests are batched; results are mapped back to
// Spotify IDs through each item's href. If a batch response cannot be mapped (no href),
// that batch falls back to one request per ID so a feature is never attached to the wrong track.
export async function fetchAudioFeatures(spotifyIds: string[]): Promise<FeatureRow[]> {
  const url = `${env.reccobeatsBaseUrl}/audio-features`;
  const results: FeatureRow[] = [];

  for (const batch of chunk(spotifyIds, env.reccobeatsBatchSize)) {
    const data = await getWithRetry<{ content?: ReccoBeatsFeature[] }>(url, { ids: batch.join(",") });
    const content = data.content ?? [];
    const wanted = new Set(batch);
    const mapped = new Map<string, FeatureRow>();
    for (const f of content) {
      const sid = spotifyIdFromHref(f.href);
      if (sid && wanted.has(sid)) mapped.set(sid, toFeatureRow(sid, f));
    }

    if (mapped.size === 0 && content.length > 0) {
      for (const sid of batch) {
        const one = await getWithRetry<{ content?: ReccoBeatsFeature[] }>(url, { ids: sid });
        if (one.content && one.content[0]) results.push(toFeatureRow(sid, one.content[0]));
      }
    } else {
      results.push(...mapped.values());
    }
  }
  return results;
}

export async function saveFeatures(rows: FeatureRow[]): Promise<number> {
  let saved = 0;
  for (const r of rows) {
    const out = await query<{ track_id: string }>(
      "INSERT INTO track_features (track_id, key, mode, tempo, energy, valence, danceability, acousticness, source) " +
        "SELECT t.id, $2, $3, $4, $5, $6, $7, $8, 'reccobeats' FROM tracks t WHERE t.spotify_track_id = $1 " +
        "ON CONFLICT (track_id) DO UPDATE SET key = EXCLUDED.key, mode = EXCLUDED.mode, tempo = EXCLUDED.tempo, " +
        "energy = EXCLUDED.energy, valence = EXCLUDED.valence, danceability = EXCLUDED.danceability, " +
        "acousticness = EXCLUDED.acousticness, fetched_at = now() " +
        "RETURNING track_id",
      [r.spotifyTrackId, r.key, r.mode, r.tempo, r.energy, r.valence, r.danceability, r.acousticness]
    );
    saved += out.length;
  }
  return saved;
}

// Spotify IDs in this user's library that have no features yet. Features are stored per
// track (not per user), so a track classified for one user is never fetched again.
export async function tracksMissingFeatures(userId: string): Promise<string[]> {
  const rows = await query<{ spotify_track_id: string }>(
    "SELECT t.spotify_track_id FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id " +
      "LEFT JOIN track_features tf ON tf.track_id = t.id WHERE ut.user_id = $1 AND tf.track_id IS NULL",
    [userId]
  );
  return rows.map((r) => r.spotify_track_id);
}
