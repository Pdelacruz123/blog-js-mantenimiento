-- Adds profile fields, post images and comment ratings to an existing database.
-- Safe to run more than once.

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS rating SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'comments_rating_check'
    ) THEN
        ALTER TABLE comments
            ADD CONSTRAINT comments_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));
    END IF;
END $$;
