DROP INDEX IF EXISTS idx_users_friend_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code_ci
    ON users (upper(friend_code))
    WHERE friend_code IS NOT NULL;
