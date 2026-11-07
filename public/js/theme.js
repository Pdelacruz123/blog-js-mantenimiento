// Shared appearance for the themed pages: applies the saved (or system) theme and color palette
// before first paint, then adds the floating palette / dark mode picker. Load it in <head>.
(function() {
    var root = document.documentElement;
    var ACCENTS = ['indigo', 'rose', 'emerald', 'amber', 'ocean'];

    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function store(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    root.setAttribute('data-theme', read('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    root.setAttribute('data-accent', read('accent') || 'indigo');

    document.addEventListener('DOMContentLoaded', function() {
        var picker = document.createElement('div');
        picker.className = 'style-picker';
        picker.setAttribute('role', 'toolbar');
        picker.setAttribute('aria-label', 'Appearance');
        picker.innerHTML = ACCENTS.map(function(accent) {
            var name = accent.charAt(0).toUpperCase() + accent.slice(1);
            return '<button type="button" class="swatch" data-accent="' + accent + '" title="' + name +
                '" aria-label="' + name + ' palette"></button>';
        }).join('') +
            '<span class="picker-divider"></span>' +
            '<button type="button" class="theme-toggle" title="Toggle dark mode" aria-label="Toggle dark mode">' +
            '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
            '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
            '</button>';
        document.body.insertBefore(picker, document.body.firstChild);

        function markActiveAccent() {
            var current = root.getAttribute('data-accent');
            picker.querySelectorAll('.swatch').forEach(function(swatch) {
                swatch.setAttribute('aria-pressed', swatch.getAttribute('data-accent') === current);
            });
        }
        markActiveAccent();

        picker.addEventListener('click', function(e) {
            var swatch = e.target.closest('.swatch');
            if (swatch) {
                var accent = swatch.getAttribute('data-accent');
                root.setAttribute('data-accent', accent);
                store('accent', accent);
                markActiveAccent();
                return;
            }
            if (e.target.closest('.theme-toggle')) {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                root.setAttribute('data-theme', next);
                store('theme', next);
            }
        });
    });
})();
