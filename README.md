# Music Tag Extension

Smart tagging and AI curation for music streaming services.

## Project structure

- `backend/`: Node.js + TypeScript API for Spotify auth, library sync, tagging, and command → queue building.
- `mobile/`: React Native (Expo) app that connects to the backend, lets users tag tracks, run text commands, and (eventually) control Spotify playback.

## Backend: getting started

1. **Start Postgres**
   - Ensure Docker is installed, then from the project root:
     - `docker compose up -d db`
2. **Configure environment**
   - Copy `backend/.env.example` to `backend/.env` and fill in:
     - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
     - `JWT_SECRET`
     - `DATABASE_URL` (matches the `docker-compose.yml` default by default)
3. **Install dependencies and run migrations**
   - `cd backend`
   - `npm install`
   - `npm run db:migrate`
4. **Run the backend**
   - `npm run dev`
   - Check `http://localhost:3000/health` → `{ "status": "ok" }`

## Mobile app: getting started

1. **Install dependencies**
   - `cd mobile`
   - `npm install`
2. **Configure API base URL**
   - Set `EXPO_PUBLIC_API_BASE_URL` in an `.env` or Expo config to point to your backend, e.g. `http://localhost:3000`.
3. **Run the app**
   - `npm start` (Expo) and open on iOS/Android emulator or device.
4. **Next steps**
   - Wire real auth state (store the JWT from `/auth/callback` instead of the temporary placeholders).
   - Integrate Spotify’s mobile SDK in `PlayerScreen` to actually play the URIs returned by `/commands/run`.

