-- Adds tags to posts (e.g. {javascript,web-dev}) and an index to filter posts by tag.
-- Safe to run more than once.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS posts_tags_idx ON posts USING GIN (tags);
