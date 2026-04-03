// ==UserScript==
// @name        Quick Copy Section Link
// @namespace   Violentmonkey Scripts
// @match       https://getstarted.sailthru.com/*
// @match       https://getstarted.meetmarigold.com/*
// @grant       none
// @version     1.2
// @author      Colin Whelan
// @description Add quick URL copy buttons to each section for easy sharing.
// ==/UserScript==

(function() {
    const addCopyLinks = () => {
        // console.log('[Quick Copy] - Ready!');

        // Select headers that have an ID directly or contain a span with an ID
        document.querySelectorAll('h2, h3').forEach(header => {
            // Check if already processed to avoid duplicate icons
            if (header.querySelector('.copy-link-icon')) return;

            // Find the ID: Priority 1: The header itself. Priority 2: A span inside it.
            const anchorId = header.id || header.querySelector('span[id]')?.id;

            if (anchorId) {
                const linkIcon = document.createElement('span');
                linkIcon.className = 'copy-link-icon'; // Added class for tracking
                linkIcon.textContent = '🔗';
                linkIcon.style.cursor = 'pointer';
                linkIcon.style.marginLeft = '8px';
                linkIcon.style.fontSize = '70%';
                linkIcon.title = 'Copy section link';

                linkIcon.addEventListener('click', (e) => {
                    e.preventDefault();
                    const sectionLink = window.location.origin + window.location.pathname + '#' + anchorId;

                    navigator.clipboard.writeText(sectionLink)
                        .then(() => showNotification(linkIcon, 'Link copied!'))
                        .catch(err => console.error('Error copying link: ', err));
                });

                header.appendChild(linkIcon);
            }
        });
    };

    const showNotification = (targetElement, message) => {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'absolute';
        notification.style.background = 'black';
        notification.style.color = 'white';
        notification.style.padding = '4px 8px';
        notification.style.borderRadius = '4px';
        notification.style.fontSize = '12px';
        notification.style.zIndex = '1000';
        notification.style.pointerEvents = 'none';
        notification.style.transition = 'opacity 0.5s';

        // Position relative to the icon clicked
        const rect = targetElement.getBoundingClientRect();
        notification.style.top = `${rect.top + window.scrollY - 30}px`;
        notification.style.left = `${rect.left + window.scrollX}px`;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 1500);
    };

    // Use a MutationObserver or a safer interval to handle dynamic content
    const interval = setInterval(() => {
        if (document.querySelectorAll('h2, h3').length) {
            addCopyLinks();
            // We keep the interval running or re-run it because some
            // documentation sites load content dynamically as you scroll.
        }
    }, 1000);
})();
