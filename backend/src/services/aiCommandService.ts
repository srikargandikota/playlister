import axios from "axios";
import { z } from "zod";
import { env } from "../config/env";
import { ParsedCommand } from "./commandService";

// Turns a free text request ("something mellow in a minor key for studying, 30 minutes")
// into the same ParsedCommand the typed grammar produces. The model may only choose from
// tags the user actually has (manual tags plus auto tonality tags), so it cannot invent a
// filter that matches nothing. Without an API key, a rule based fallback does the mapping.

const LlmOutput = z.object({
  tags: z.array(z.string()).max(6),
  matchMode: z.enum(["AND", "OR"]),
  limit: z.number().int().min(1).max(200).nullable().optional(),
  maxMinutes: z.number().int().min(1).max(600).nullable().optional(),
});

export interface InterpretResult {
  command: ParsedCommand;
  interpreter: "llm" | "rules";
  droppedTags: string[];
}

// Everyday words mapped to the auto tags produced by the tonality classifier.
const SYNONYMS: Record<string, string[]> = {
  sad: ["melancholy", "minor"],
  melancholy: ["melancholy"],
  moody: ["minor"],
  dark: ["minor"],
  happy: ["bright"],
  bright: ["bright"],
  upbeat: ["high-energy"],
  hype: ["high-energy"],
  energetic: ["high-energy"],
  intense: ["intense"],
  calm: ["low-energy"],
  chill: ["low-energy", "mellow"],
  mellow: ["mellow"],
  relaxed: ["low-energy"],
  quiet: ["low-energy"],
  euphoric: ["euphoric"],
};

export function interpretWithRules(input: string, availableTags: string[]): InterpretResult {
  const text = input.toLowerCase();
  const available = new Set(availableTags.map((t) => t.toLowerCase()));
  const chosen: string[] = [];
  const add = (t: string) => {
    if (available.has(t) && !chosen.includes(t)) chosen.push(t);
  };

  // Exact tag names first (handles multi word tags like "late-night" written as "late night").
  for (const tag of available) {
    if (/^[a-g](sharp)?-(major|minor)$/.test(tag)) continue; // key tags are handled below
    const spaced = tag.replace(/-/g, " ");
    if (new RegExp(`\\b${escapeRe(spaced)}\\b`).test(text) || new RegExp(`\\b${escapeRe(tag)}\\b`).test(text)) add(tag);
  }
  // Explicit keys, e.g. "in a minor" -> "a-minor"; "minor key" alone -> "minor".
  // "in a minor key" means any minor key, not A minor, so a bare "a" followed by "key" is skipped.
  const keyMatch = /\b([a-g])(#|sharp)?\s+(major|minor)\b(\s+key)?/.exec(text);
  if (keyMatch && !(keyMatch[1] === "a" && !keyMatch[2] && keyMatch[4])) {
    add(`${keyMatch[1]}${keyMatch[2] ? "sharp" : ""}-${keyMatch[3]}`);
  }
  if (/\bminor\b/.test(text)) add("minor");
  if (/\bmajor\b/.test(text)) add("major");
  for (const [word, tags] of Object.entries(SYNONYMS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) tags.forEach(add);
  }

  if (chosen.length === 0) throw new Error("Could not match that request to any of your tags");

  const matchMode: "AND" | "OR" = /\b(or|any|either)\b/.test(text) ? "OR" : "AND";
  const count = /\b(\d{1,3})\s*(songs|tracks)\b/.exec(text);
  const minutes = /\b(\d{1,3})\s*(min|mins|minutes)\b/.exec(text);
  const hours = /\b(\d{1,2})\s*(hr|hrs|hour|hours)\b/.exec(text);

  return {
    command: {
      action: /\bqueue\b/.test(text) ? "queue" : "play",
      tags: chosen.slice(0, 6),
      matchMode,
      limit: count ? Math.min(Number(count[1]), 200) : 100,
      maxDurationMs: minutes ? Number(minutes[1]) * 60_000 : hours ? Number(hours[1]) * 3_600_000 : undefined,
    },
    interpreter: "rules",
    droppedTags: [],
  };
}

export async function interpretWithLlm(input: string, availableTags: string[]): Promise<InterpretResult> {
  const system =
    "You convert a music listening request into a JSON filter over the user's own tags. " +
    "Only use tags from the provided list, copied exactly. Prefer 1 to 3 tags. " +
    'Use matchMode "AND" when every tag should apply and "OR" when any is fine. ' +
    "Set limit if the user asks for a number of songs, and maxMinutes if they ask for a duration. " +
    'Reply with JSON only, shaped like {"tags": [], "matchMode": "AND", "limit": null, "maxMinutes": null}.';

  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: env.anthropicModel,
      max_tokens: 200,
      system,
      messages: [
        {
          role: "user",
          content: `Available tags: ${JSON.stringify(availableTags)}\nRequest: ${input}`,
        },
      ],
    },
    {
      headers: {
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 15_000,
    }
  );

  const text: string = (res.data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return validateLlmJson(text, input, availableTags);
}

// Validates model output and drops any tag the user does not have. Exported for tests.
export function validateLlmJson(text: string, input: string, availableTags: string[]): InterpretResult {
  const json = JSON.parse(extractJsonObject(text));
  const parsed = LlmOutput.parse(json);
  const available = new Set(availableTags);
  const tags = parsed.tags.filter((t) => available.has(t));
  const droppedTags = parsed.tags.filter((t) => !available.has(t));
  if (tags.length === 0) throw new Error("Model returned no usable tags");
  return {
    command: {
      action: /\bqueue\b/i.test(input) ? "queue" : "play",
      tags,
      matchMode: parsed.matchMode,
      limit: parsed.limit ?? 100,
      maxDurationMs: parsed.maxMinutes ? parsed.maxMinutes * 60_000 : undefined,
    },
    interpreter: "llm",
    droppedTags,
  };
}

export async function interpret(input: string, availableTags: string[]): Promise<InterpretResult> {
  if (env.anthropicApiKey) {
    try {
      return await interpretWithLlm(input, availableTags);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("LLM interpretation failed, falling back to rules:", (err as Error).message);
    }
  }
  return interpretWithRules(input, availableTags);
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return text.slice(start, end + 1);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
