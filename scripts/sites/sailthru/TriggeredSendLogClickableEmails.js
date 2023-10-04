// ==UserScript==
// @name        Triggered Send Log - Clickable Emails
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.0
// @author      -
// @description 2023-09-21, 2:45:27 p.m.
// ==/UserScript==

// Function to convert emails to links
function linkEmails() {
  const rows = document.querySelectorAll('tr.even:not(.email-linked), tr.odd:not(.email-linked)');

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

      // Mark this row as processed
      row.classList.add('email-linked');
    }
  });
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
