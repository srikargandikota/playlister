import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageFeatures,
  featureSimilarity,
  harmonicOrder,
  jaccard,
  LibraryTrack,
  recommendSongs,
  suggestPlaylists,
  suggestTags,
} from "../src/services/recommend";
import { AudioFeatures } from "../src/services/tonality";

const f = (key: number, mode: number, energy: number, valence: number, tempo = 120): AudioFeatures => ({
  key, mode, tempo, energy, valence, danceability: 0.5, acousticness: 0.3,
});
const track = (id: string, tags: string[], features: AudioFeatures | null): LibraryTrack => ({
  trackId: id, spotifyTrackId: `sp${id}`, name: `Song ${id}`, artists: "Artist", tags, features,
});

test("jaccard", () => {
  assert.equal(jaccard(["a", "b"], ["b", "c"]), 1 / 3);
  assert.equal(jaccard([], []), 0);
});

test("half and double tempo count as similar", () => {
  const a = f(0, 1, 0.5, 0.5, 70);
  const b = f(0, 1, 0.5, 0.5, 140);
  const c = f(0, 1, 0.5, 0.5, 100);
  assert.ok(featureSimilarity(a, b) > featureSimilarity(a, c));
});

test("averageFeatures folds tempo octaves", () => {
  const avg = averageFeatures([f(0, 1, 0.4, 0.4, 70), f(0, 1, 0.6, 0.6, 140)]);
  assert.ok(Math.abs((avg.tempo as number) - 70) < 0.001);
  assert.ok(Math.abs((avg.energy as number) - 0.5) < 1e-9);
});

test("song recommendations rank shared tags and compatible keys first", () => {
  const seed = track("1", ["chill", "study"], f(9, 0, 0.3, 0.3)); // A minor, 8A
  const good = track("2", ["chill", "study"], f(0, 1, 0.32, 0.35)); // C major, 8B (relative)
  const ok = track("3", ["chill"], f(2, 0, 0.3, 0.3)); // D minor, 7A (adjacent)
  const bad = track("4", ["hype"], f(6, 1, 0.95, 0.9)); // F# major, 2B
  const recs = recommendSongs(seed, [seed, good, ok, bad]);
  assert.deepEqual(recs.map((r) => r.track.trackId).slice(0, 2), ["2", "3"]);
  assert.ok(recs[0].reasons.some((r) => r.includes("harmonically compatible")));
  assert.ok(!recs.some((r) => r.track.trackId === "1"));
});

test("playlist suggestions use tag pairs with enough tracks", () => {
  const lib: LibraryTrack[] = [];
  for (let i = 0; i < 10; i++) lib.push(track(`a${i}`, ["focus", "low-energy"], f(i % 12, 0, 0.3, 0.3)));
  for (let i = 0; i < 3; i++) lib.push(track(`b${i}`, ["focus"], f(0, 1, 0.8, 0.8)));
  const s = suggestPlaylists(lib, { minSize: 8 });
  assert.equal(s[0].name, "Focus + Low Energy");
  assert.equal(s[0].trackIds.length, 10);
});

test("harmonic ordering keeps every track exactly once", () => {
  const lib = [0, 7, 2, 9, 4].map((k, i) => track(`${i}`, [], f(k, 1, 0.5, 0.5)));
  const ordered = harmonicOrder(lib);
  assert.equal(ordered.length, lib.length);
  assert.deepEqual(new Set(ordered.map((t) => t.trackId)), new Set(lib.map((t) => t.trackId)));
  // From C major (8B), the next pick should be an adjacent key: G (9B) or D (10B is 2 away), so G.
  assert.equal(ordered[1].features?.key, 7);
});

test("tag suggestions come from the nearest centroid", () => {
  const lib: LibraryTrack[] = [
    track("1", ["sleep"], f(0, 1, 0.1, 0.2, 60)),
    track("2", ["sleep"], f(0, 1, 0.15, 0.25, 62)),
    track("3", ["sleep"], f(0, 1, 0.12, 0.22, 58)),
    track("4", [], f(0, 1, 0.13, 0.21, 61)), // should be suggested
    track("5", [], f(0, 1, 0.95, 0.9, 170)), // should not
  ];
  const s = suggestTags(lib, new Set(["sleep"]));
  assert.deepEqual(s.map((x) => x.trackId), ["4"]);
});
