// ==UserScript==
// @name        Content - Auto Upvote Self
// @namespace   Violentmonkey Scripts
// @match       https://sailthru.zendesk.com/hc/en-us/community/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Auto upvote your own content like a lot of other platforms.
// ==/UserScript==

(function() {
    'use strict';

    const username = document.getElementById('user-name').innerText;
    const interval = 5000;  // Polling interval in milliseconds

    function autoUpvote() {
        // Auto-upvote comments
        document.querySelectorAll('.comment-wrapper').forEach(item => {
            const author = item.querySelector('.comment-meta span').textContent.trim();
            const upvoteButton = item.querySelector('.comment-vote .vote-up');
            if (author === username && upvoteButton && !upvoteButton.classList.contains('vote-voted')) {
                console.log('Upvoted own comment')
                upvoteButton.click();
            }
        });

        // Auto-upvote posts
        document.querySelectorAll('.post-info-container').forEach(item => {
            const author = item.querySelector('.post-meta span').textContent.trim();
            const upvoteButton = item.querySelector('.post-vote .vote-up');
            if (author === username && upvoteButton && !upvoteButton.classList.contains('vote-voted')) {
                console.log('Upvoted own post')
                upvoteButton.click();
            }
        });
    }

    setInterval(autoUpvote, interval);
})();
