import { apiRequest } from "./client";

export async function getSpotifyLoginUrl(codeChallenge: string, codeChallengeMethod: string) {
  return apiRequest<{ url: string }>({
    path: `/auth/login-url?code_challenge=${encodeURIComponent(
      codeChallenge
    )}&code_challenge_method=${encodeURIComponent(codeChallengeMethod)}`
  });
}

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  return apiRequest<{ token: string }>({
    path: "/auth/callback",
    method: "POST",
    body: { code, codeVerifier }
  });
}

