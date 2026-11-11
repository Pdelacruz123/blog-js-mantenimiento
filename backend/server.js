require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseTags, plainText } = require('./tags');

const app = express();
const port = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware setup
app.use(cors());
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('../public')); // Ensure 'public' is in the root directory

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// ---------------------------------------------------------------------------
// File uploads (post images and profile pictures)
// ---------------------------------------------------------------------------
const UPLOADS_ROOT = path.join(__dirname, 'uploads');
const POSTS_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'posts');
const AVATARS_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'avatars');
[UPLOADS_ROOT, POSTS_UPLOAD_DIR, AVATARS_UPLOAD_DIR].forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_ROOT));

const imageFileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
};

const makeStorage = (destination) => multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    }
});

const uploadPostImage = multer({
    storage: makeStorage(POSTS_UPLOAD_DIR),
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadAvatar = multer({
    storage: makeStorage(AVATARS_UPLOAD_DIR),
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Turn multer errors (bad file type, too large, ...) into a clean 400 response
// instead of the default 500/HTML error page.
const handleUpload = (uploadMiddleware) => (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
};

// Delete a file previously saved under /uploads (e.g. a replaced post image); ignore it if already gone
function removeUploadedFile(publicPath) {
    if (!publicPath || !publicPath.startsWith('/uploads/')) return;
    const filePath = path.resolve(__dirname, '.' + publicPath);
    if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) return;
    fs.unlink(filePath, () => {});
}

// User registration route
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Check if the username already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        // Hash the password and store the new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        // Generate a JWT token
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

        // Return token and userId to client
        res.status(201).json({ message: 'User registered successfully', token, userId: user.id });
    } catch (err) {
        console.error("Error in registration:", err);
        res.status(500).json({ message: 'Server error' });
    }
});


// User login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate a JWT token and include the user ID
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user.id }); // Send both token and userId
    } catch (err) {
        console.error("Error in login:", err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const PROFILE_COLUMNS = 'id, username, profile_picture, birth_date, gender, description, location, occupation, website';

// Get the logged-in user's profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`,
            [req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update the logged-in user's profile (bio fields + optional profile picture)
app.put('/api/profile', authenticateToken, handleUpload(uploadAvatar.single('profile_picture')), async (req, res) => {
    const { birth_date, gender, description } = req.body;
    const location = String(req.body.location || '').trim();
    const occupation = String(req.body.occupation || '').trim();
    const website = String(req.body.website || '').trim();

    const allowedGenders = ['female', 'male', 'other', 'prefer_not_to_say', ''];
    if (gender !== undefined && !allowedGenders.includes(gender)) {
        return res.status(400).json({ message: 'Invalid gender value' });
    }
    if (location.length > 100 || occupation.length > 100) {
        return res.status(400).json({ message: 'Location and occupation must be at most 100 characters' });
    }
    // Only http(s) links: the website is rendered as a link on the public profile (no javascript: URLs)
    if (website && (website.length > 255 || !/^https?:\/\/[^\s/"'<>]+\.[^\s"'<>]+$/i.test(website))) {
        return res.status(400).json({ message: 'Website must be a valid http:// or https:// address' });
    }

    try {
        const profilePicturePath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

        const result = await pool.query(
            `UPDATE users
             SET birth_date = $1,
                 gender = $2,
                 description = $3,
                 profile_picture = COALESCE($4, profile_picture),
                 location = $5,
                 occupation = $6,
                 website = $7
             WHERE id = $8
             RETURNING ${PROFILE_COLUMNS}`,
            [birth_date || null, gender || null, description || null, profilePicturePath,
             location || null, occupation || null, website || null, req.user.userId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: 'Server error while updating profile', error: err.message });
    }
});

// Public profile of any user. Exposes the age instead of the exact birth date, and never the password hash.
app.get('/api/users/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid user id' });
    try {
        const result = await pool.query(`
            SELECT users.id, users.username, users.profile_picture, users.gender, users.description,
                   users.location, users.occupation, users.website,
                   DATE_PART('year', AGE(users.birth_date))::int AS age,
                   (SELECT COUNT(*) FROM posts WHERE posts.author_id = users.id)::int AS post_count,
                   (SELECT COUNT(*) FROM comments WHERE comments.author_id = users.id)::int AS comment_count,
                   (SELECT ROUND(AVG(comments.rating), 1)
                      FROM comments JOIN posts ON comments.post_id = posts.id
                     WHERE posts.author_id = users.id AND comments.rating IS NOT NULL) AS avg_rating
            FROM users
            WHERE users.id = $1
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = result.rows[0];
        user.avg_rating = user.avg_rating === null ? null : Number(user.avg_rating);
        res.json(user);
    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new post (optionally with an image)
// content is the HTML from the rich-text editor; the browser sanitizes it (DOMPurify) when rendering.
app.post('/api/posts', authenticateToken, handleUpload(uploadPostImage.single('image')), async (req, res) => {
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;
    if (!title || !title.trim() || !plainText(content)) {
        removeUploadedFile(imageUrl);
        return res.status(400).json({ message: 'Title and content are required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO posts (title, content, author_id, image_url, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title.trim(), content.trim(), req.user.userId, imageUrl, parseTags(req.body.tags) || []]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error creating post:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Post fields returned by the API, with author info and per-post comment/rating stats
const POST_COLUMNS = `
    posts.id, posts.title, posts.content, posts.image_url, posts.tags, posts.created_at, posts.author_id,
    users.username AS author, users.profile_picture AS author_picture,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id)::int AS comment_count,
    (SELECT COUNT(rating) FROM comments WHERE comments.post_id = posts.id)::int AS rating_count,
    (SELECT ROUND(AVG(rating), 1) FROM comments WHERE comments.post_id = posts.id)::float AS avg_rating`;

const POST_SORTS = {
    new: 'posts.created_at DESC, posts.id DESC',
    top: 'avg_rating DESC NULLS LAST, rating_count DESC, posts.created_at DESC',
    comments: 'comment_count DESC, posts.created_at DESC',
};

// Get posts with author name and profile picture, newest first.
// Optional query params: q (search in title, content, author and tags), author (user id), tag,
// limit/offset (pagination), sort (new | top | comments).
// The total number of matching posts is returned in the X-Total-Count header.
app.get('/api/posts', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = String(req.query.q || '').trim();
    const orderBy = POST_SORTS[req.query.sort] || POST_SORTS.new;

    const conditions = [];
    const params = [];
    if (search) {
        // Escape LIKE wildcards so "%" or "_" typed by the user are matched literally
        params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
        // Content is HTML: search only its text, so words like "strong" don't match every formatted post
        conditions.push(`(posts.title ILIKE $${params.length}
            OR regexp_replace(posts.content, '<[^>]*>', ' ', 'g') ILIKE $${params.length}
            OR users.username ILIKE $${params.length}
            OR array_to_string(posts.tags, ' ') ILIKE $${params.length})`);
    }
    if (req.query.author !== undefined) {
        const authorId = Number(req.query.author);
        if (!Number.isInteger(authorId)) return res.status(400).json({ message: 'Invalid author id' });
        params.push(authorId);
        conditions.push(`posts.author_id = $${params.length}`);
    }
    const tag = (parseTags(req.query.tag) || [])[0];
    if (tag) {
        params.push(tag);
        conditions.push(`$${params.length} = ANY(posts.tags)`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM posts JOIN users ON posts.author_id = users.id ${where}`, params
        );
        const result = await pool.query(`
            SELECT ${POST_COLUMNS}
            FROM posts
            JOIN users ON posts.author_id = users.id
            ${where}
            ORDER BY ${orderBy}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset]);
        res.set('X-Total-Count', countResult.rows[0].total);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching posts:", err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Most used tags, with how many posts have each one
app.get('/api/tags', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT tag, COUNT(*)::int AS count
            FROM posts, unnest(posts.tags) AS tag
            GROUP BY tag
            ORDER BY count DESC, tag
            LIMIT 12
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching tags:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single post by ID
app.get('/api/posts/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ${POST_COLUMNS}
            FROM posts
            JOIN users ON posts.author_id = users.id
            WHERE posts.id = $1
        `, [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching post:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a post by ID: title, content and optionally its image.
// Accepts JSON or multipart; send a new "image" file to replace it, or remove_image=true to drop it.
app.put('/api/posts/:id', authenticateToken, handleUpload(uploadPostImage.single('image')), async (req, res) => {
    const { title, content } = req.body;
    const removeImage = req.body.remove_image === true || req.body.remove_image === 'true';
    const newImageUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;

    if (!title || !title.trim() || !plainText(content)) {
        removeUploadedFile(newImageUrl);
        return res.status(400).json({ message: 'Title and content are required' });
    }

    try {
        const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
        if (postResult.rows.length === 0) {
            removeUploadedFile(newImageUrl);
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = postResult.rows[0];
        if (post.author_id !== req.user.userId) {
            removeUploadedFile(newImageUrl);
            return res.status(403).json({ message: 'You are not authorized to edit this post' });
        }

        const imageUrl = newImageUrl || (removeImage ? null : post.image_url);
        const tags = parseTags(req.body.tags) || post.tags; // tags not sent: keep the current ones
        const result = await pool.query(
            'UPDATE posts SET title = $1, content = $2, image_url = $3, tags = $4 WHERE id = $5 RETURNING *',
            [title.trim(), content.trim(), imageUrl, tags, req.params.id]
        );

        // The old image is no longer referenced once it was replaced or removed
        if (post.image_url && post.image_url !== imageUrl) removeUploadedFile(post.image_url);

        res.json(result.rows[0]);
    } catch (err) {
        removeUploadedFile(newImageUrl);
        console.error("Error updating post:", err);
        res.status(500).json({ message: 'Server error while updating post', error: err.message });
    }
});

// Delete a post by ID
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
        if (postResult.rows.length === 0) return res.status(404).json({ message: 'Post not found' });

        const post = postResult.rows[0];
        if (post.author_id !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this post' });
        }

        await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
        removeUploadedFile(post.image_url);
        res.json({ message: 'Post deleted successfully' });
    } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).json({ message: 'Server error while deleting post', error: err.message });
    }
});

// Get all comments for a post, with author name, profile picture and rating
app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT comments.id, comments.content, comments.rating, comments.created_at, comments.author_id,
                   users.username AS author, users.profile_picture AS author_picture
            FROM comments
            JOIN users ON comments.author_id = users.id
            WHERE comments.post_id = $1
            ORDER BY comments.created_at ASC
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching comments:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a comment to a post, with an optional 1-5 star rating
app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
    const { content } = req.body;
    let { rating } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment content is required' });
    }

    if (rating !== undefined && rating !== null && rating !== '') {
        rating = Number(rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
        }
    } else {
        rating = null;
    }

    try {
        const postResult = await pool.query('SELECT id, title, author_id FROM posts WHERE id = $1', [req.params.id]);
        if (postResult.rows.length === 0) return res.status(404).json({ message: 'Post not found' });
        const post = postResult.rows[0];

        const result = await pool.query(
            'INSERT INTO comments (content, post_id, author_id, rating) VALUES ($1, $2, $3, $4) RETURNING *',
            [content.trim(), req.params.id, req.user.userId, rating]
        );

        const comment = result.rows[0];
        const userResult = await pool.query('SELECT username, profile_picture FROM users WHERE id = $1', [req.user.userId]);
        comment.author = userResult.rows[0]?.username;
        comment.author_picture = userResult.rows[0]?.profile_picture;

        if (post.author_id !== req.user.userId) {
            pushNotification(post.author_id, {
                id: comment.id, content: comment.content, rating: comment.rating, created_at: comment.created_at,
                post_id: post.id, post_title: post.title,
                actor_id: req.user.userId, actor: comment.author, actor_picture: comment.author_picture, unread: true,
            });
        }

        res.status(201).json(comment);
    } catch (err) {
        console.error("Error creating comment:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a comment by ID
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
    try {
        const commentResult = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
        if (commentResult.rows.length === 0) return res.status(404).json({ message: 'Comment not found' });

        const comment = commentResult.rows[0];
        if (comment.author_id !== req.user.userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this comment' });
        }

        await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
        console.error("Error deleting comment:", err);
        res.status(500).json({ message: 'Server error while deleting comment', error: err.message });
    }
});

// ---------------------------------------------------------------------------
// In-app notifications: other users' comments on your posts.
// Read straight from the comments table; users.notifications_seen_at marks what is unread.
// Open pages also receive new ones live through Server-Sent Events.
// ---------------------------------------------------------------------------
const notificationStreams = new Map(); // userId -> Set of open SSE responses

function pushNotification(userId, notification) {
    for (const stream of notificationStreams.get(userId) || []) {
        stream.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
}

// Latest 20 comments by other users on my posts, plus how many are newer than my notifications_seen_at
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const items = await pool.query(`
            SELECT comments.id, comments.content, comments.rating, comments.created_at,
                   posts.id AS post_id, posts.title AS post_title,
                   actor.id AS actor_id, actor.username AS actor, actor.profile_picture AS actor_picture,
                   comments.created_at > me.notifications_seen_at AS unread
            FROM comments
            JOIN posts ON comments.post_id = posts.id
            JOIN users actor ON comments.author_id = actor.id
            JOIN users me ON posts.author_id = me.id
            WHERE posts.author_id = $1 AND comments.author_id <> $1
            ORDER BY comments.created_at DESC
            LIMIT 20
        `, [req.user.userId]);
        const unread = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM comments
            JOIN posts ON comments.post_id = posts.id
            JOIN users me ON posts.author_id = me.id
            WHERE posts.author_id = $1 AND comments.author_id <> $1
              AND comments.created_at > me.notifications_seen_at
        `, [req.user.userId]);
        res.json({ unread: unread.rows[0].count, items: items.rows });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark every notification as read
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE users SET notifications_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [req.user.userId]);
        res.json({ unread: 0 });
    } catch (err) {
        console.error("Error marking notifications as read:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Live stream. EventSource cannot send headers, so the JWT comes in the query string.
app.get('/api/notifications/stream', (req, res) => {
    let user;
    try {
        user = jwt.verify(String(req.query.token || ''), JWT_SECRET);
    } catch (err) {
        return res.status(401).end();
    }

    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.flushHeaders();
    res.write(': connected\n\n');

    if (!notificationStreams.has(user.userId)) notificationStreams.set(user.userId, new Set());
    const streams = notificationStreams.get(user.userId);
    streams.add(res);

    // Comment lines keep proxies and the browser from closing an idle connection
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
        clearInterval(keepAlive);
        streams.delete(res);
        if (streams.size === 0) notificationStreams.delete(user.userId);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
