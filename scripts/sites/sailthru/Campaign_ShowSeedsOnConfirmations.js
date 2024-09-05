// ==UserScript==
// @name        Campaign - Show Seeds on Confirmations
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaign**
// @match       https://my.sailthru.com/recurring_campaign**
// @grant       none
// @version     1.2
// @author      Colin Whelan
// @description Adds seed emails to the confirmation screen.
// v1.2 Updates:
// - Prevent multiple copies of 'Seed Emails' div from appearing
// v1.1 Updates:
// - way less extra data fetches in the background
// ==/UserScript==
(function() {
    'use strict';

    let seedEmailsAdded = false;

    function fetchCampaignDataAndDisplaySeedEmails() {
        if (seedEmailsAdded) return;

        const campaignId = window.location.hash.split('#')[1].split('/')[0];
        const apiUrl = `https://my.sailthru.com/uiapi/campaign/${campaignId}?_=${Date.now()}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                displaySeedEmails(data);
            })
            .catch(error => {
                console.error('Error fetching campaign data:', error);
            });
    }

    function displaySeedEmails(data) {
        const parentContainer = document.querySelector('#schedule_confirmation > div > div > div:nth-last-child(1)');
        if (parentContainer && data.seed_emails && !seedEmailsAdded) {
            const seedEmailsRow = document.createElement('div');
            seedEmailsRow.className = 'pn--ConfirmationField-row--18bD0 seed-emails-row';
            seedEmailsRow.innerHTML = `
                <span class="pn--ConfirmationField-fieldLabel--xzLYp">Seed Emails</span>
                <span class="pn--ConfirmationField-fieldValue--3SAjM">${data.seed_emails}</span>
                <span class="pn--ConfirmationField-iconContainer--3ta0w"><i class="fa fa-check"></i></span>
            `;
            parentContainer.appendChild(seedEmailsRow);
            seedEmailsAdded = true;
        }
    }

    const domChangeObserver = new MutationObserver(() => {
        const confirmationContainer = document.querySelector('#schedule_confirmation');
        if (confirmationContainer && !seedEmailsAdded) {
            fetchCampaignDataAndDisplaySeedEmails();
        }
    });

    domChangeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
