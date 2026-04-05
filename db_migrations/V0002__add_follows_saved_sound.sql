CREATE TABLE IF NOT EXISTS reel_follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER REFERENCES reel_users(id),
    following_id INTEGER REFERENCES reel_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS reel_saved (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES reel_users(id),
    video_id INTEGER REFERENCES reel_videos(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

ALTER TABLE reel_videos ADD COLUMN IF NOT EXISTS sound_name VARCHAR(255);
ALTER TABLE reel_videos ADD COLUMN IF NOT EXISTS sound_url TEXT;
ALTER TABLE reel_users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE reel_users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;