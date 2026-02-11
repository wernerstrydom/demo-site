/*
 * Progressive Enhancement JavaScript
 * This script provides optional enhancements for browsers that support JavaScript.
 * The site remains fully functional without it.
 */

(function() {
    'use strict';
    
    // Feature detection helper
    function supportsFeature(feature) {
        try {
            switch(feature) {
                case 'querySelector':
                    return typeof document.querySelector === 'function';
                case 'addEventListener':
                    return typeof document.addEventListener === 'function';
                case 'classList':
                    return 'classList' in document.documentElement;
                case 'localStorage':
                    return typeof localStorage !== 'undefined';
                case 'smoothScroll':
                    return 'scrollBehavior' in document.documentElement.style;
                default:
                    return false;
            }
        } catch(e) {
            return false;
        }
    }
    
    // Only proceed if basic features are available
    if (!supportsFeature('querySelector') || !supportsFeature('addEventListener')) {
        return;
    }
    
    // Add a class to indicate JavaScript is enabled
    if (supportsFeature('classList')) {
        document.documentElement.classList.add('js-enabled');
    }
    
    // Smooth scrolling for anchor links (if not natively supported)
    if (!supportsFeature('smoothScroll')) {
        var links = document.querySelectorAll('a[href^="#"]');
        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function(e) {
                var target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    smoothScrollTo(target);
                }
            });
        }
    }
    
    function smoothScrollTo(element) {
        var start = window.pageYOffset;
        var target = element.offsetTop;
        var distance = target - start;
        var duration = 500;
        var startTime = null;
        
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            var timeElapsed = currentTime - startTime;
            var progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function
            var ease = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;
            
            window.scrollTo(0, start + distance * ease);
            
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }
        
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(animation);
        } else {
            window.scrollTo(0, target);
        }
    }
    
    // Theme switcher (optional enhancement)
    function initThemeSwitcher() {
        if (!supportsFeature('localStorage')) {
            return;
        }
        
        // Check for saved theme preference
        var savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            applyTheme(savedTheme);
        }
        
        // Create theme toggle button
        var button = document.createElement('button');
        button.textContent = 'Toggle Theme';
        button.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px 15px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-size: 14px; z-index: 1000;';
        
        button.addEventListener('click', function() {
            var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            var newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
        
        // Only add button if CSS custom properties are supported
        if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', 'var(--color-primary)')) {
            document.body.appendChild(button);
        }
    }
    
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // External link indicator
    function markExternalLinks() {
        var links = document.querySelectorAll('a[href^="http"]');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (link.hostname !== window.location.hostname) {
                link.setAttribute('rel', 'noopener noreferrer');
                link.setAttribute('target', '_blank');
                
                // Add visual indicator if classList is supported
                if (supportsFeature('classList')) {
                    link.classList.add('external-link');
                }
            }
        }
    }
    
    // Back to top button
    function initBackToTop() {
        var button = document.createElement('button');
        button.textContent = '↑ Top';
        button.style.cssText = 'position: fixed; bottom: 20px; left: 20px; padding: 10px 15px; background: #2c3e50; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 1000;';
        button.setAttribute('aria-label', 'Back to top');
        
        button.addEventListener('click', function() {
            if (supportsFeature('smoothScroll')) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                smoothScrollTo(document.body);
            }
        });
        
        // Show/hide button based on scroll position
        function toggleButton() {
            if (window.pageYOffset > 300) {
                button.style.opacity = '1';
            } else {
                button.style.opacity = '0';
            }
        }
        
        window.addEventListener('scroll', toggleButton);
        document.body.appendChild(button);
    }
    
    // Form validation enhancement (if forms exist)
    function enhanceForms() {
        var forms = document.querySelectorAll('form');
        for (var i = 0; i < forms.length; i++) {
            forms[i].addEventListener('submit', function(e) {
                var inputs = this.querySelectorAll('input[required], textarea[required]');
                var valid = true;
                
                for (var j = 0; j < inputs.length; j++) {
                    if (!inputs[j].value.trim()) {
                        valid = false;
                        if (supportsFeature('classList')) {
                            inputs[j].classList.add('error');
                        }
                    }
                }
                
                if (!valid) {
                    e.preventDefault();
                    alert('Please fill in all required fields.');
                }
            });
        }
    }
    
    // Print-friendly enhancements
    function enhancePrint() {
        window.addEventListener('beforeprint', function() {
            // Expand any collapsed sections before printing
            var details = document.querySelectorAll('details');
            for (var i = 0; i < details.length; i++) {
                details[i].setAttribute('open', 'open');
            }
        });
    }
    
    // Initialize enhancements when DOM is ready
    function init() {
        // Core enhancements
        markExternalLinks();
        enhanceForms();
        enhancePrint();
        
        // Optional UI enhancements (only if CSS custom properties supported)
        if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', 'var(--color-primary)')) {
            initBackToTop();
            initThemeSwitcher();
        }
        
        // Log that enhancements are active (for debugging)
        if (typeof console !== 'undefined' && console.log) {
            console.log('Progressive enhancements loaded');
        }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
