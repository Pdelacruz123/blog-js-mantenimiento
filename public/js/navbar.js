// Top menu shared by the main pages: links, a "Tags" dropdown with the popular tags, login/logout,
// and the appearance picker (and notifications bell) from theme.js moved into it.
// Needs jQuery and common.js; load it before notifications.js.
$(function() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const page = location.pathname.split('/').pop() || 'index.html';
    const here = page + location.search;

    const links = [['index.html', 'Home']];
    if (token) {
        links.push(['create-post.html', 'New post'], [profileUrl(userId), 'My profile'], ['edit-profile.html', 'Edit profile']);
    }
    const linksHtml = links.map(([href, label]) => {
        const active = href === here || href === page;
        return `<a href="${esc(href)}" class="nav-item${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
    }).join('');

    const authHtml = token
        ? '<button type="button" class="nav-btn ghost" id="navLogout">Log out</button>'
        : '<a href="login.html" class="nav-btn ghost">Log in</a><a href="register.html" class="nav-btn">Sign up</a>';

    const nav = $(`
        <nav class="topnav" aria-label="Main menu">
            <div class="topnav-inner">
                <a href="index.html" class="brand"><span class="brand-mark">B</span>BlogJS</a>
                <div class="topnav-links" id="topnavLinks">
                    ${linksHtml}
                    <div class="nav-dropdown">
                        <button type="button" class="nav-item" id="navTagsBtn" aria-expanded="false" aria-controls="navTagsMenu">Tags &#9662;</button>
                        <div class="tags-menu" id="navTagsMenu" hidden><p class="tags-menu-empty">Loading...</p></div>
                    </div>
                    <span class="nav-spacer"></span>
                    ${authHtml}
                </div>
                <div class="nav-tools"></div>
                <button type="button" class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="topnavLinks">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
                </button>
            </div>
        </nav>`);
    $('body').prepend(nav);
    nav.find('.nav-tools').append($('.style-picker'));

    nav.on('click', '.nav-toggle', function() {
        const open = !nav.hasClass('open');
        nav.toggleClass('open', open);
        $(this).attr('aria-expanded', open);
    });

    nav.on('click', '#navLogout', function() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        location.href = 'index.html';
    });

    // Tags dropdown, filled the first time it opens
    const menu = $('#navTagsMenu');
    let loaded = false;
    function setMenuOpen(open) {
        menu.prop('hidden', !open);
        $('#navTagsBtn').attr('aria-expanded', open);
        if (!open || loaded) return;
        loaded = true;
        $.get('/api/tags', function(rows) {
            menu.html(rows.length
                ? rows.map(r => `<a href="index.html?tag=${encodeURIComponent(r.tag)}">#${esc(r.tag)} <span>${r.count}</span></a>`).join('')
                : '<p class="tags-menu-empty">No tags yet.</p>');
        }).fail(() => { loaded = false; menu.html('<p class="tags-menu-empty">Could not load tags.</p>'); });
    }
    $('#navTagsBtn').on('click', function(e) {
        e.stopPropagation();
        setMenuOpen(menu.prop('hidden'));
    });
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.nav-dropdown').length) setMenuOpen(false);
    }).on('keydown', function(e) {
        if (e.key === 'Escape') setMenuOpen(false);
    });
});
