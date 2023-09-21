// ==UserScript==
// @name        Triggered Send Log - Clickable Emails - sailthru.com
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.0
// @author      -
// @description 2023-09-21, 2:45:27 p.m.
// ==/UserScript==

let emailsLinked = false;

// Function to convert emails to links
function linkEmails() {
  if (emailsLinked) return;

  const rows = document.querySelectorAll('tr.even, tr.odd');
  let changesMade = false;

  rows.forEach((row) => {
    const emailTD = row.children[1];

    if (emailTD && !emailTD.querySelector('a')) {
      const email = emailTD.textContent.trim();
      const profileURL = `https://my.sailthru.com/reports/user_profile?id=${encodeURIComponent(email)}`;

      const emailLink = document.createElement('a');
      emailLink.href = profileURL;
      emailLink.textContent = email;

      emailTD.innerHTML = '';
      emailTD.appendChild(emailLink);

      changesMade = true;
    }
  });

  if (changesMade) emailsLinked = true;
}

// Initialize MutationObserver
const observer = new MutationObserver((mutations) => {
  linkEmails();
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});
