import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { loadLibrary, manualTagNames } from "../services/libraryService";
import { recommendSongs, suggestPlaylists, suggestTags } from "../services/recommend";

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth);

// Songs from the user's library that fit with a seed track (shared tags, compatible key, similar feel).
recommendationsRouter.get("/songs", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const seedId = String(req.query.seed ?? "");
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  if (!seedId) return res.status(400).json({ error: "seed (track id) is required" });

  const library = await loadLibrary(userId);
  const seed = library.find((t) => t.trackId === seedId);
  if (!seed) return res.status(404).json({ error: "Seed track is not in your library" });

  const items = recommendSongs(seed, library, limit).map((s) => ({
    trackId: s.track.trackId,
    spotifyTrackId: s.track.spotifyTrackId,
    name: s.track.name,
    artists: s.track.artists,
    score: s.score,
    reasons: s.reasons,
  }));
  res.json({ seed: { trackId: seed.trackId, name: seed.name }, items });
});

// Suggested playlists built from tag combinations, ordered for smooth key transitions.
recommendationsRouter.get("/playlists", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const minSize = Number(req.query.minSize ?? 8) || 8;
  const library = await loadLibrary(userId);
  const byId = new Map(library.map((t) => [t.trackId, t]));
  const items = suggestPlaylists(library, { minSize }).map((p) => ({
    name: p.name,
    basis: p.basis,
    size: p.trackIds.length,
    tracks: p.trackIds.map((id) => {
      const t = byId.get(id)!;
      return { trackId: t.trackId, spotifyTrackId: t.spotifyTrackId, name: t.name, artists: t.artists };
    }),
  }));
  res.json({ items });
});

// Suggested manual tags for untagged tracks, learned from tracks the user already tagged.
recommendationsRouter.get("/tags", async (req: AuthedRequest, res) => {
  const userId = req.userId as string;
  const [library, manual] = await Promise.all([loadLibrary(userId), manualTagNames(userId)]);
  const byId = new Map(library.map((t) => [t.trackId, t]));
  const items = suggestTags(library, manual)
    .slice(0, 200)
    .map((s) => ({ ...s, name: byId.get(s.trackId)?.name ?? "" }));
  res.json({ items });
});
