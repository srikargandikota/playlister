import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

export const PlayerScreen: React.FC<Props> = ({ route }) => {
  const { uris } = route.params;

  // TODO: Integrate with Spotify playback SDK on mobile and start playback of these URIs.

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Player</Text>
      <Text style={styles.text}>URIs to play:</Text>
      {uris.map((uri) => (
        <Text key={uri} style={styles.uri}>
          {uri}
        </Text>
      ))}
      <Text style={styles.text}>
        Playback integration with Spotify SDK goes here (select device, start/pause/skip).
      </Text>
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
    marginBottom: 12
  },
  text: {
    color: "#ccc",
    fontSize: 16,
    marginBottom: 8
  },
  uri: {
    color: "#0f0",
    fontSize: 14
  }
});

