import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { fetchTracks, Track } from "@api/tracks";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

// TODO: Replace with real auth state (context/secure storage).
const TEMP_TOKEN = "";

export const LibraryScreen: React.FC<Props> = ({ navigation }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchTracks(TEMP_TOKEN);
        setTracks(res.items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.track_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              navigation.navigate("TrackDetail", {
                trackId: item.track_id
              })
            }
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.artists}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000"
  },
  item: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333"
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 4
  },
  error: {
    color: "red"
  }
});

