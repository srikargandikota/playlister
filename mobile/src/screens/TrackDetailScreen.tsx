import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { fetchSongRecommendations, fetchTonality, SongRecommendation, Tonality } from "@api/recommendations";
import { getToken } from "@api/session";

type Props = NativeStackScreenProps<RootStackParamList, "TrackDetail">;


export const TrackDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { trackId } = route.params;
  const [tonality, setTonality] = useState<Tonality | null>(null);
  const [recs, setRecs] = useState<SongRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [t, r] = await Promise.all([
          fetchTonality(getToken(), trackId).catch(() => null),
          fetchSongRecommendations(getToken(), trackId)
        ]);
        setTonality(t);
        setRecs(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    load();
  }, [trackId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tonality</Text>
      {tonality ? (
        <>
          <Text style={styles.text}>
            {tonality.keyName ?? "Key not detected"}
            {tonality.camelot ? `  (${tonality.camelot})` : ""}
          </Text>
          <Text style={styles.text}>
            {[tonality.energyBand && `${tonality.energyBand} energy`, tonality.mood].filter(Boolean).join(", ")}
          </Text>
        </>
      ) : (
        <Text style={styles.text}>Not classified yet. Sync your library to classify it.</Text>
      )}

      <Text style={styles.title}>More like this</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={recs}
        keyExtractor={(item) => item.trackId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.push("TrackDetail", { trackId: item.trackId })}
          >
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>{item.reasons.join(" · ") || item.artists}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.text}>No recommendations yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginTop: 12,
    marginBottom: 8
  },
  text: {
    color: "#ccc",
    fontSize: 16,
    marginBottom: 4
  },
  error: {
    color: "red",
    marginBottom: 8
  },
  item: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333"
  },
  itemTitle: {
    color: "#fff",
    fontSize: 16
  },
  itemSubtitle: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2
  }
});
