CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    username_key    TEXT NOT NULL UNIQUE,
    verifier        TEXT NOT NULL,
    created_at      BIGINT NOT NULL,
    last_login      BIGINT NOT NULL DEFAULT 0,
    total_stamps    BIGINT NOT NULL DEFAULT 0,
    expedition_wins BIGINT NOT NULL DEFAULT 0,
    night_best      BIGINT NOT NULL DEFAULT 0,
    last_active     BIGINT NOT NULL DEFAULT 0,
    friend_code     TEXT,
    garden_harvests BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code
    ON users (friend_code) WHERE friend_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    last_seen  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS login_challenges (
    nonce      TEXT PRIMARY KEY,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenges_expiry ON login_challenges (expires_at);

CREATE TABLE IF NOT EXISTS saves (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   BIGINT NOT NULL,
    payload    TEXT NOT NULL,
    client_ts  BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    payload    TEXT,
    client_ts  BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_id, id);

CREATE TABLE IF NOT EXISTS friend_requests (
    id         BIGSERIAL PRIMARY KEY,
    from_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    UNIQUE (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests (to_id, id);

CREATE TABLE IF NOT EXISTS friendships (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships (user_id, friend_id);

CREATE TABLE IF NOT EXISTS friend_visits (
    visitor_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day        BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (visitor_id, friend_id, day)
);
CREATE INDEX IF NOT EXISTS idx_friend_visits_friend ON friend_visits (friend_id, day);

CREATE TABLE IF NOT EXISTS collectibles (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    template   TEXT NOT NULL,
    edition    BIGINT NOT NULL,
    serial     BIGINT NOT NULL,
    image_key  TEXT NOT NULL,
    minted_at  BIGINT NOT NULL,
    UNIQUE (user_id, kind, template),
    UNIQUE (kind, template, serial)
);
CREATE INDEX IF NOT EXISTS idx_collectibles_user ON collectibles (user_id, kind);

CREATE TABLE IF NOT EXISTS garden_plots (
    owner_id   TEXT NOT NULL,
    plot       BIGINT NOT NULL,
    crop       TEXT NOT NULL,
    planted_at BIGINT NOT NULL,
    ripe_at    BIGINT NOT NULL,
    stolen     BIGINT NOT NULL DEFAULT 0,
    watered    BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (owner_id, plot)
);

CREATE TABLE IF NOT EXISTS garden_steals (
    thief_id   TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    plot       BIGINT NOT NULL,
    day        BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (thief_id, owner_id, plot, day)
);

CREATE TABLE IF NOT EXISTS garden_helps (
    helper_id  TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    plot       BIGINT NOT NULL,
    day        BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (helper_id, owner_id, plot, day)
);

CREATE TABLE IF NOT EXISTS garden_crop_stats (
    user_id  TEXT NOT NULL,
    crop     TEXT NOT NULL,
    harvests BIGINT NOT NULL DEFAULT 0,
    stolen   BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, crop)
);

CREATE TABLE IF NOT EXISTS garden_actions (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    plot       BIGINT NOT NULL,
    action     TEXT NOT NULL,
    crop       TEXT NOT NULL,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_garden_actions_owner ON garden_actions (owner_id, id);

CREATE TABLE IF NOT EXISTS garden_quests (
    user_id       TEXT NOT NULL,
    day           BIGINT NOT NULL,
    crop          TEXT NOT NULL,
    reward_kind   TEXT NOT NULL,
    reward_amount BIGINT NOT NULL,
    claimed_at    BIGINT,
    PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS bots (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    title         TEXT NOT NULL,
    bio           TEXT NOT NULL,
    base_stamps   BIGINT NOT NULL,
    daily_stamps  BIGINT NOT NULL,
    base_wins     BIGINT NOT NULL,
    daily_wins    BIGINT NOT NULL,
    created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS postcards (
    id            BIGSERIAL PRIMARY KEY,
    sender_id     TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    sender_kind   TEXT NOT NULL,
    recipient_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    template      TEXT NOT NULL,
    gift_kind     TEXT,
    gift_amount   BIGINT NOT NULL DEFAULT 0,
    created_at    BIGINT NOT NULL,
    arrives_at    BIGINT NOT NULL,
    claimed_at    BIGINT
);
CREATE INDEX IF NOT EXISTS idx_postcards_recipient ON postcards (recipient_id, id);
CREATE INDEX IF NOT EXISTS idx_postcards_sender ON postcards (sender_id, created_at);

CREATE TABLE IF NOT EXISTS postcard_sends (
    id             BIGSERIAL PRIMARY KEY,
    user_id        TEXT NOT NULL,
    recipient_kind TEXT NOT NULL,
    created_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_postcard_sends_user ON postcard_sends (user_id, created_at);
