import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "../config/spotify";
import { exchangeCodeForTokens, getSpotifyProfile } from "../services/spotifyService";
import { query } from "../db/pool";

export const authRouter = Router();

// Mobile app calls this to get the Spotify authorize URL (PKCE is handled on-device).
authRouter.get("/login-url", (req, res) => {
  const { code_challenge, code_challenge_method } = req.query;
  if (typeof code_challenge !== "string" || typeof code_challenge_method !== "string") {
    return res.status(400).json({ error: "code_challenge and code_challenge_method required" });
  }

  const url = new URL(SPOTIFY_AUTH_URL);
  url.searchParams.set("client_id", env.spotifyClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.spotifyRedirectUri);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("code_challenge", code_challenge);
  url.searchParams.set("code_challenge_method", code_challenge_method);

  res.json({ url: url.toString() });
});

// Called by the mobile app after it receives the authorization code from Spotify.
authRouter.post("/callback", async (req, res) => {
  const { code, codeVerifier } = req.body as { code?: string; codeVerifier?: string };
  if (!code || !codeVerifier) {
    return res.status(400).json({ error: "code and codeVerifier are required" });
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens({
      code,
      codeVerifier,
      redirectUri: env.spotifyRedirectUri,
    });

    const profile = (await getSpotifyProfile(accessToken)) as {
      id: string;
      display_name?: string;
      email?: string;
      country?: string;
      product?: string;
    };

    const userRows = await query<{ id: string }>(
      "INSERT INTO users (spotify_user_id, display_name, email, country, product) " +
        "VALUES ($1, $2, $3, $4, $5) " +
        "ON CONFLICT (spotify_user_id) DO UPDATE SET " +
        "display_name = EXCLUDED.display_name, " +
        "email = EXCLUDED.email, " +
        "country = EXCLUDED.country, " +
        "product = EXCLUDED.product " +
        "RETURNING id",
      [
        profile.id,
        profile.display_name ?? null,
        profile.email ?? null,
        profile.country ?? null,
        profile.product ?? null,
      ]
    );
    const userId = userRows[0].id;

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await query(
      "INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at) " +
        "VALUES ($1, $2, $3, $4) " +
        "ON CONFLICT (user_id) DO UPDATE SET " +
        "access_token = EXCLUDED.access_token, " +
        "refresh_token = EXCLUDED.refresh_token, " +
        "expires_at = EXCLUDED.expires_at",
      [userId, accessToken, refreshToken, expiresAt]
    );

    const appToken = jwt.sign({ userId }, env.jwtSecret, { expiresIn: "7d" });
    res.json({ token: appToken });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auth callback failed", err);
    res.status(500).json({ error: "Auth failed" });
  }
});

