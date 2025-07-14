// ==UserScript==
// @name        User Profile - Find Message From Send Log
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/user_profile?id=*
// @grant       none
// @version     1.6.0
// @author      Colin Whelan
// @description Adds a button beside each 'Message' of the User Profile + a button at the top to get all at once.
// How it works: Uses the new email-based lookup to search the Triggered Send Log filtered by the user's email address, making searches much faster and more reliable.
// ==/UserScript==

// Options:
const newPageDelay = 100 // (ms) How long to look at each page for before loading the next page. Much faster now due to email filtering.
const watchSearch = false // Toggle to true to watch the search for the message in real time

const style = document.createElement('style');
style.innerHTML = `
  .spinner {
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

const observer = new MutationObserver(function (mutations) {
  const dataCell = document.querySelector('.legacy-components-Tabs-src---Tabs-tab-panel-active--2qyFC .w-100.mt4 .legacy-components-Table-dist---Table-body-cell-align-left--1cMUg');
  const table = document.querySelector('.legacy-components-Tabs-src---Tabs-tab-panel-active--2qyFC .w-100.mt4');

  // Get the profileId from the 'Overview' tab the User Profile
  const profileId = document.querySelector('#profile-overview .pv2:nth-of-type(2) .pl3 strong').innerHTML.trim();

  // Extract the URL id parameter (will be validated when needed)
  const urlParams = new URLSearchParams(window.location.search);
  const urlId = decodeURIComponent(urlParams.get('id') || '');

  if (dataCell.innerHTML) {
    observer.disconnect(); // Stop observing

    // Get the target table header cell
    const headerCell = document.querySelector('div.legacy-components-Tabs-src---Tabs-tab-panel-active--2qyFC .w-100.mt4 .legacy-components-Table-dist---Table-head-cell-align-left--3aEVX');
    if (headerCell) {
      // Create 'Preview All' button element
      const previewAllButton = document.createElement('button');
      previewAllButton.innerHTML = 'Preview All';
      previewAllButton.id = 'previewAll';
      previewAllButton.style.backgroundColor = "rgb(0, 169, 250)";
      previewAllButton.style.color = "white";
      previewAllButton.style.border = "none";
      previewAllButton.style.borderRadius = "10px";
      previewAllButton.style.padding = "10px 15px";
      previewAllButton.style.margin = "5px 10px";
      previewAllButton.style.cursor = "pointer";
      previewAllButton.style.position = "relative";

      headerCell.appendChild(previewAllButton);
    }

    document.getElementById('previewAll').addEventListener('click', function() {
      const buttons = document.querySelectorAll('button.previewMessage');
      let index = 0;

      function triggerNextButton() {
        if (index < buttons.length) {
          buttons[index].click();
          index++;
          setTimeout(triggerNextButton, 500); // Small delay between clicks
        }
      }

      triggerNextButton();
    });

    // Loop through each row, checking for 'Triggered' messages
    for (let row of table.rows) {
      for (let cell of row.cells) {
        if (cell.cellIndex == 3 && cell.textContent.trim() === 'Triggered') {
          const rowIndex = cell.parentNode.rowIndex;

          const templateNameCell = table.rows[rowIndex].cells[0];
          const templateName = templateNameCell.textContent.trim();
          const sendDate = table.rows[rowIndex].cells[5].textContent.trim();

          // Button Settings
          const button = document.createElement("button");
          button.innerHTML = "Preview";
          button.style.backgroundColor = "rgb(0, 169, 250)";
          button.style.color = "white";
          button.style.border = "none";
          button.style.borderRadius = "10px";
          button.style.padding = "10px 15px";
          button.style.margin = "2px 10px";
          button.style.cursor = "pointer";
          button.style.position = "relative";
          button.className = 'previewMessage';

          button.onclick = function() {
            automatedEmailCheck(templateName, sendDate, profileId, urlId, templateNameCell, button);
          };

          if(templateNameCell.textContent != 'Email'){
            templateNameCell.appendChild(button);
          }
        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function formatDateForURL(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function automatedEmailCheck(templateName, sendDate, profileId, urlId, templateNameCell, button) {
  // Extract and validate email when actually needed
  let userEmail = '';

  // Check if the URL id parameter is an email (contains @ and .)
  if (urlId && urlId.includes('@') && urlId.includes('.')) {
    userEmail = urlId;
    console.log('Email extracted from URL:', userEmail);
  } else {
    // If URL id is not an email format, prompt user for email
    userEmail = prompt('The profile ID is not in email format. Please enter the user\'s email address:');
    if (!userEmail || !userEmail.includes('@')) {
      console.error('Valid email address is required for this script to work.');
      button.innerHTML = "Error - No Email";
      button.style.backgroundColor = "rgb(220, 53, 69)"; // Red for error
      return;
    }
    console.log('Email entered by user:', userEmail);
  }

  button.textContent = "";

  // Spinner div
  const spinner = document.createElement("div");
  spinner.className = 'spinner';
  spinner.style.position = 'relative';
  button.appendChild(spinner);

  const sendDateObj = new Date(sendDate);

  // Create a wider date range for better results (±1 day)
  const startDate = new Date(sendDateObj);
  startDate.setDate(startDate.getDate() - 1);

  const endDate = new Date(sendDateObj);
  endDate.setDate(endDate.getDate() + 1);

  const formattedStartDate = formatDateForURL(startDate);
  const formattedEndDate = formatDateForURL(endDate);

  console.log('Searching for:', {
    templateName,
    sendDate,
    userEmail,
    dateRange: `${formattedStartDate} to ${formattedEndDate}`
  });

  // Construct the new URL using email-based lookup
  const newURL = `https://my.sailthru.com/reports/transactional_log#start_date=${formattedStartDate}&end_date=${formattedEndDate}&start_time=12:00 AM&end_time=11:59 PM&email=${encodeURIComponent(userEmail)}`;

  // Create an invisible iframe
  const iframe = document.createElement('iframe');

  if(watchSearch){
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '40%';
    iframe.style.height = '40%';
    iframe.style.border = '2px solid black';
  } else {
    iframe.style.display = 'none';
  }

  iframe.src = newURL;
  document.body.appendChild(iframe);

  iframe.onload = function() {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    let matchFound = false;
    let currentPage = 0;

    const checkTable = function() {
      const iframeWindow = iframe.contentWindow;

      iframeWindow.addEventListener('error', function(event) {
        console.log("Network error occurred, stopping search.");
        button.innerHTML = "Error - Try Again";
        document.body.removeChild(iframe);
      });

      const targetTable = iframeDocument.querySelector('.standard');
      const checkFailure = iframeDocument.querySelector('.row2 .row2');

      // Check if no results found
      if (checkFailure && checkFailure.textContent.includes('You have not sent')) {
        button.innerHTML = "Not Found";
        button.style.backgroundColor = "rgb(255, 193, 7)"; // Yellow for not found
        console.log("No messages found for this email in the date range.");
        setTimeout(() => document.body.removeChild(iframe), 1000);
        return;
      }

      if (targetTable) {
        for (let row of targetTable.rows) {
          const cells = row.cells;
          if (cells.length < 4) continue; // Skip header or invalid rows

          const iframeTemplateName = cells[0].textContent.trim();
          const iframeEmail = cells[1].textContent.trim();
          const iframeSendDate = cells[3].textContent.trim();

          // Since we're already filtered by email, we mainly need to match template and date
          if (iframeTemplateName === templateName.trim() &&
              iframeEmail === userEmail.trim() &&
              iframeSendDate === sendDate.trim()) {

            matchFound = true;

            const magnifierCell = row.cells[6];
            const magnifierLink = magnifierCell.querySelector('.magnifier') || magnifierCell.querySelector('a');

            if (magnifierLink) {
              const magnifierURL = magnifierLink.getAttribute('href');

              // Create the link to replace the template name
              const templateLink = document.createElement('a');
              templateLink.href = magnifierURL;
              templateLink.target = '_blank';
              templateLink.style.textDecoration = 'underline';
              templateLink.style.color = '#333';
              templateLink.style.fontWeight = 'bold';
              templateLink.style.fontSize = 'larger';
              templateLink.innerText = templateName;

              templateNameCell.innerHTML = '';
              templateNameCell.appendChild(templateLink);

              button.removeChild(spinner);

              console.log('Match found and link created successfully');
              setTimeout(() => document.body.removeChild(iframe), 1000);
              return;
            }
          }
        }

        // If no match found on this page, try the next page
        if (!matchFound) {
          // Check if there are more pages
          const nextPageLink = iframeDocument.querySelector('.pagination .next') ||
                              iframeDocument.querySelector('[title="Next"]');

          if (nextPageLink && !nextPageLink.classList.contains('disabled')) {
            // Load next page using AJAX refresh if available
            try {
              iframeWindow.eval(`
                if (typeof ajax !== 'undefined' && ajax.refresh) {
                  ajax.refresh(this, { start: ${(currentPage + 1) * 20} });
                }
              `);

              currentPage++;
              setTimeout(checkTable, newPageDelay);
            } catch (e) {
              console.log('Could not load next page, stopping search');
              button.innerHTML = "Partial Search";
              button.style.backgroundColor = "rgb(255, 193, 7)";
              setTimeout(() => document.body.removeChild(iframe), 1000);
            }
          } else {
            // No more pages, message not found
            button.innerHTML = "Not Found";
            button.style.backgroundColor = "rgb(255, 193, 7)";
            console.log("Message not found in search results");
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }
        }
      } else {
        // Table not loaded yet, try again
        setTimeout(checkTable, newPageDelay);
      }
    };

    // Start checking after a brief delay to let the page load
    setTimeout(checkTable, newPageDelay);
  };
}
