// ==UserScript==
// @name        Campaign - Show Preview Text on Confirmations
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaign**
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Adds preview text to the confirmation page directly after the subject
// ==/UserScript==

(function() {
    'use strict';

    function fetchCampaignDataAndDisplayPreviewText() {
        const campaignId = window.location.hash.split('#')[1].split('/')[0];
        const apiUrl = `https://my.sailthru.com/uiapi/campaign/${campaignId}?_=${Date.now()}`;
        const existingPreviewRow = document.querySelector('.preview_text');

        let isVisualEmail = true

        if(!existingPreviewRow && isVisualEmail){
          fetch(apiUrl)
              .then(response => response.json())
              .then(data => {
                  const previewText = extractPreviewText(data.content_html);

                  if(!previewText) isVisualEmail = false

                  if(isVisualEmail) displayPreviewText(previewText)

              })
              .catch(error => {
                  console.error('Error fetching campaign data:', error);
              });
        }

    }

    function extractPreviewText(contentHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentHtml, 'text/html');
        const previewDiv = doc.querySelector('.sailthru-emco-preheader');
        return previewDiv ? previewDiv.textContent : '';
    }

    function displayPreviewText(previewText) {
        const subjectRow = document.querySelector('.section_row.subject'); // Find the subject row
        const adRow = document.querySelector('.section_row.ad_plan');

        if (subjectRow || adRow) {
            if (!document.querySelector('.preview_text')) { // If it doesn't exist, add it
                const previewRow = document.createElement('div');
                previewRow.className = 'section_row preview_text';
                previewRow.innerHTML = `
                    <label class="field_name">Preview Text</label>
                    <div class="section_confirm_column"><label>${previewText ? previewText : "HTML Template/Missing"}</label></div>
                    <div class="section_confirm_check"><div class="large blue check icon"></div></div>
                `;
                if(subjectRow) {
                  subjectRow.insertAdjacentElement('afterend', previewRow); // Insert after the subject row
                } else {
                  adRow.insertAdjacentElement('afterend', previewRow); // Insert after the subject row
                }

            }
        }
    }

    const domChangeObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                const confirmationContainer = document.querySelector('.section_confirm');
                if (confirmationContainer && !confirmationContainer.querySelector('.preview_text')) { // Check before fetching
                    fetchCampaignDataAndDisplayPreviewText();
                }
            }
        });
    });

    domChangeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
