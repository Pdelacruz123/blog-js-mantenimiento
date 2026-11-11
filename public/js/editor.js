// Rich-text editor (Quill) and tag input, shared by create-post.html and the edit dialog in index.html.
// Needs jQuery, Quill and common.js.

const EDITOR_TOOLBAR = [
    [{ header: [1, 2, 3, false] }, { size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }],
    ['blockquote', 'code-block', 'link'],
    ['clean'],
];

// counter: optional element that shows "N words · M min read" while typing
function createEditor(selector, counter) {
    const quill = new Quill(selector, {
        theme: 'snow',
        placeholder: 'Write your post... select text to format it',
        modules: { toolbar: EDITOR_TOOLBAR },
    });

    function updateCounter() {
        if (!counter) return;
        const words = quill.getText().split(/\s+/).filter(Boolean).length;
        $(counter).text(words ? `${words} word${words === 1 ? '' : 's'} · ${readingTime(quill.getText())}` : '');
    }
    quill.on('text-change', updateCounter);
    updateCounter();

    return {
        quill,
        isEmpty: () => quill.getText().trim() === '',
        getHtml: () => quill.root.innerHTML,
        setContent(content) {
            if (isRichText(content)) quill.setContents(quill.clipboard.convert({ html: content }));
            else quill.setText(content || '');
            quill.history.clear();
            updateCounter();
        },
    };
}

// Same rules as the server (backend/tags.js): "#Web Dev" -> "web-dev"
const MAX_TAGS = 5;
function normalizeTag(raw) {
    return String(raw).toLowerCase().trim()
        .replace(/^#+/, '')
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24);
}

// box: a .tag-input element containing an <input>. Enter or comma adds a tag, Backspace removes the last one.
function createTagInput(box) {
    const $box = $(box);
    const $input = $box.find('input');
    let tags = [];

    function render() {
        $box.find('.tag-chip').remove();
        tags.forEach(tag => $input.before(
            `<span class="tag-chip">#${esc(tag)}<button type="button" data-tag="${esc(tag)}" aria-label="Remove tag ${esc(tag)}">&times;</button></span>`
        ));
        $input.attr('placeholder', tags.length >= MAX_TAGS ? 'Max. 5 tags' : (tags.length ? 'Add another...' : 'e.g. javascript, travel, music'));
    }

    function addFromInput() {
        $input.val().split(',').map(normalizeTag).forEach(tag => {
            if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) tags.push(tag);
        });
        $input.val('');
        render();
    }

    $input.on('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFromInput();
        } else if (e.key === 'Backspace' && !$input.val() && tags.length) {
            tags.pop();
            render();
        }
    }).on('blur', addFromInput);

    $box.on('click', 'button', function() {
        const tag = $(this).attr('data-tag');
        tags = tags.filter(t => t !== tag);
        render();
        $input.trigger('focus');
    });
    $box.on('click', function(e) {
        if (e.target === box || e.target === $box[0]) $input.trigger('focus');
    });

    // Offer the popular tags as suggestions
    const list = $input.attr('list');
    if (list) {
        $.get('/api/tags', rows => $('#' + list).html(rows.map(r => `<option value="${esc(r.tag)}">`).join('')));
    }

    render();
    return {
        get() { addFromInput(); return tags.slice(); },
        set(next) { tags = (next || []).slice(0, MAX_TAGS); render(); },
    };
}
