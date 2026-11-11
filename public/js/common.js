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

// ---------------------------------------------------------------------------
// Post content: HTML from the rich-text editor, or plain text for posts written before it existed
// ---------------------------------------------------------------------------
function isRichText(content) {
    return /^\s*<(p|h[1-6]|ol|ul|blockquote|pre|div)[\s>]/i.test(content || '');
}

// Text only, one line per paragraph (for excerpts, share captions and reading time). Parsing into an
// inert document never runs scripts or loads images.
function plainText(content) {
    if (!isRichText(content)) return String(content || '');
    const html = content.replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, '$&\n');
    return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
}

function readingTime(content) {
    const words = plainText(content).split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.round(words / 200))} min read`;
}

// Safe HTML for a post body. Requires DOMPurify on pages that render rich posts.
// Wrapped in Quill's classes so sizes, alignment and lists look exactly as in the editor.
function postBodyHtml(content) {
    if (!isRichText(content)) return `<div class="post-body plain">${esc(content)}</div>`;
    return `<div class="ql-snow"><div class="ql-editor post-body">${DOMPurify.sanitize(content, { ALLOWED_TAGS: POST_TAGS })}</div></div>`;
}

// Only what the editor produces: no images, forms or embedded styles from user content
const POST_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'span', 'a', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'blockquote', 'pre', 'code', 'div'];

if (window.DOMPurify) {
    // Keep only the editor's text/background colors from inline styles, so a post can't position or hide things
    DOMPurify.addHook('uponSanitizeAttribute', function(node, data) {
        if (data.attrName === 'style') {
            data.attrValue = data.attrValue.split(';').filter(d => /^\s*(background-)?color\s*:/i.test(d)).join(';');
        }
    });
    DOMPurify.addHook('afterSanitizeAttributes', function(node) {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer nofollow');
        }
    });
}

// Wrap search matches inside already-rendered content (works for rich HTML, where highlight() can't be used)
function highlightIn(root, query) {
    if (!query) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        const html = highlight(node.nodeValue, query);
        if (!html.includes('<mark')) return;
        const holder = document.createElement('span');
        holder.innerHTML = html;
        node.replaceWith(...holder.childNodes);
    });
}

// "#tag" chips; links open the feed filtered by that tag
function tagChips(tags, asLinks) {
    if (!tags || !tags.length) return '';
    return `<div class="tag-list">${tags.map(tag => asLinks
        ? `<a class="tag-chip" href="index.html?tag=${encodeURIComponent(tag)}" data-tag="${esc(tag)}">#${esc(tag)}</a>`
        : `<span class="tag-chip">#${esc(tag)}</span>`).join('')}</div>`;
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
