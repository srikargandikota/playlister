import dotenv from "dotenv";

dotenv.config();

export const env = {
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Audio features provider (see services/featureService.ts).
  reccobeatsBaseUrl: process.env.RECCOBEATS_BASE_URL ?? "https://api.reccobeats.com/v1",
  reccobeatsBatchSize: Number(process.env.RECCOBEATS_BATCH_SIZE ?? 40),
  // Optional: natural language commands use Claude when a key is set, and fall back to a
  // rule based parser when it is not (see services/aiCommandService.ts).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
};

if (!env.spotifyClientId || !env.spotifyRedirectUri) {
  // eslint-disable-next-line no-console
  console.warn(
    "SPOTIFY_CLIENT_ID or SPOTIFY_REDIRECT_URI not set. OAuth will not work until configured."
  );
}

