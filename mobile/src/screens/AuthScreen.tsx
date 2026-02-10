import React, { useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { getSpotifyLoginUrl, exchangeCodeForToken } from "@api/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

WebBrowser.maybeCompleteAuthSession();

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      const redirectUri = AuthSession.makeRedirectUri();
      const codeVerifier = AuthSession.generateRandom(64);

      // PKCE: code_challenge = BASE64URL-ENCODE(SHA256(code_verifier))
      const base64Digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      const codeChallenge = base64Digest
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const { url } = await getSpotifyLoginUrl(codeChallenge, "S256");

      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);

      if (result.type !== "success" || !result.url) {
        throw new Error("Authorization cancelled or failed");
      }

      const parsed = new URL(result.url);
      const code = parsed.searchParams.get("code");
      if (!code) {
        throw new Error("No authorization code returned");
      }

      const { token } = await exchangeCodeForToken(code, codeVerifier);

      // In a real app, persist this token (e.g., context + secure storage).
      // For now, just navigate and pass it via params.
      navigation.reset({
        index: 0,
        routes: [{ name: "Library", params: undefined as never }]
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your Spotify account</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Connect with Spotify" onPress={handleConnect} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#000"
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center"
  },
  error: {
    color: "red",
    marginBottom: 16,
    textAlign: "center"
  }
});

