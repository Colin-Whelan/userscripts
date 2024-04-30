// ==UserScript==
// @name        Global - Open Email In Sailthru
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/indigo-books-and-music/*
// @grant       GM_addStyle
// @version     1.0
// @author      -
// @description Adds a UI button to open the email address in Sailthru - saves lots of copy/pasting.
// ==/UserScript==

(function() {
    'use strict';

    // Add custom styles for the button
    GM_addStyle(`
        .sailthru-button {
            background-color: #4A90E2; /* Blue to match the theme */
            color: white;
            border: none;
            padding: 8px 16px;
            margin-left: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial, sans-serif; /* Adjust as needed */
            transition: background-color 0.3s;
        }
        .sailthru-button:hover {
            background-color: #357ABD; /* Darker shade on hover */
        }
    `);

    // Function to create and append the Sailthru button
    function createSailthruButton(emailAnchor) {
        // Check if the button has already been added
        if (emailAnchor.classList.contains('sailthru-button-added')) {
            return; // Button already added, do nothing
        }

        const emailAddress = emailAnchor.href.replace('mailto:', '');
        const encodedEmail = encodeURIComponent(emailAddress);

        const button = document.createElement('button');
        button.innerText = 'Open in Sailthru';
        button.className = 'sailthru-button';

        button.onclick = function() {
            window.open(`https://my.sailthru.com/reports/user_profile?id=${encodedEmail}#/`, '_blank');
        };

        // Mark the email anchor to avoid adding another button
        emailAnchor.classList.add('sailthru-button-added');

        emailAnchor.parentNode.insertBefore(button, emailAnchor.nextSibling);
    }

    // Function to observe DOM changes
    function observeDOM() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        node.querySelectorAll('a.📦pst_relative[href^="mailto:"]').forEach(createSailthruButton);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    document.querySelectorAll('a.📦pst_relative[href^="mailto:"]').forEach(createSailthruButton);
    observeDOM();
})();
