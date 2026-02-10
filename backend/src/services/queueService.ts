import { query } from "../db/pool";
import { ParsedCommand } from "./commandService";

export interface QueueItem {
  trackId: string;
  spotifyTrackId: string;
  name: string;
  artists: string;
  album: string | null;
  durationMs: number;
}

export async function buildQueue(userId: string, command: ParsedCommand): Promise<QueueItem[]> {
  const tagPlaceholders = command.tags.map((_, i) => `$${i + 2}`).join(", ");

  // Build parameter list: $1 = userId, $2..$N = tag names, then optional HAVING param, then LIMIT param.
  const params: unknown[] = [userId, ...command.tags];

  let havingCondition: string;

  if (command.matchMode === "AND") {
    // For AND, require a match for all requested tags.
    const havingParamIndex = params.length + 1;
    havingCondition = `COUNT(DISTINCT tg.name) = $${havingParamIndex}`;
    params.push(command.tags.length);
  } else {
    // For OR, at least one matching tag is enough; no extra param required.
    havingCondition = "COUNT(DISTINCT tg.name) >= 1";
  }

  const limitParamIndex = params.length + 1;
  params.push(command.limit);

  const sql =
    "SELECT t.id as track_id, t.spotify_track_id, t.name, t.artists, t.album, t.duration_ms " +
    "FROM user_tracks ut " +
    "JOIN tracks t ON ut.track_id = t.id " +
    "JOIN track_tags tt ON tt.track_id = t.id AND tt.user_id = ut.user_id " +
    "JOIN tags tg ON tg.id = tt.tag_id " +
    "WHERE ut.user_id = $1 AND tg.name IN (" +
    tagPlaceholders +
    ") " +
    "GROUP BY t.id " +
    "HAVING " +
    havingCondition +
    " " +
    "ORDER BY random() " +
    `LIMIT $${limitParamIndex}`;

  const rows = await query<{
    track_id: string;
    spotify_track_id: string;
    name: string;
    artists: string;
    album: string | null;
    duration_ms: number;
  }>(sql, params);

  return rows.map((r) => ({
    trackId: r.track_id,
    spotifyTrackId: r.spotify_track_id,
    name: r.name,
    artists: r.artists,
    album: r.album,
    durationMs: r.duration_ms,
  }));
}

