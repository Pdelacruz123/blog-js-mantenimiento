// Rendering helpers shared by the feed (index.html) and the public profile (profile.html).

// Escape user-provided text before injecting it into HTML (quotes too, so it is safe inside attributes)
function esc(s) {
    return $('<div>').text(s == null ? '' : s).html().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Shareable link to a single post
function postUrl(postId) {
    return new URL(`index.html?post=${encodeURIComponent(postId)}`, location.href).href;
}

// "★ 4.3 (3)" for a post's average rating, or '' when nobody rated it
function ratingSummary(post) {
    return post.avg_rating === null ? '' :
        `<span class="star">&#9733;</span> ${post.avg_rating.toFixed(1)} <span class="muted">(${post.rating_count})</span>`;
}

// Escape text and wrap every case-insensitive match of `query` in <mark>.
// Splits the raw text first so a match can never cut through an HTML entity.
function highlight(text, query) {
    if (!query) return esc(text);
    const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text == null ? '' : text)
        .split(pattern)
        .map((part, i) => i % 2 ? `<mark class="hl">${esc(part)}</mark>` : esc(part))
        .join('');
}

function profileUrl(userId) {
    return `profile.html?id=${encodeURIComponent(userId)}`;
}

// Deterministic avatar color and initial from a username, or the user's own photo if set.
// size: '' (40px), 'sm' (32px) or 'xl' (112px)
const avatarColors = ['#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#2563eb', '#ca8a04'];
function avatar(name, pictureUrl, size) {
    const label = String(name || '?');
    const cls = `avatar${size ? ' ' + size : ''}`;
    if (pictureUrl) {
        return `<img class="${cls}" src="${esc(pictureUrl)}" alt="${esc(label)}">`;
    }
    let hash = 0;
    for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `<div class="${cls}" style="background:${avatarColors[hash % avatarColors.length]}">${esc(label.charAt(0).toUpperCase())}</div>`;
}

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, size] of units) {
        const n = Math.floor(seconds / size);
        if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
}
