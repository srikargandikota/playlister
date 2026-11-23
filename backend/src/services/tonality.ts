// Tonality classification: turns raw audio features (key, mode, energy, valence, tempo)
// into human readable labels and auto tags. Pure functions only, so it is easy to test.

export const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export interface AudioFeatures {
  key: number | null; // 0 to 11 (C = 0), or -1 / null when no key was detected
  mode: number | null; // 1 = major, 0 = minor
  tempo: number | null; // BPM
  energy: number | null; // 0.0 to 1.0
  valence: number | null; // 0.0 to 1.0 (musical positiveness)
  danceability: number | null;
  acousticness: number | null;
}

export type Mode = "major" | "minor";
export type EnergyBand = "low" | "medium" | "high";

export interface TonalityClassification {
  keyName: string | null; // e.g. "A minor"
  mode: Mode | null;
  camelot: string | null; // Camelot wheel code used by DJs for harmonic mixing, e.g. "8A"
  energyBand: EnergyBand | null;
  mood: string | null; // e.g. "bright", "melancholy"
  autoTags: string[]; // tag names to attach automatically
}

// Camelot numbers indexed by pitch class. Major keys use the "B" ring, minor keys the "A" ring.
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

function isValidKey(key: number | null): key is number {
  return key !== null && Number.isInteger(key) && key >= 0 && key <= 11;
}

function toMode(mode: number | null): Mode | null {
  if (mode === 1) return "major";
  if (mode === 0) return "minor";
  return null;
}

export function keyName(key: number | null, mode: number | null): string | null {
  const m = toMode(mode);
  if (!isValidKey(key) || !m) return null;
  return `${PITCH_CLASSES[key]} ${m}`;
}

export function camelotCode(key: number | null, mode: number | null): string | null {
  const m = toMode(mode);
  if (!isValidKey(key) || !m) return null;
  return m === "major" ? `${CAMELOT_MAJOR[key]}B` : `${CAMELOT_MINOR[key]}A`;
}

export function energyBand(energy: number | null): EnergyBand | null {
  if (energy === null || Number.isNaN(energy)) return null;
  if (energy < 0.4) return "low";
  if (energy < 0.7) return "medium";
  return "high";
}

// Mood combines mode with valence and energy. Mode alone is a weak signal
// (plenty of upbeat songs are in minor keys), so valence carries most of the weight.
export function moodLabel(mode: Mode | null, valence: number | null, energy: number | null): string | null {
  if (valence === null) return null;
  const e = energy ?? 0.5;
  if (valence >= 0.6) return e >= 0.6 ? "euphoric" : "bright";
  if (valence <= 0.35) {
    if (e >= 0.6) return "intense";
    return mode === "minor" ? "melancholy" : "wistful";
  }
  return e >= 0.6 ? "driving" : "mellow";
}

export function classifyTonality(f: AudioFeatures): TonalityClassification {
  const mode = toMode(f.mode);
  const name = keyName(f.key, f.mode);
  const camelot = camelotCode(f.key, f.mode);
  const band = energyBand(f.energy);
  const mood = moodLabel(mode, f.valence, f.energy);

  const autoTags: string[] = [];
  if (mode) autoTags.push(mode); // "major" / "minor"
  if (name) autoTags.push(name.toLowerCase().replace(" ", "-").replace("#", "sharp")); // "a-minor", "csharp-major"
  if (band) autoTags.push(`${band}-energy`);
  if (mood) autoTags.push(mood);

  return { keyName: name, mode, camelot, energyBand: band, mood, autoTags };
}

// Harmonic compatibility on the Camelot wheel: same code, one step around the wheel
// on the same ring, or the relative major/minor (same number, other ring).
// Returns 1 for a perfect match, 0.75 for an adjacent key, 0 otherwise.
export function harmonicScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const pa = parseCamelot(a);
  const pb = parseCamelot(b);
  if (!pa || !pb) return 0;
  if (pa.num === pb.num && pa.ring === pb.ring) return 1;
  if (pa.num === pb.num) return 0.75; // relative major/minor
  const diff = Math.abs(pa.num - pb.num);
  const wheelDistance = Math.min(diff, 12 - diff);
  if (pa.ring === pb.ring && wheelDistance === 1) return 0.75;
  return 0;
}

function parseCamelot(code: string): { num: number; ring: "A" | "B" } | null {
  const m = /^(\d{1,2})([AB])$/.exec(code);
  if (!m) return null;
  const num = Number(m[1]);
  if (num < 1 || num > 12) return null;
  return { num, ring: m[2] as "A" | "B" };
}
