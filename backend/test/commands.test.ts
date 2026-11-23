import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/services/commandService";
import { interpretWithRules, validateLlmJson } from "../src/services/aiCommandService";
import { trimToDuration } from "../src/services/queueService";

test("typed grammar: AND, OR, count, duration", () => {
  assert.deepEqual(parseCommand("play chill study"), { action: "play", tags: ["chill", "study"], matchMode: "AND", limit: 100, maxDurationMs: undefined });
  assert.equal(parseCommand("queue any hype workout").matchMode, "OR");
  assert.equal(parseCommand("queue 20 hype").limit, 20);
  const d = parseCommand("play chill for 45 minutes");
  assert.deepEqual(d.tags, ["chill"]);
  assert.equal(d.maxDurationMs, 45 * 60_000);
  assert.throws(() => parseCommand("shuffle chill"));
  assert.throws(() => parseCommand("play"));
  assert.throws(() => parseCommand("play chill for soon"));
});

test("rule interpreter maps everyday words onto auto tags", () => {
  const tags = ["chill", "study", "minor", "major", "low-energy", "mellow", "melancholy", "a-minor", "late-night"];
  const r = interpretWithRules("something sad in a minor key for studying, 30 minutes", tags);
  assert.ok(r.command.tags.includes("minor"));
  assert.ok(r.command.tags.includes("melancholy"));
  assert.ok(!r.command.tags.includes("a-minor"), "'a minor key' means any minor key");
  assert.equal(r.command.maxDurationMs, 30 * 60_000);

  const k = interpretWithRules("play songs in A minor", tags);
  assert.ok(k.command.tags.includes("a-minor"));

  const multi = interpretWithRules("late night chill", tags);
  assert.ok(multi.command.tags.includes("late-night"));
  assert.throws(() => interpretWithRules("polka", tags));
});

test("LLM output is validated and unknown tags are dropped", () => {
  const out = validateLlmJson('Sure: {"tags": ["minor", "rainy"], "matchMode": "AND", "limit": 15, "maxMinutes": null}', "play", ["minor", "chill"]);
  assert.deepEqual(out.command.tags, ["minor"]);
  assert.deepEqual(out.droppedTags, ["rainy"]);
  assert.equal(out.command.limit, 15);
  assert.throws(() => validateLlmJson('{"tags": ["rainy"], "matchMode": "AND"}', "play", ["minor"]));
  assert.throws(() => validateLlmJson("no json here", "play", ["minor"]));
});

test("duration cap skips tracks that do not fit", () => {
  const items = [{ durationMs: 200_000 }, { durationMs: 900_000 }, { durationMs: 300_000 }];
  assert.deepEqual(trimToDuration(items, 600_000), [{ durationMs: 200_000 }, { durationMs: 300_000 }]);
});
