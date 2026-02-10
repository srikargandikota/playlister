import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { query } from "../db/pool";
import { listTags, createTag, addTagsToTrack, removeTagFromTrack } from "../services/tagService";
import { getValidAccessToken, getUserLikedTracks } from "../services/spotifyService";

export const tracksRouter = Router();

tracksRouter.use(requireAuth);

// List user's tracks from DB, with optional tag filters (MVP: basic listing).
tracksRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { limit = "50", offset = "0" } = req.query;

  const rows = await query<
    {
      track_id: string;
      spotify_track_id: string;
      name: string;
      artists: string;
      album: string | null;
      duration_ms: number;
      explicit: boolean;
    }
  >(
    "SELECT t.id as track_id, t.spotify_track_id, t.name, t.artists, t.album, t.duration_ms, t.explicit " +
      "FROM user_tracks ut " +
      "JOIN tracks t ON ut.track_id = t.id " +
      "WHERE ut.user_id = $1 " +
      "ORDER BY t.name ASC " +
      "LIMIT $2 OFFSET $3",
    [userId, Number(limit), Number(offset)]
  );

  res.json({ items: rows });
});

// Trigger a simple sync of the user's liked tracks from Spotify into the local DB (first page, MVP).
tracksRouter.post("/sync/liked", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;

  try {
    const accessToken = await getValidAccessToken(userId);
    const data = (await getUserLikedTracks(accessToken, { limit: 50, offset: 0 })) as {
      items: Array<{
        track: {
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string };
          duration_ms: number;
          explicit: boolean;
        };
      }>;
    };

    for (const item of data.items) {
      const t = item.track;
      const artists = t.artists.map((a) => a.name).join(", ");

      const trackRows = await query<{
        id: string;
      }>(
        "INSERT INTO tracks (spotify_track_id, name, artists, album, duration_ms, explicit) " +
          "VALUES ($1, $2, $3, $4, $5, $6) " +
          "ON CONFLICT (spotify_track_id) DO UPDATE SET " +
          "name = EXCLUDED.name, " +
          "artists = EXCLUDED.artists, " +
          "album = EXCLUDED.album, " +
          "duration_ms = EXCLUDED.duration_ms, " +
          "explicit = EXCLUDED.explicit " +
          "RETURNING id",
        [t.id, t.name, artists, t.album?.name ?? null, t.duration_ms, t.explicit]
      );

      const trackId = trackRows[0].id;

      await query(
        "INSERT INTO user_tracks (user_id, track_id, liked) " +
          "VALUES ($1, $2, TRUE) " +
          "ON CONFLICT (user_id, track_id) DO UPDATE SET liked = TRUE",
        [userId, trackId]
      );
    }

    res.json({ synced: data.items.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Sync liked tracks failed", err);
    res.status(500).json({ error: "Sync liked tracks failed" });
  }
});

// List tags for current user.
tracksRouter.get("/tags", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const tags = await listTags(userId);
  res.json({ items: tags });
});

// Create a new tag.
tracksRouter.post("/tags", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { name, type, color, icon } = req.body as {
    name?: string;
    type?: string;
    color?: string | null;
    icon?: string | null;
  };
  if (!name || !type) {
    return res.status(400).json({ error: "name and type are required" });
  }
  const tag = await createTag({ userId, name, type, color, icon });
  res.status(201).json(tag);
});

// Add tags to a track.
tracksRouter.post("/:trackId/tags", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { trackId } = req.params;
  const { tagIds } = req.body as { tagIds?: string[] };
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: "tagIds array is required" });
  }
  await addTagsToTrack({ userId, trackId, tagIds });
  res.status(204).send();
});

// Remove a tag from a track.
tracksRouter.delete("/:trackId/tags/:tagId", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const { trackId, tagId } = req.params;
  await removeTagFromTrack({ userId, trackId, tagId });
  res.status(204).send();
});

