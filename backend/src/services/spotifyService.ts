import axios from "axios";
import { SPOTIFY_API_BASE_URL, SPOTIFY_TOKEN_URL } from "../config/spotify";
import { env } from "../config/env";
import { query } from "../db/pool";

export interface SpotifyTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: env.spotifyClientId,
    code_verifier: params.codeVerifier,
  });

  const response = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = response.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(userId: string): Promise<string> {
  const rows = await query<SpotifyTokenRow>(
    "SELECT * FROM spotify_tokens WHERE user_id = $1",
    [userId]
  );
  const tokenRow = rows[0];
  if (!tokenRow) {
    throw new Error("No refresh token stored for user");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenRow.refresh_token,
    client_id: env.spotifyClientId,
    client_secret: env.spotifyClientSecret,
  });

  const response = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = response.data as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await query(
    "UPDATE spotify_tokens SET access_token = $1, expires_at = $2 WHERE user_id = $3",
    [data.access_token, expiresAt.toISOString(), userId]
  );

  return data.access_token;
}

export async function getSpotifyProfile(accessToken: string): Promise<unknown> {
  const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function getUserLikedTracks(accessToken: string, options?: {
  limit?: number;
  offset?: number;
}): Promise<unknown> {
  const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    },
  });
  return response.data;
}

