-- Database schema for music-tagger backend.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  country TEXT,
  product TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spotify_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  artists TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER NOT NULL,
  explicit BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  liked BOOLEAN DEFAULT TRUE,
  play_count INTEGER DEFAULT 0,
  last_played_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- mood, genre, custom
  color TEXT,
  icon TEXT,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS track_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  weight NUMERIC,
  UNIQUE (user_id, track_id, tag_id)
);

