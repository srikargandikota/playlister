import { test, mock } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { fetchAllLikedTracks, SpotifyTrack } from "../src/services/librarySync";
import { chunk, fetchAudioFeatures, spotifyIdFromHref } from "../src/services/featureService";

const mk = (id: string): SpotifyTrack => ({ id, name: id, artists: [{ name: "x" }], album: { name: "y" }, duration_ms: 1000, explicit: false });

test("library sync follows every page and skips local files", async () => {
  const pages: Record<string, { items: Array<{ track: SpotifyTrack | null }>; next: string | null; total: number }> = {
    p1: { items: [{ track: mk("a") }, { track: null }], next: "p2", total: 4 },
    p2: { items: [{ track: mk("b") }, { track: { ...mk("c"), id: "" } }], next: "p3", total: 4 },
    p3: { items: [{ track: mk("d") }], next: null, total: 4 },
  };
  let first = true;
  const tracks = await fetchAllLikedTracks("token", {
    getPage: async (url) => {
      const key = first ? "p1" : url;
      first = false;
      return pages[key];
    },
  });
  assert.deepEqual(tracks.map((t) => t.id), ["a", "b", "d"]);
});

test("helpers", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(spotifyIdFromHref("https://open.spotify.com/track/7Mts0OfPorF4iwOomvfqn1"), "7Mts0OfPorF4iwOomvfqn1");
  assert.equal(spotifyIdFromHref(undefined), null);
});

const A = "7Mts0OfPorF4iwOomvfqn1";
const B = "2takcwOaAZWiXQijPHIx7B";

test("features are mapped back by href, never by position", async () => {
  const get = mock.method(axios, "get", async () => ({
    // Returned out of order on purpose.
    data: { content: [
      { href: `https://open.spotify.com/track/${B}`, key: 2, mode: 1, energy: 0.9 },
      { href: `https://open.spotify.com/track/${A}`, key: 9, mode: 0, energy: 0.2 },
    ] },
  }));
  const rows = await fetchAudioFeatures([A, B]);
  get.mock.restore();
  const byId = new Map(rows.map((r) => [r.spotifyTrackId, r]));
  assert.equal(byId.get(A)?.key, 9);
  assert.equal(byId.get(B)?.key, 2);
});

test("without hrefs, falls back to one request per track", async () => {
  const calls: string[] = [];
  const get = mock.method(axios, "get", async (_url: string, cfg: { params: { ids: string } }) => {
    calls.push(cfg.params.ids);
    const key = cfg.params.ids === A ? 9 : cfg.params.ids === B ? 2 : 0;
    return { data: { content: [{ key, mode: 1 }] } };
  });
  const rows = await fetchAudioFeatures([A, B]);
  get.mock.restore();
  assert.deepEqual(calls, [`${A},${B}`, A, B]);
  assert.equal(rows.find((r) => r.spotifyTrackId === A)?.key, 9);
});
