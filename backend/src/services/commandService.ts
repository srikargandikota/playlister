export type CommandAction = "play" | "queue";

export interface ParsedCommand {
  action: CommandAction;
  tags: string[];
  matchMode: "AND" | "OR";
  limit: number;
  maxDurationMs?: number; // optional cap on total queue length
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// Grammar:
//   (play|queue) [N] [any] tag [tag ...] [for M (min|minutes|h|hours)]
// Examples:
//   play chill study             -> tracks tagged chill AND study
//   queue any hype workout       -> tracks tagged hype OR workout
//   queue 20 hype                -> at most 20 tracks tagged hype
//   play chill for 45 minutes    -> chill tracks, capped at 45 minutes total
export function parseCommand(input: string): ParsedCommand {
  const tokens = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error("Empty command");
  }

  const first = tokens.shift() as string;
  if (first !== "play" && first !== "queue") {
    throw new Error("Command must start with 'play' or 'queue'");
  }
  const action: CommandAction = first;

  let limit = DEFAULT_LIMIT;
  if (tokens[0] && /^\d+$/.test(tokens[0])) {
    limit = Math.min(Math.max(Number(tokens.shift()), 1), MAX_LIMIT);
  }

  let matchMode: "AND" | "OR" = "AND";
  if (tokens[0] === "any") {
    matchMode = "OR";
    tokens.shift();
  }

  let maxDurationMs: number | undefined;
  const forIdx = tokens.indexOf("for");
  if (forIdx !== -1) {
    const amount = Number(tokens[forIdx + 1]);
    const unit = tokens[forIdx + 2] ?? "";
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Expected a number after 'for', e.g. 'for 45 minutes'");
    }
    if (/^(m|min|mins|minute|minutes)$/.test(unit)) maxDurationMs = amount * 60_000;
    else if (/^(h|hr|hrs|hour|hours)$/.test(unit)) maxDurationMs = amount * 3_600_000;
    else throw new Error("Duration unit must be minutes or hours");
    tokens.splice(forIdx, 3);
  }

  const tags = tokens;
  if (tags.length === 0) {
    throw new Error("At least one tag is required");
  }

  return { action, tags, matchMode, limit, maxDurationMs };
}
