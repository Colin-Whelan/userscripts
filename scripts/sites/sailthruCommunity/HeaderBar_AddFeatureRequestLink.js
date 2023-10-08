// ==UserScript==
// @name        Add Feature Request Link to Sailthru
// @namespace   Violentmonkey Scripts
// @match       https://sailthru.zendesk.com/hc/en-us/community/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description 2023-10-08, 1:23:41 a.m.
// ==/UserScript==

(function() {
    'use strict';

    const userNav = document.getElementById('user-nav');
    if (userNav) {
        // Create the new anchor element
        const featureRequestLink = document.createElement('a');
        featureRequestLink.textContent = 'Submit a Feature Request';
        featureRequestLink.href = 'https://sailthru.zendesk.com/hc/en-us/community/posts/new';

        // Insert the new link into the user-nav
        userNav.insertBefore(featureRequestLink, userNav.firstChild);
    }
})();
