// In-app notifications: a bell in the appearance toolbar listing the latest comments on your posts,
// updated live over Server-Sent Events, with a toast for each new one. Needs jQuery, common.js and theme.js.
$(function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    let items = [];
    let unread = 0;

    const bell = $(`
        <button type="button" class="bell-btn" title="Notifications" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            <span class="bell-badge" hidden></span>
        </button>`);
    const panel = $('<div class="notif-panel" role="region" aria-label="Notifications" hidden></div>');
    $('.style-picker').prepend(bell, '<span class="picker-divider"></span>');
    $('body').append(panel, '<div class="notif-toasts" aria-live="polite"></div>');

    function itemHtml(n) {
        return `
            <a class="notif-item${n.unread ? ' unread' : ''}" href="${esc(postUrl(n.post_id))}">
                ${avatar(n.actor, n.actor_picture, 'sm')}
                <div class="notif-body">
                    <div><b>${esc(n.actor)}</b> commented on <b>${esc(n.post_title)}</b>${n.rating ? ` &middot; <span class="star">&#9733;</span> ${n.rating}` : ''}</div>
                    <div class="notif-text">${esc(n.content)}</div>
                    <div class="notif-time">${timeAgo(n.created_at)}</div>
                </div>
            </a>`;
    }

    function render() {
        bell.find('.bell-badge').text(unread > 9 ? '9+' : unread).prop('hidden', unread === 0);
        panel.html(`<div class="notif-head">Notifications</div>` +
            (items.length ? items.map(itemHtml).join('') : '<p class="notif-empty">No comments on your posts yet.</p>'));
    }

    function setOpen(open) {
        panel.prop('hidden', !open);
        bell.attr('aria-expanded', open);
        if (open && unread > 0) {
            unread = 0;
            render(); // the highlighted items stay highlighted while the panel is open
            $.ajax({ url: '/api/notifications/read', type: 'POST', headers: headers });
        } else if (!open) {
            items.forEach(n => { n.unread = false; });
            render();
        }
    }

    function toast(n) {
        const el = $(`<div class="notif-toast">${itemHtml({ ...n, unread: false })}</div>`).appendTo('.notif-toasts');
        setTimeout(() => el.fadeOut(300, () => el.remove()), 6000);
    }

    bell.on('click', function(e) {
        e.stopPropagation();
        setOpen(panel.prop('hidden'));
    });
    $(document).on('click', function(e) {
        if (!panel.prop('hidden') && !$(e.target).closest('.notif-panel').length) setOpen(false);
    }).on('keydown', function(e) {
        if (e.key === 'Escape' && !panel.prop('hidden')) setOpen(false);
    });

    $.ajax({
        url: '/api/notifications',
        headers: headers,
        success: function(data) {
            items = data.items;
            unread = data.unread;
            render();
        }
    });

    // Live updates: the server pushes each new comment on one of my posts
    const stream = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    stream.onmessage = function(e) {
        const n = JSON.parse(e.data);
        items = [n, ...items].slice(0, 20);
        unread++;
        render();
        if (!panel.prop('hidden')) setOpen(true); // already looking at the list: mark it read right away
        toast(n);
    };
    render();
});
