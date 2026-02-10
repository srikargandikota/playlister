export type CommandAction = "play" | "queue";

export interface ParsedCommand {
  action: CommandAction;
  tags: string[];
  matchMode: "AND" | "OR";
  limit: number;
}

// Very simple parser based on the plan's grammar.
export function parseCommand(input: string): ParsedCommand {
  const tokens = input.trim().split(/\s+/);
  if (tokens.length === 0) {
    throw new Error("Empty command");
  }

  const [first, second, ...rest] = tokens;
  let action: CommandAction;
  let matchMode: "AND" | "OR" = "AND";
  let tags: string[] = [];

  if (first === "play" || first === "queue") {
    action = first;
  } else {
    throw new Error("Command must start with 'play' or 'queue'");
  }

  if (second === "any") {
    matchMode = "OR";
    tags = rest;
  } else {
    tags = [second, ...rest];
  }

  if (tags.length === 0) {
    throw new Error("At least one tag is required");
  }

  // MVP: fixed limit; can later parse numbers or durations.
  return {
    action,
    tags,
    matchMode,
    limit: 100,
  };
}

