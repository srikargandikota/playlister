# 🎵 Playlister

**Tag your library once, and then just type what you are in the mood for.**

Playlister is a full-stack mobile app (React Native, Node/TypeScript, and Postgres) that replaces static playlists with on-demand setlists built from your own tags. I specced and built it with Claude Code and MCP tooling, and I designed the 4 core screens in Figma before writing any of the app.

## The problem

Playlists go stale, because you make "study vibes" in September and by December it no longer matches how you actually listen. The real unit of curation is the tag rather than the playlist, like `chill`, `hype`, `late-night`, or `focus`, and Spotify does not let you tag tracks. So this app does.

The core interaction is typing a command like the ones below and getting a freshly built queue every time.

```
play chill study        → tracks tagged chill AND study
queue any hype workout  → tracks tagged hype OR workout
```

## How it works

```
React Native (Expo) app
        │
        ▼
Node + Express + TypeScript API ──── Spotify Web API (OAuth PKCE)
        │
        ▼
PostgreSQL (users, tracks, tags, track_tags)
```

1. **Auth.** Spotify OAuth runs with PKCE, and the backend exchanges the code, stores the tokens, and issues its own JWT to the app.
2. **Sync.** The backend pulls your liked tracks into Postgres, and the sync is idempotent because `ON CONFLICT` upserts make sure repeat runs never duplicate your library. Token refresh happens automatically once an access token is within 60 seconds of expiring.
3. **Tag.** You create tags (mood, genre, or custom) and attach them to tracks from the mobile app.
4. **Command to query.** A small grammar parser turns variable-length commands into a single parameterized SQL query, where `AND` mode uses a `HAVING COUNT(DISTINCT tag) = n` aggregate and `OR` mode relaxes it. All user input is bound as parameters, so there is no string-built SQL anywhere.

## Product decisions worth noting

- **Commands over UI filters.** Typing `play chill study` is faster than tapping through filter menus, and it maps to how people already describe music to themselves.
- **Tags are per user, and tracks are global.** Track metadata is deduplicated across users while tagging stays personal, which keeps the schema clean and the sync cheap.
- **MVP honesty.** The parser has a fixed result limit and sync fetches only the first page. Both are marked as MVP in the code with a clear path to pagination and a richer grammar (durations and counts).

## Project structure

- [`backend/`](backend/) holds the Express API for auth, sync, tagging, and command to queue building.
- [`mobile/`](mobile/) holds the Expo app with auth, library, track detail, command, and player screens.

## Running it locally

<details>
<summary>Backend setup</summary>

1. Start Postgres with `docker compose up -d db`.
2. Copy `backend/.env.example` to `backend/.env` and set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `JWT_SECRET`, and `DATABASE_URL`.
3. Install and migrate with `cd backend && npm install && npm run db:migrate`.
4. Run `npm run dev`, then check `http://localhost:3000/health`.

</details>

<details>
<summary>Mobile setup</summary>

1. Run `cd mobile && npm install`.
2. Set `EXPO_PUBLIC_API_BASE_URL` to your backend, such as `http://localhost:3000`.
3. Run `npm start` and open the app in an iOS or Android emulator or on a device.

</details>

## Roadmap

- [ ] Full-library sync with pagination (currently the first page only)
- [ ] Spotify mobile SDK playback in `PlayerScreen`, because queue building works and in-app playback is next
- [ ] A richer command grammar, such as `play chill for 45 minutes` or `queue 20 hype`
- [ ] Smart tag suggestions from audio features
