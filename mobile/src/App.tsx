import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthScreen } from "@screens/AuthScreen";
import { LibraryScreen } from "@screens/LibraryScreen";
import { TrackDetailScreen } from "@screens/TrackDetailScreen";
import { CommandScreen } from "@screens/CommandScreen";
import { PlayerScreen } from "@screens/PlayerScreen";

export type RootStackParamList = {
  Auth: undefined;
  Library: undefined;
  TrackDetail: { trackId: string };
  Command: undefined;
  Player: { uris: string[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Connect Spotify" }} />
        <Stack.Screen name="Library" component={LibraryScreen} options={{ title: "Your Library" }} />
        <Stack.Screen
          name="TrackDetail"
          component={TrackDetailScreen}
          options={{ title: "Track Details" }}
        />
        <Stack.Screen name="Command" component={CommandScreen} options={{ title: "Command" }} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ title: "Player" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

