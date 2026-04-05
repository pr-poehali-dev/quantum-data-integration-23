CREATE TABLE IF NOT EXISTS reel_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES reel_users(id),
    title VARCHAR(255),
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES reel_users(id),
    video_id INTEGER REFERENCES reel_videos(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS reel_comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES reel_users(id),
    video_id INTEGER REFERENCES reel_videos(id),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES reel_users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);