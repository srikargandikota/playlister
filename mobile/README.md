## Mobile app overview

- **Stack**: React Native (Expo recommended) using TypeScript.
- **Screens**:
  - `AuthScreen`: button to “Connect with Spotify”, calls backend `/auth/login-url`, opens Spotify auth in a web view or browser, then posts code + codeVerifier to `/auth/callback` to obtain the app JWT.
  - `LibraryScreen`: lists tracks via `GET /tracks`, supports search/filter, and navigates to a track detail view.
  - `TrackDetailScreen`: shows track metadata and tags; allows adding/removing tags via `/tracks/tags` and `/tracks/:trackId/tags`.
  - `CommandScreen`: text input for commands (e.g. `play chill study`), calls `/commands/run` and shows the resulting queue.
  - `PlayerScreen`: shows current track and queue; initiates playback on a Spotify device using the Spotify SDK with the URIs returned from `/commands/run`.

- **Playback integration**:
  - Use Spotify’s mobile SDKs to start playback on the user’s active device, passing the URIs from `/commands/run`.
  - For an Expo app, consider a native module or a thin native shell that provides a `startPlayback(uris: string[])` function used by `PlayerScreen`.

