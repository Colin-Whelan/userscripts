// ==UserScript==
// @name        Quick Copy Section Link
// @namespace   Violentmonkey Scripts
// @match       https://getstarted.sailthru.com/*
// @match       https://getstarted.meetmarigold.com/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Add quick URL copy buttons to each section for easy sharing.
// ==/UserScript==


(function() {
    const addCopyLinks = () => {
        console.log('Ready!');
        document.querySelectorAll('h2, h3').forEach(header => {
            const span = header.querySelector('span[id]');
            if (span) {
                const linkIcon = document.createElement('span');
                linkIcon.textContent = '🔗';
                linkIcon.style.class = 'pointer';
                linkIcon.style.cursor = 'pointer';
                linkIcon.style.marginLeft = '8px';
                linkIcon.style.fontSize = '70%';

                linkIcon.addEventListener('click', () => {
                    const sectionLink = window.location.origin + window.location.pathname + '#' + span.id;
                    navigator.clipboard.writeText(sectionLink)
                        .then(() => showNotification(header, 'Link copied!'))
                        .catch(err => console.error('Error copying link: ', err));
                });

                header.appendChild(linkIcon);
            }
        });
    };

    const showNotification = (element, message) => {

        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'absolute';
        notification.style.background = 'black';
        notification.style.color = 'white';
        notification.style.padding = '5px';
        notification.style.borderRadius = '4px';
        notification.style.fontSize = 'small';
        notification.style.opacity = '1';
        notification.style.transition = 'opacity 2s';

        const rect = element.querySelector('.emoji').getBoundingClientRect();
        console.log(element, rect)
        notification.style.top = `${rect.top + window.scrollY}px`; // Adjusted for scroll position
        notification.style.left = `${rect.right + 10}px`;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 2000);
        }, 2000);
    };

    const interval = setInterval(() => {
        if (document.querySelectorAll('h2, h3').length) {
            addCopyLinks();
            clearInterval(interval);
        }
    }, 400);
})();
