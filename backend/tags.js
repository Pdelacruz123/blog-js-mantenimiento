// Normalizes the tags sent with a post: "#JavaScript, web dev" -> ['javascript', 'web-dev'].
// Lowercase, letters/digits/_/- only (accents allowed), max 24 chars each, no duplicates, max 5.
// Returns undefined when nothing was sent, so an update can keep the existing tags.
const MAX_TAGS = 5;

function parseTags(raw) {
    if (raw === undefined) return undefined;
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const tags = [];
    for (const item of list) {
        const tag = String(item).toLowerCase().trim()
            .replace(/^#+/, '')
            .replace(/[^\p{L}\p{N}_-]+/gu, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 24);
        if (tag && !tags.includes(tag)) tags.push(tag);
    }
    return tags.slice(0, MAX_TAGS);
}

// Text of a rich-text (HTML) post, used to reject posts that are empty once the formatting is removed
function plainText(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}

module.exports = { parseTags, plainText };
