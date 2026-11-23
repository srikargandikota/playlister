// Recommendation logic over the user's own library. Pure functions: the service layer
// loads rows from Postgres and passes them in, which keeps this file unit testable.

import { AudioFeatures, camelotCode, harmonicScore } from "./tonality";

export interface LibraryTrack {
  trackId: string;
  spotifyTrackId: string;
  name: string;
  artists: string;
  tags: string[]; // manual and auto tag names
  features: AudioFeatures | null;
}

export interface ScoredTrack {
  track: LibraryTrack;
  score: number;
  reasons: string[];
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// Similarity in [0, 1] over energy, valence, danceability, acousticness and tempo.
// Tempo is compared on a log scale with half and double time treated as equal,
// because a 70 BPM and a 140 BPM track usually feel like the same pulse.
export function featureSimilarity(a: AudioFeatures | null, b: AudioFeatures | null): number {
  if (!a || !b) return 0;
  const dims: Array<[number | null, number | null]> = [
    [a.energy, b.energy],
    [a.valence, b.valence],
    [a.danceability, b.danceability],
    [a.acousticness, b.acousticness],
  ];
  let sum = 0;
  let n = 0;
  for (const [x, y] of dims) {
    if (x === null || y === null) continue;
    sum += 1 - Math.abs(x - y);
    n++;
  }
  if (a.tempo && b.tempo) {
    const ratio = Math.abs(Math.log2(a.tempo / b.tempo));
    const folded = Math.min(ratio, Math.abs(ratio - 1)); // treat double time as a match
    sum += Math.max(0, 1 - folded / 0.25); // within ~19% tempo still scores
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

const WEIGHTS = { tags: 0.45, harmonic: 0.2, features: 0.35 };

export function recommendSongs(seed: LibraryTrack, library: LibraryTrack[], limit = 20): ScoredTrack[] {
  const seedCamelot = seed.features ? camelotCode(seed.features.key, seed.features.mode) : null;
  const scored: ScoredTrack[] = [];

  for (const t of library) {
    if (t.trackId === seed.trackId) continue;
    const reasons: string[] = [];
    const tagSim = jaccard(seed.tags, t.tags);
    const cam = t.features ? camelotCode(t.features.key, t.features.mode) : null;
    const harm = harmonicScore(seedCamelot, cam);
    const feat = featureSimilarity(seed.features, t.features);

    const shared = seed.tags.filter((x) => t.tags.includes(x));
    if (shared.length) reasons.push(`shares tags: ${shared.slice(0, 3).join(", ")}`);
    if (harm === 1) reasons.push(`same key (${cam})`);
    else if (harm > 0) reasons.push(`harmonically compatible (${seedCamelot} to ${cam})`);
    if (feat >= 0.8) reasons.push("similar energy and mood");

    const score = WEIGHTS.tags * tagSim + WEIGHTS.harmonic * harm + WEIGHTS.features * feat;
    if (score > 0) scored.push({ track: t, score: Number(score.toFixed(4)), reasons });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface PlaylistSuggestion {
  name: string;
  basis: string[]; // the tags that define it
  trackIds: string[];
}

// Suggest playlists from tag combinations that cover enough tracks: every single tag,
// plus pairs of tags (for example "focus" + "low-energy"). Tracks inside each playlist
// are ordered so neighbors are harmonically compatible where possible.
export function suggestPlaylists(
  library: LibraryTrack[],
  opts: { minSize?: number; maxSuggestions?: number } = {}
): PlaylistSuggestion[] {
  const minSize = opts.minSize ?? 8;
  const maxSuggestions = opts.maxSuggestions ?? 10;

  const byTag = new Map<string, LibraryTrack[]>();
  for (const t of library) for (const tag of t.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), t]);
  const tags = [...byTag.keys()].filter((t) => (byTag.get(t) ?? []).length >= minSize).sort();

  const candidates: PlaylistSuggestion[] = [];
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = byTag.get(tags[i]) ?? [];
      const bIds = new Set((byTag.get(tags[j]) ?? []).map((t) => t.trackId));
      const both = a.filter((t) => bIds.has(t.trackId));
      if (both.length >= minSize) {
        candidates.push({
          name: `${titleCase(tags[i])} + ${titleCase(tags[j])}`,
          basis: [tags[i], tags[j]],
          trackIds: harmonicOrder(both).map((t) => t.trackId),
        });
      }
    }
  }
  // Prefer specific pairs, then fall back to single tags if there are too few pairs.
  candidates.sort((x, y) => y.trackIds.length - x.trackIds.length);
  if (candidates.length < maxSuggestions) {
    for (const tag of tags) {
      candidates.push({
        name: titleCase(tag),
        basis: [tag],
        trackIds: harmonicOrder(byTag.get(tag) ?? []).map((t) => t.trackId),
      });
    }
  }
  return candidates.slice(0, maxSuggestions);
}

// Greedy walk: start from the first track, then always pick the most harmonically
// compatible remaining track (ties broken by feature similarity).
export function harmonicOrder(tracks: LibraryTrack[]): LibraryTrack[] {
  if (tracks.length <= 2) return [...tracks];
  const remaining = [...tracks];
  const ordered = [remaining.shift() as LibraryTrack];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    const lastCam = last.features ? camelotCode(last.features.key, last.features.mode) : null;
    let bestIdx = 0;
    let best = -1;
    remaining.forEach((t, idx) => {
      const cam = t.features ? camelotCode(t.features.key, t.features.mode) : null;
      const s = harmonicScore(lastCam, cam) + 0.5 * featureSimilarity(last.features, t.features);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

export interface TagSuggestion {
  trackId: string;
  tag: string;
  confidence: number;
}

// Suggest manual tags for tracks that do not have them yet, using a nearest centroid
// model: for each manual tag with enough examples, average its tracks' features, then
// suggest it for untagged tracks whose features sit close to that average.
export function suggestTags(
  library: LibraryTrack[],
  manualTags: Set<string>,
  opts: { minExamples?: number; threshold?: number } = {}
): TagSuggestion[] {
  const minExamples = opts.minExamples ?? 3;
  const threshold = opts.threshold ?? 0.85;
  const out: TagSuggestion[] = [];

  for (const tag of manualTags) {
    const examples = library.filter((t) => t.tags.includes(tag) && t.features);
    if (examples.length < minExamples) continue;
    const centroid = averageFeatures(examples.map((t) => t.features as AudioFeatures));
    for (const t of library) {
      if (t.tags.includes(tag) || !t.features) continue;
      const sim = featureSimilarity(centroid, t.features);
      if (sim >= threshold) out.push({ trackId: t.trackId, tag, confidence: Number(sim.toFixed(3)) });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

export function averageFeatures(list: AudioFeatures[]): AudioFeatures {
  const avg = (pick: (f: AudioFeatures) => number | null) => {
    const vals = list.map(pick).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  // Tempos are first folded into the same octave as the first one (so 140 BPM counts as
  // 70 when the first is 70), then averaged geometrically. Without folding, 70 and 140
  // would average to an unrelated ~99 BPM.
  const tempos = list.map((f) => f.tempo).filter((v): v is number => !!v && v > 0);
  let tempo: number | null = null;
  if (tempos.length) {
    const base = Math.log2(tempos[0]);
    const folded = tempos.map((t) => {
      let l = Math.log2(t);
      while (l - base > 0.5) l -= 1;
      while (base - l > 0.5) l += 1;
      return l;
    });
    tempo = 2 ** (folded.reduce((s, v) => s + v, 0) / folded.length);
  }
  return {
    key: null,
    mode: null,
    tempo,
    energy: avg((f) => f.energy),
    valence: avg((f) => f.valence),
    danceability: avg((f) => f.danceability),
    acousticness: avg((f) => f.acousticness),
  };
}

function titleCase(s: string): string {
  return s
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

