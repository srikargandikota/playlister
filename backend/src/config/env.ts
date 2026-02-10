import dotenv from "dotenv";

dotenv.config();

export const env = {
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  databaseUrl: process.env.DATABASE_URL ?? "",
};

if (!env.spotifyClientId || !env.spotifyRedirectUri) {
  // eslint-disable-next-line no-console
  console.warn(
    "SPOTIFY_CLIENT_ID or SPOTIFY_REDIRECT_URI not set. OAuth will not work until configured."
  );
}

