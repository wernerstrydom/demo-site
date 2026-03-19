/*
 * enhance.js — Progressive Enhancement Layer
 *
 * This script is entirely optional. The site must be 100% functional without it.
 * All features are gated behind explicit capability checks.
 *
 * Compatible with: IE 6+, Firefox 2+, and all modern browsers.
 */
(function () {
    'use strict';

    function supports(feature) {
        var tests = {
            querySelectorAll: typeof document.querySelectorAll !== 'undefined',
            addEventListener:  typeof document.addEventListener !== 'undefined',
            classList:         typeof document.documentElement.classList !== 'undefined',
            localStorage:      (function () { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } }()),
            cssVars:           typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', 'var(--color-bg)'),
            smoothScroll:      'scrollBehavior' in document.documentElement.style
        };
        return tests[feature] || false;
    }

    if (!supports('querySelectorAll') || !supports('addEventListener')) { return; }

    function initTheme() {
        if (!supports('cssVars') || !supports('localStorage')) { return; }
        var saved = localStorage.getItem('theme');
        if (saved === 'dark' || saved === 'light') {
            document.documentElement.setAttribute('data-theme', saved);
        }
        var btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle dark/light theme');
        btn.innerHTML = 'Toggle Theme';
        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme');
            var next;
            if (current === 'dark') { next = 'light'; }
            else if (current === 'light') { next = 'dark'; }
            else { next = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark'; }
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
        document.body.appendChild(btn);
    }

    function initBackToTop() {
        if (!supports('cssVars')) { return; }
        var btn = document.createElement('button');
        btn.id = 'back-to-top';
        btn.setAttribute('aria-label', 'Back to top of page');
        btn.innerHTML = '&#8679; Top';
        btn.addEventListener('click', function () {
            if (supports('smoothScroll')) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
            else { window.scrollTo(0, 0); }
        });
        window.addEventListener('scroll', function () {
            btn.style.opacity = (window.pageYOffset > 400) ? '1' : '0';
        });
        document.body.appendChild(btn);
    }

    function enhanceExternalLinks() {
        var links = document.querySelectorAll('a[href]');
        var host = window.location.hostname;
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href') || '';
            if (/^https?:\/\//i.test(href) && href.indexOf(host) === -1) {
                link.setAttribute('rel', 'noopener noreferrer');
                link.setAttribute('target', '_blank');
                if (supports('classList')) { link.classList.add('external-link'); }
            }
        }
    }

    function enhancePrint() {
        window.addEventListener('beforeprint', function () {
            var details = document.querySelectorAll('details');
            for (var i = 0; i < details.length; i++) { details[i].setAttribute('open', 'open'); }
        });
    }

    function markCurrentPage() {
        var path = window.location.pathname;
        var filename = path.split('/').pop() || 'index.html';
        var links = document.querySelectorAll('.site-nav a');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            if (href === filename || (filename === '' && href === 'index.html')) {
                if (supports('classList')) { links[i].classList.add('current'); }
                links[i].setAttribute('aria-current', 'page');
            }
        }
    }

    function init() {
        markCurrentPage();
        enhanceExternalLinks();
        enhancePrint();
        initTheme();
        initBackToTop();
        if (typeof console !== 'undefined' && console.log) { console.log('Progressive enhancements active.'); }
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
}());
