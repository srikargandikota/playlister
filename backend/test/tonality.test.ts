import { test } from "node:test";
import assert from "node:assert/strict";
import { camelotCode, classifyTonality, harmonicScore, keyName, moodLabel } from "../src/services/tonality";

test("key names and Camelot codes match the standard wheel", () => {
  assert.equal(keyName(0, 1), "C major");
  assert.equal(camelotCode(0, 1), "8B");
  assert.equal(keyName(9, 0), "A minor");
  assert.equal(camelotCode(9, 0), "8A"); // relative minor of C major
  assert.equal(camelotCode(7, 1), "9B"); // G major
  assert.equal(camelotCode(4, 0), "9A"); // E minor
  assert.equal(camelotCode(1, 0), "12A"); // C# minor
});

test("undetected key (-1) or missing mode yields no key label", () => {
  assert.equal(keyName(-1, 1), null);
  assert.equal(camelotCode(5, null), null);
});

test("harmonic score: same, relative, adjacent, distant", () => {
  assert.equal(harmonicScore("8A", "8A"), 1);
  assert.equal(harmonicScore("8A", "8B"), 0.75);
  assert.equal(harmonicScore("8A", "9A"), 0.75);
  assert.equal(harmonicScore("12B", "1B"), 0.75); // wraps around the wheel
  assert.equal(harmonicScore("8A", "3A"), 0);
  assert.equal(harmonicScore(null, "3A"), 0);
});

test("mood weighs valence over mode", () => {
  assert.equal(moodLabel("minor", 0.8, 0.8), "euphoric"); // upbeat song in a minor key
  assert.equal(moodLabel("minor", 0.2, 0.3), "melancholy");
  assert.equal(moodLabel("major", 0.2, 0.3), "wistful");
  assert.equal(moodLabel("major", 0.5, 0.3), "mellow");
});

test("classification produces auto tags", () => {
  const c = classifyTonality({ key: 1, mode: 0, tempo: 80, energy: 0.3, valence: 0.2, danceability: 0.4, acousticness: 0.7 });
  assert.equal(c.keyName, "C# minor");
  assert.deepEqual(c.autoTags, ["minor", "csharp-minor", "low-energy", "melancholy"]);
});
