import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { query } from "../db/pool";
import { listTags, createTag, addTagsToTrack, removeTagFromTrack } from "../services/tagService";
import { getValidAccessToken } from "../services/spotifyService";
import { fetchAllLikedTracks, upsertLibrary } from "../services/librarySync";
import { fetchAudioFeatures, saveFeatures, tracksMissingFeatures } from "../services/featureService";
import { applyAutoTags, loadClassifiableTracks } from "../services/autoTagService";
import { classifyTonality } from "../services/tonality";

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

// Sync the user's entire saved library (every page) from Spotify, then classify tonality
// for any tracks without features and apply auto tags. Pass ?classify=false to skip classification.
tracksRouter.post("/sync/liked", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const classify = req.query.classify !== "false";

  try {
    const accessToken = await getValidAccessToken(userId);
    const tracks = await fetchAllLikedTracks(accessToken);
    const synced = await upsertLibrary(userId, tracks);
    const classification = classify ? await classifyLibrary(userId) : null;
    res.json({ synced, classification });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Sync liked tracks failed", err);
    res.status(500).json({ error: "Sync liked tracks failed" });
  }
});

// Classify tonality (key, mode, energy, mood) for tracks that do not have features yet,
// then attach auto tags. Safe to rerun; already classified tracks are skipped.
tracksRouter.post("/classify", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  try {
    res.json(await classifyLibrary(userId));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Classification failed", err);
    res.status(500).json({ error: "Classification failed" });
  }
});

// Tonality details for one track.
tracksRouter.get("/:trackId/tonality", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const library = await loadClassifiableTracks(userId);
  const t = library.find((x) => x.trackId === req.params.trackId);
  if (!t) return res.status(404).json({ error: "No features for this track yet" });
  res.json({ trackId: t.trackId, features: t.features, ...classifyTonality(t.features) });
});

async function classifyLibrary(userId: string) {
  const missing = await tracksMissingFeatures(userId);
  const features = await fetchAudioFeatures(missing);
  const featuresSaved = await saveFeatures(features);
  const tagged = await applyAutoTags(userId);
  return {
    requested: missing.length,
    featuresSaved,
    noFeaturesAvailable: missing.length - featuresSaved,
    classifiedTracks: tagged.tracks,
    newTagLinks: tagged.tagLinks,
  };
}

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

