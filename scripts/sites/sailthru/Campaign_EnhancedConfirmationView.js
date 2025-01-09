// ==UserScript==
// @name        Campaign - Enhanced Confirmation View
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaign**
// @match       https://my.sailthru.com/recurring_campaign**
// @grant       none
// @version     2.8
// @author      Colin Whelan
// @description Enhances campaign confirmation screen with seed emails, relative time, preview text, and campaign suppression list validation
// ==/UserScript==
(function() {
   'use strict';

   // Configuration
   const MAX_SEED_EMAILS = 20; // Maximum number of seed emails to display

   const suppressionListsValidation = false

   // Template Keyword and Suppression List Configuration
   const CAMPAIGN_RULES = [{
         keywords: ["mother"], // Keywords to match against the campaign name (case-insensitive)
         requiredSuppressionLists: ["Mothers Days Exclusions"] // Array of required suppression lists if keywords match
      },
      {
         keywords: ["father"],
         requiredSuppressionLists: ["Fathers Days Exclusions"]
      },
      {
         keywords: [""], // will run for all campaigns
         requiredSuppressionLists: ["Standard Exclusions"]
      },
      // Add more rules as needed
   ];


   // State tracking
   let seedEmailsAdded = false;
   let isVisualEmail = true;
   let lastProcessedCampaignId = null;
   let templateRulesChecked = false;
   let lastProcessedHash = null;


   // Helper Functions
   function getMonthNumber(monthStr) {
      const months = {
         'Jan': '01',
         'Feb': '02',
         'Mar': '03',
         'Apr': '04',
         'May': '05',
         'Jun': '06',
         'Jul': '07',
         'Aug': '08',
         'Sep': '09',
         'Oct': '10',
         'Nov': '11',
         'Dec': '12'
      };
      return months[monthStr] || '01';
   }

   function getCurrentCampaignId() {
      const hash = window.location.hash;
      return hash ? hash.split('#')[1].split('/')[0] : null;
   }

   function resetState() {
      seedEmailsAdded = false;
      isVisualEmail = true;
      templateRulesChecked = false;

   }

   function limitSeedEmails(seedEmails) {
      if (!seedEmails) return '';

      const emailArray = seedEmails.split('\n').map(email => email.trim());
      const totalCount = emailArray.length;
      const limitedEmails = emailArray.slice(0, MAX_SEED_EMAILS);

      if (totalCount > MAX_SEED_EMAILS) {
         return limitedEmails.join(', ') + ` (and ${totalCount - MAX_SEED_EMAILS} more...)`;
      }

      return limitedEmails.join(', ');
   }

   function calculateRelativeTime(dateString, timeString, timezone) {
      const dateComponents = dateString.replace(/^\w+,\s/, '').split(' ');
      const [monthStr, dayWithComma, year] = dateComponents;
      const day = dayWithComma.replace(/\D/g, '');

      const [time, period] = timeString.split(' ');
      const [hours, minutes] = time.replace(',', '').split(':');

      let hour = parseInt(hours);
      if (period.toLowerCase().includes('p.m.') && hour !== 12) {
         hour += 12;
      } else if (period.toLowerCase().includes('a.m.') && hour === 12) {
         hour = 0;
      }

      const monthNum = getMonthNumber(monthStr);
      const formattedDay = day.padStart(2, '0');
      const dateStr = `${year}-${monthNum}-${formattedDay}T${hour.toString().padStart(2, '0')}:${minutes}`;
      const scheduledDate = new Date(dateStr);

      const now = new Date();
      const diffMs = scheduledDate - now;
      const diffMins = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMs / 3600000);
      const diffDays = Math.round(diffMs / 86400000);

      if (diffMins < 60) {
         return `(in ${diffMins} minutes)`;
      } else if (diffHours < 24) {
         return `(in ${diffHours} hours)`;
      } else {
         return `(in ${diffDays} days)`;
      }
   }


   // --- Unified Fetch Function ---
   async function fetchSailthruData(endpoint) {
      const currentCampaignId = getCurrentCampaignId();
      if (!currentCampaignId) return null;

      const apiUrl = `https://my.sailthru.com/uiapi/campaign/${currentCampaignId}?_=${Date.now()}${endpoint}`;

      try {
         const response = await fetch(apiUrl);
         if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
         }
         return await response.json();
      } catch (error) {
         console.error('Error fetching Sailthru data:', error);
         return null;
      }
   }


   // --- Unified Display Function ---
   function displayConfirmationRow(parentSelector, label, value, iconClass = "fa-check", color = '') {
      const parentContainer = document.querySelector(parentSelector);
      if (!parentContainer) return;

      const existingRow = parentContainer.querySelector(`.confirmation-row-${label.replace(/ /g, '-')}`);
      if (existingRow) {
         existingRow.remove();
      }
      const row = document.createElement('div');
      row.className = `pn--ConfirmationField-row--18bD0 confirmation-row-${label.replace(/ /g, '-')}`;
      row.innerHTML = `
            <span class="pn--ConfirmationField-fieldLabel--xzLYp">${label}</span>
            <span class="pn--ConfirmationField-fieldValue--3SAjM" style="color: ${color};">${value}</span>
            <span class="pn--ConfirmationField-iconContainer--3ta0w"><i class="fa ${iconClass}" style="color: ${color};"></i></span>
        `;
      parentContainer.appendChild(row);
   }



   // --- Feature: Seed Emails ---
   async function fetchAndDisplaySeedEmails() {
      if (seedEmailsAdded) return;
      const data = await fetchSailthruData('--seeds');
      if (data && data.seed_emails) {
         displayConfirmationRow(
            '#schedule_confirmation > div > div > div:nth-last-child(1)',
            'Seed Emails',
            limitSeedEmails(data.seed_emails)
         );
         seedEmailsAdded = true;
      }
   }
   // --- Feature: Relative Time ---
   function addRelativeTime() {
      const scheduleTimeRow = document.querySelector('.pn--ConfirmationField-row--18bD0:nth-child(2)');
      if (scheduleTimeRow && !scheduleTimeRow.querySelector('.relative-time')) {
         const dateRow = document.querySelector('.pn--ConfirmationField-row--18bD0:nth-child(1)');
         const dateText = dateRow.querySelector('.pn--ConfirmationField-fieldValue--3SAjM').textContent;
         const timeText = scheduleTimeRow.querySelector('.pn--ConfirmationField-fieldValue--3SAjM span').firstChild.textContent;
         const timezoneText = scheduleTimeRow.querySelector('i').textContent;

         const relativeTime = calculateRelativeTime(dateText, timeText, timezoneText);

         const relativeSpan = document.createElement('span');
         relativeSpan.className = 'relative-time';
         relativeSpan.style.marginLeft = '8px';
         relativeSpan.style.color = '#666';
         relativeSpan.textContent = relativeTime;

         scheduleTimeRow.querySelector('.pn--ConfirmationField-fieldValue--3SAjM span').appendChild(relativeSpan);
      }
   }


   // --- Feature: Preview Text ---
   async function fetchAndDisplayPreviewText() {
      if (!isVisualEmail) return;
      const data = await fetchSailthruData('');
      if (data && data.content_html) {
         const previewText = extractPreviewText(data.content_html);
         if (!previewText) {
            isVisualEmail = false;
            return;
         }

         const subjectRow = document.querySelector('.section_row.subject');
         const adRow = document.querySelector('.section_row.ad_plan');
         const insertPoint = subjectRow || adRow
         if (insertPoint) {
            const previewRow = document.querySelector('.preview_text')
            if (previewRow) {
               previewRow.remove();
            }
            const previewRowNew = document.createElement('div');
            previewRowNew.className = 'section_row preview_text';
            previewRowNew.innerHTML = `
                  <label class="field_name">Preview Text</label>
                  <div class="section_confirm_column"><label>${previewText ? previewText : "HTML Template/Missing"}</label></div>
                  <div class="section_confirm_check"><div class="large blue check icon"></div></div>
              `;
            insertPoint.insertAdjacentElement('afterend', previewRowNew);
         }
      }

   }

   function extractPreviewText(contentHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(contentHtml, 'text/html');
      const previewDiv = doc.querySelector('.sailthru-emco-preheader');
      return previewDiv ? previewDiv.textContent : '';
   }
   // --- Unified Suppression Check ---
   async function fetchAndValidateSuppressionLists() {
      if (templateRulesChecked) return;
      const data = await fetchSailthruData('');
      if (data) {
         const campaignName = data.name;
         const suppressionLists = data.suppress_list || [];
         validateSuppressionLists(campaignName, suppressionLists);
         templateRulesChecked = true;
      }
   }


     function validateSuppressionLists(campaignName, suppressionLists) {
        let allMissingLists = new Set(); // Using a Set to avoid duplicates
        let validationFailed = false;

        CAMPAIGN_RULES.forEach(rule => {
            if (rule.keywords.some(keyword => campaignName && campaignName.toLowerCase().includes(keyword))) {
                 const requiredLists = rule.requiredSuppressionLists;
                 const missingLists = requiredLists.filter(requiredList => !suppressionLists.includes(requiredList));

                if(missingLists.length > 0) {
                  validationFailed = true;
                  missingLists.forEach(list => allMissingLists.add(list));
                }
            }
        });
        const missingListsArray = Array.from(allMissingLists);
        const boldedMissingLists = missingListsArray.map(list => `<strong>${list}</strong>`);
        const message = validationFailed
            ? `Warning: Campaign "${campaignName}" is missing the following suppression lists: ${boldedMissingLists.join(', ')}`
            : 'Template validation passed';

       const icon = validationFailed ? 'fa-exclamation-triangle' : 'fa-check';
        const color = validationFailed ? 'red' : '';
         displayConfirmationRow(
          '#schedule_confirmation > div > div > div:nth-last-child(1)',
          'Suppression Check',
          message,
           icon,
           color
        );
    }


   function runScriptOnConfirmation() {
      // Check if we're on the confirmation page
      const scheduleConfirmation = document.querySelector('#schedule_confirmation');
      const confirmationContainer = document.querySelector('.section_confirm');

      if (scheduleConfirmation || confirmationContainer) {
         const currentHash = window.location.hash;
         if (currentHash === lastProcessedHash) {
            return; // If hash hasn't changed, don't re-run.
         }
         lastProcessedHash = currentHash;


         resetState();

         // Run all the features
         fetchAndDisplaySeedEmails();
         addRelativeTime();
         if(suppressionListsValidation) fetchAndValidateSuppressionLists();
         fetchAndDisplayPreviewText();


      }
   }
   // Check for navigation changes
   function checkForNavigation() {
      const currentCampaignId = getCurrentCampaignId();
      if (currentCampaignId !== lastProcessedCampaignId) {
         resetState();
         lastProcessedCampaignId = currentCampaignId;
      }
      runScriptOnConfirmation();

   }


   // Unified DOM Observer
   const domChangeObserver = new MutationObserver(mutations => {
      checkForNavigation();
      mutations.forEach(mutation => {
         if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            runScriptOnConfirmation();
         }
      });
   });

   // Start observing
   domChangeObserver.observe(document.body, {
      childList: true,
      subtree: true
   });

   // Listen for hash changes
   window.addEventListener('hashchange', checkForNavigation);
   // Run the script once on initial load
   runScriptOnConfirmation();
})();
