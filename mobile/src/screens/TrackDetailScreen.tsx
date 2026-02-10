import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";

type Props = NativeStackScreenProps<RootStackParamList, "TrackDetail">;

export const TrackDetailScreen: React.FC<Props> = ({ route }) => {
  const { trackId } = route.params;

  // TODO: Fetch track details and tags, and render tag chips + add/remove tag UI.

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track Detail</Text>
      <Text style={styles.text}>Track ID: {trackId}</Text>
      <Text style={styles.text}>Tag UI goes here.</Text>
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
  }
});

