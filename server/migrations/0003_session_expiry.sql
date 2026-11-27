-- Expired sessions are swept when a new session is created; the index keeps
-- that sweep cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);
