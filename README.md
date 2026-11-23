# Playlister

**Tag your library once, and then just type what you are in the mood for.**

Playlister is a full stack mobile app (React Native, Node/TypeScript, and Postgres) that replaces static playlists with on demand setlists built from your own library. It syncs your whole Spotify library, classifies every track by tonality (key, major or minor mode, energy, and mood), and lets you ask for music in plain English. I specced and built it with Claude Code and MCP tooling, and I designed the 4 core screens in Figma before writing any of the app.

## The problem

Playlists go stale, because you make "study vibes" in September and by December it no longer matches how you actually listen. The real unit of curation is the tag rather than the playlist, like `chill`, `hype`, `late-night`, or `focus`, and Spotify does not let you tag tracks. So this app does, and it tags the musical properties for you.

```
play chill study                            → tracks tagged chill AND study
queue any hype workout                      → tracks tagged hype OR workout
queue 20 hype                               → at most 20 hype tracks
play chill for 45 minutes                   → chill tracks, capped at 45 minutes
something melancholy in a minor key, 30 min → free text, mapped onto your tags by Claude
```

## How it works

```
React Native (Expo) app
        │
        ▼
Node + Express + TypeScript API ──── Spotify Web API (OAuth PKCE, full library sync)
        │                       ├─── ReccoBeats API (audio features: key, mode, energy, valence, tempo)
        │                       └─── Anthropic API (optional: free text commands)
        ▼
PostgreSQL (users, tracks, track_features, tags, track_tags)
```

1. **Auth.** Spotify OAuth runs with PKCE. The backend exchanges the code, stores the tokens, and issues its own JWT to the app.
2. **Library sync.** The backend walks every page of your saved tracks through the official Web API (50 per page, honoring `Retry-After` on rate limits) and upserts them in batches of 500 with a single `unnest` statement each. Reruns are idempotent.
3. **Tonality classification.** Spotify closed its Audio Features endpoint to new apps on Nov 27, 2024, so features come from [ReccoBeats](https://reccobeats.com), a free API that accepts Spotify track IDs. Results are mapped back by each item's Spotify link, never by position, so a feature cannot land on the wrong track. Features are stored per track and shared across users, so a track is fetched once. The classifier then derives:
   * the key name (`A minor`) and its Camelot wheel code (`8A`), used for harmonic mixing,
   * an energy band (`low`, `medium`, `high`),
   * a mood from valence and energy (`melancholy`, `bright`, `euphoric`, ...), weighting valence over mode because plenty of upbeat songs are in minor keys.

   These become auto tags (`minor`, `a-minor`, `low-energy`, `melancholy`) that work in commands just like your own tags.
4. **Commands to queries.** A small grammar parser turns typed commands into one parameterized SQL query, where `AND` mode uses a `HAVING COUNT(DISTINCT tag) = n` aggregate and `OR` mode relaxes it. All user input is bound as parameters, so there is no string built SQL anywhere.
5. **Free text (AI).** `POST /commands/ask` sends the request plus the list of tags you actually have to Claude, which returns a JSON filter. The output is validated with zod, and any tag you do not have is dropped, so the model cannot invent a filter that matches nothing. Without an API key, a rule based interpreter maps everyday words (`sad`, `calm`, `upbeat`) onto the auto tags.
6. **Recommendations.**
   * **Songs** (`GET /recommendations/songs?seed=<trackId>`): ranks your library against a seed track by shared tags (Jaccard), harmonic compatibility on the Camelot wheel, and feature similarity (energy, valence, danceability, acousticness, and tempo, with half and double time treated as a match). Each result says why it was picked.
   * **Playlists** (`GET /recommendations/playlists`): proposes playlists from tag pairs that cover enough tracks (for example "Focus + Low Energy"), ordered so neighboring tracks are in compatible keys.
   * **Tags** (`GET /recommendations/tags`): suggests your own tags for untagged tracks with a nearest centroid model over the tracks you already tagged.

## Product decisions worth noting

- **Commands over UI filters.** Typing `play chill study` is faster than tapping through filter menus, and it maps to how people already describe music to themselves.
- **The model only picks from tags that exist.** Grounding the LLM in the user's tag list makes its output checkable and keeps failures visible (`droppedTags`) instead of silently returning an empty queue.
- **Tags are per user, and tracks are global.** Track metadata and audio features are deduplicated across users while tagging stays personal, which keeps the schema clean and the sync cheap.
- **Valence over mode.** Major and minor alone is a weak mood signal, so mood labels lean on valence and energy.
- **Explainable recommendations.** Every recommended song carries its reasons (shared tags, same or compatible key, similar feel), which makes the ranking easy to debug and to trust.

## API

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/tracks/sync/liked` | Full library sync, then classification (`?classify=false` to skip) |
| POST | `/tracks/classify` | Classify tracks that have no features yet and apply auto tags |
| GET | `/tracks/:trackId/tonality` | Key, Camelot code, energy band, mood, and auto tags for one track |
| POST | `/commands/run` | Typed grammar (`play chill study`) |
| POST | `/commands/ask` | Free text request mapped onto your tags |
| GET | `/recommendations/songs` | Songs similar to a seed track |
| GET | `/recommendations/playlists` | Suggested playlists from tag combinations |
| GET | `/recommendations/tags` | Suggested tags for untagged tracks |

## Project structure

- [`backend/`](backend/) holds the Express API: auth, library sync, classification, tagging, commands, and recommendations. Business logic lives in pure functions (`services/tonality.ts`, `services/recommend.ts`, `services/commandService.ts`) so it can be tested without a database.
- [`backend/test/`](backend/test/) has unit tests plus an integration test that runs the real SQL against Postgres.
- [`mobile/`](mobile/) holds the Expo app with auth, library (with sync), track detail (tonality and "more like this"), command, and player screens.

## Running it locally

<details>
<summary>Backend setup</summary>

1. Start Postgres with `docker compose up -d db`.
2. Copy `backend/.env.example` to `backend/.env` and set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `JWT_SECRET`, and `DATABASE_URL`. Set `ANTHROPIC_API_KEY` to enable Claude for free text commands (optional).
3. Install and migrate with `cd backend && npm install && npm run db:migrate`.
4. Run `npm run dev`, then check `http://localhost:3000/health`.

</details>

<details>
<summary>Tests</summary>

* `npm test` runs the unit tests.
* To also run the integration test, migrate a throwaway database and point `TEST_DATABASE_URL` at it: `TEST_DATABASE_URL=postgres://... npm test`. It syncs 1,200 tracks, classifies them (with the features API mocked), and runs commands and recommendations against real SQL.

</details>

<details>
<summary>Mobile setup</summary>

1. Run `cd mobile && npm install`.
2. Set `EXPO_PUBLIC_API_BASE_URL` to your backend, such as `http://localhost:3000`.
3. Run `npm start` and open the app in an iOS or Android emulator or on a device.

</details>

## Roadmap

- [x] Full library sync with pagination
- [x] Tonality classification and auto tags
- [x] Free text commands, counts, and durations (`queue 20 hype`, `play chill for 45 minutes`)
- [x] Song, playlist, and tag recommendations
- [ ] Spotify mobile SDK playback in `PlayerScreen`, because queue building works and in app playback is next
- [ ] Persist the session token with `expo-secure-store` and encrypt stored Spotify refresh tokens
- [ ] Classify tracks ReccoBeats does not cover by analyzing audio directly
