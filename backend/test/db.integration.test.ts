// Runs the real SQL against Postgres. Skipped unless TEST_DATABASE_URL points at a
// throwaway database that already has the schema applied (npm run db:migrate).
import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import axios from "axios"; // static import: same module instance the services use

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

test("sync, classify, auto tag, query, recommend", { skip: !url }, async () => {
  const { pool, query } = await import("../src/db/pool");
  const { upsertLibrary } = await import("../src/services/librarySync");
  const { fetchAudioFeatures, saveFeatures, tracksMissingFeatures } = await import("../src/services/featureService");
  const { applyAutoTags } = await import("../src/services/autoTagService");
  const { loadLibrary, allTagNames } = await import("../src/services/libraryService");
  const { buildQueue } = await import("../src/services/queueService");
  const { parseCommand } = await import("../src/services/commandService");
  const { interpretWithRules } = await import("../src/services/aiCommandService");
  const { recommendSongs, suggestPlaylists } = await import("../src/services/recommend");
  after(() => pool.end());

  await query("TRUNCATE users, tracks CASCADE");
  const [u] = await query<{ id: string }>("INSERT INTO users (spotify_user_id) VALUES ('tester') RETURNING id");

  // 1,200 tracks with one duplicate id, to check batching across the 500 row boundary.
  const ids = Array.from({ length: 1200 }, (_, i) => `t${String(i).padStart(21, "0")}`);
  const tracks = ids.map((id, i) => ({
    id, name: `Song ${i}`, artists: [{ name: "A" }, { name: "B" }], album: { name: "Al" }, duration_ms: 180_000, explicit: false,
  }));
  assert.equal(await upsertLibrary(u.id, [...tracks, tracks[0]]), 1200);
  assert.equal(await upsertLibrary(u.id, tracks), 1200, "rerun is idempotent");
  const [{ n }] = await query<{ n: string }>("SELECT count(*) n FROM user_tracks WHERE user_id = $1", [u.id]);
  assert.equal(Number(n), 1200);

  // Features: first half minor/low energy/sad, second half major/high energy/happy.
  const get = mock.method(axios, "get", async (_u: string, cfg: { params: { ids: string } }) => ({
    data: { content: cfg.params.ids.split(",").map((sid) => {
      const i = Number(sid.slice(1));
      const sad = i < 600;
      return { href: `https://open.spotify.com/track/${sid}`, key: i % 12, mode: sad ? 0 : 1, energy: sad ? 0.25 : 0.85, valence: sad ? 0.2 : 0.8, tempo: 100, danceability: 0.5, acousticness: 0.4 };
    }) },
  }));
  const missing = await tracksMissingFeatures(u.id);
  assert.equal(missing.length, 1200);
  const saved = await saveFeatures(await fetchAudioFeatures(missing));
  get.mock.restore();
  assert.equal(saved, 1200);
  assert.equal((await tracksMissingFeatures(u.id)).length, 0);

  const first = await applyAutoTags(u.id);
  assert.equal(first.tracks, 1200);
  assert.equal(first.tagLinks, 1200 * 4);
  assert.equal((await applyAutoTags(u.id)).tagLinks, 0, "auto tagging is idempotent");

  const tagNames = await allTagNames(u.id);
  for (const t of ["minor", "major", "low-energy", "high-energy", "melancholy", "euphoric", "a-minor"]) assert.ok(tagNames.includes(t), t);

  // Typed grammar against real SQL, including case insensitivity and the duration cap.
  const q1 = await buildQueue(u.id, parseCommand("play Minor Low-Energy"));
  assert.equal(q1.length, 100);
  const q2 = await buildQueue(u.id, parseCommand("play minor high-energy"));
  assert.equal(q2.length, 0, "AND mode requires every tag");
  const q3 = await buildQueue(u.id, parseCommand("queue any melancholy euphoric for 30 minutes"));
  assert.equal(q3.length, 10); // 10 x 3 minute tracks

  // Natural language (rule interpreter) end to end.
  const nl = interpretWithRules("something sad and calm, 12 songs", tagNames);
  const q4 = await buildQueue(u.id, nl.command);
  assert.equal(q4.length, 12);

  // Recommendations over the loaded library.
  const lib = await loadLibrary(u.id);
  assert.equal(lib.length, 1200);
  const seed = lib.find((t) => t.spotifyTrackId === ids[9])!; // A minor, sad
  const recs = recommendSongs(seed, lib, 10);
  assert.ok(recs.every((r) => r.track.tags.includes("minor")));
  const playlists = suggestPlaylists(lib, { minSize: 50 });
  assert.ok(playlists.some((p) => p.basis.includes("melancholy") && p.basis.includes("minor")));
});
