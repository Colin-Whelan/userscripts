// ==UserScript==
// @name        Minesweeper Online Rank Display
// @namespace   Violentmonkey Scripts
// @match       https://minesweeper.online/*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @version     1.7
// @author      Colin Whelan
// @description Displays your Minesweeper Online rank and percentage in the navbar.
// ==/UserScript==

(function() {
    'use strict';

    // Configuration: Update frequency in minutes
    const UPDATE_DELAY = 1;

    // Configuration: Toggle logging (DEV ONLY)
    const ENABLE_LOGGING = false;

    // iframe reference
    let iframe = null;

    // Add CSS for styling the rank display
    GM_addStyle(`
        #rank-display {
            display: inline-block;
            margin-left: 15px;
            font-size: 1.1em;
            color: #fff;
        }
        #rank-display a {
            color: #fff;
            text-decoration: none;
        }
    `);

    function log(message) {
        if (ENABLE_LOGGING) {
            console.log("[Minesweeper Rank Script] " + message);
        }
    }

    function waitForElement(iframeDocument, selector, callback, attempts = 0) {
        const maxAttempts = 100;
         if (attempts > maxAttempts) {
             log(`Element ${selector} not found after ${maxAttempts} attempts`);
            return;
        }
         const element = iframeDocument.querySelector(selector);

        if (element && element.textContent !== 'n/a') {
            callback(element);
        } else {
            setTimeout(() => waitForElement(iframeDocument, selector, callback, attempts+1), 1000);
        }
    }

    function createIframe() {
        const iframe = document.createElement('iframe');
        iframe.id = 'rank-iframe';
        iframe.style.display = 'none';
        iframe.src = 'https://minesweeper.online/events';
        document.body.appendChild(iframe);
        return iframe;
    }

    function removeIframe(iframeToRemove) {
        if (iframeToRemove) {
            iframeToRemove.parentNode.removeChild(iframeToRemove);
            iframe = null;
        }
    }
    function parseRank(rankText) {
        if (!rankText) {
            log('rankText is empty');
            return null;
        }

        const [rank, total] = rankText.split('/').map(s => s.trim());
        const rankNumber = parseInt(rank, 10);
        const totalNumber = parseInt(total, 10);

        if (isNaN(rankNumber) || isNaN(totalNumber)) {
            log('Rank or total was NaN');
            return null;
        }
        const percentage = ((rankNumber / totalNumber) * 100).toFixed(2);
        return {
            rank: rank,
            total: total,
            percentage: percentage
        }

    }
    function updateRankDisplay(rankData) {
        let rankDisplay = document.getElementById('rank-display');
        if (!rankDisplay) {
            rankDisplay = document.createElement('div');
            rankDisplay.id = 'rank-display';
            const navBar = document.querySelector('.header-buttons');
            if(navBar){
                navBar.appendChild(rankDisplay);
            } else {
                log('Could not find navbar element to add rank to.');
                 return;
            }
         }
          rankDisplay.innerHTML = `Rank: <a href="https://minesweeper.online/events">${rankData.rank} / ${rankData.total}</a> (${rankData.percentage}%)`;
    }

    function handleRankFetch(iframe) {
         const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
        waitForElement(iframeDocument, '#stat_my_rank', (rankElement) => {
                log('Stat element found.');
                 if (!rankElement) {
                        log('Rank element not found.');
                         removeIframe(iframe);
                    return;
                }
                 log(`rankElement text content is ${rankElement.textContent}`);

                const rankData = parseRank(rankElement.textContent);
               if(rankData){
                   log(`Found Rank: ${rankData.rank}/${rankData.total} (${rankData.percentage}%)`);
                    updateRankDisplay(rankData);
               }
               removeIframe(iframe);

        });
    }
    function fetchAndDisplayRank() {
        log('Fetching rank...');
         // If an iframe already exists, remove it
        removeIframe(iframe);

        iframe = createIframe();

        iframe.onload = () => {
            handleRankFetch(iframe);
        };
    }

    // Initial fetch and display
    fetchAndDisplayRank();

    // Refresh the rank every X minutes
    setInterval(fetchAndDisplayRank, UPDATE_DELAY * 60 * 1000);

})();
