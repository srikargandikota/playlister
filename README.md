# 🎵 Spotify Music Tagger

**Tag your library once. Then just type what you're in the mood for.**

A full-stack mobile app (React Native + Node/TypeScript + Postgres) that replaces static playlists with on-demand setlists built from your own tags.

## The problem

Playlists rot. You make "study vibes" in September and by December it doesn't match how you actually listen. The real unit of curation isn't the playlist — it's the *tag*: `chill`, `hype`, `late-night`, `focus`. Spotify doesn't let you tag tracks, so this app does.

**The core interaction:** type a command like

```
play chill study        → tracks tagged chill AND study
queue any hype workout  → tracks tagged hype OR workout
```

and get a freshly built queue every time.

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

1. **Auth** — Spotify OAuth with PKCE; the backend exchanges the code, stores tokens, and issues its own JWT to the app.
2. **Sync** — pulls your liked tracks into Postgres. Sync is idempotent: `ON CONFLICT` upserts mean repeat runs never duplicate your library, and token refresh is handled automatically when access tokens are within 60s of expiry.
3. **Tag** — create tags (mood / genre / custom) and attach them to tracks from the mobile app.
4. **Command → query** — a small grammar parser turns variable-length commands into a single parameterized SQL query. `AND` mode uses a `HAVING COUNT(DISTINCT tag) = n` aggregate; `OR` mode relaxes it. All user input is bound as parameters — no string-built SQL.

## Product decisions worth noting

- **Commands over UI filters.** Typing `play chill study` is faster than tapping through filter menus, and it maps to how people describe music to themselves.
- **Tags are per-user, tracks are global.** Track metadata is deduplicated across users; tagging is personal. This keeps the schema clean and sync cheap.
- **MVP honesty.** The parser has a fixed result limit and sync fetches the first page — both marked as MVP in code with a clear path to pagination and richer grammar (durations, counts).

## Project structure

- [`backend/`](backend/) — Express API: auth, sync, tagging, command → queue building
- [`mobile/`](mobile/) — Expo app: auth, library, track detail, command, and player screens

## Running it locally

<details>
<summary>Backend setup</summary>

1. **Start Postgres** — `docker compose up -d db`
2. **Configure env** — copy `backend/.env.example` to `backend/.env` and set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `JWT_SECRET`, `DATABASE_URL`
3. **Install + migrate** — `cd backend && npm install && npm run db:migrate`
4. **Run** — `npm run dev`, then check `http://localhost:3000/health`

</details>

<details>
<summary>Mobile setup</summary>

1. `cd mobile && npm install`
2. Set `EXPO_PUBLIC_API_BASE_URL` to your backend (e.g. `http://localhost:3000`)
3. `npm start` and open in an iOS/Android emulator or device

</details>

## Roadmap

- [ ] Full-library sync with pagination (currently first page)
- [ ] Spotify mobile SDK playback in `PlayerScreen` (queue building works; in-app playback is next)
- [ ] Richer command grammar: `play chill for 45 minutes`, `queue 20 hype`
- [ ] Smart tag suggestions from audio features
