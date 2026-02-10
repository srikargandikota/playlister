import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { runCommand } from "@api/commands";

type Props = NativeStackScreenProps<RootStackParamList, "Command">;

// TODO: Replace with real auth state (context/secure storage).
const TEMP_TOKEN = "";

export const CommandScreen: React.FC<Props> = ({ navigation }) => {
  const [input, setInput] = useState("play chill");
  const [error, setError] = useState<string | null>(null);
  const [uris, setUris] = useState<string[]>([]);
  const [tracks, setTracks] = useState<
    Array<{ name: string; artists: string; spotifyTrackId: string }>
  >([]);

  const handleRun = async () => {
    try {
      setError(null);
      const res = await runCommand(TEMP_TOKEN, input);
      setUris(res.uris);
      setTracks(res.queue.map((q) => ({ name: q.name, artists: q.artists, spotifyTrackId: q.spotifyTrackId })));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePlay = () => {
    // TODO: integrate with Spotify playback SDK and pass `uris`.
    navigation.navigate("Player", { uris });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Command</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="e.g., play chill study"
        placeholderTextColor="#666"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Run" onPress={handleRun} />

      <Text style={styles.label}>Results</Text>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.spotifyTrackId}
        renderItem={({ item }) => (
          <View style={styles.resultItem}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.resultSubtitle}>{item.artists}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tracks yet.</Text>}
      />

      {uris.length > 0 && <Button title="Play in Spotify" onPress={handlePlay} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16
  },
  label: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 4,
    padding: 8,
    color: "#fff",
    marginBottom: 8
  },
  error: {
    color: "red",
    marginBottom: 8
  },
  resultItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333"
  },
  resultTitle: {
    color: "#fff",
    fontSize: 16
  },
  resultSubtitle: {
    color: "#aaa",
    fontSize: 14
  },
  empty: {
    color: "#666",
    marginTop: 8
  }
});

