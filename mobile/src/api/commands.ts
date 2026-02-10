import { apiRequest } from "./client";
import type { Track } from "./tracks";

export interface ParsedCommand {
  action: "play" | "queue";
  tags: string[];
  matchMode: "AND" | "OR";
  limit: number;
}

export interface CommandResponse {
  command: ParsedCommand;
  queue: Array<{
    trackId: string;
    spotifyTrackId: string;
    name: string;
    artists: string;
    album: string | null;
    durationMs: number;
  }>;
  uris: string[];
}

export async function runCommand(token: string, input: string) {
  return apiRequest<CommandResponse>({
    path: "/commands/run",
    method: "POST",
    body: { input },
    token
  });
}

