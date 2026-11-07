-- Adds three more profile fields and the "last seen notifications" mark.
-- Safe to run more than once.

ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Comments on your posts newer than this are unread notifications.
-- Existing users start "up to date" instead of getting every old comment as unread.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
