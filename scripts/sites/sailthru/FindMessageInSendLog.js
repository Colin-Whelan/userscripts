// ==UserScript==
// @name        Find That Message
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/user_profile?id=*
// @grant       none
// @version     1.3
// @author      Colin Whelan
// @description Adds a button beside each 'Message' of the User Profile + a button at the top to get all at one.
// How it works: In the background(or foreground if watchSearch is true) an iframe is made for each message which navigates to the Triggered Send Log with the date limited to that day and the message selected.
// It then scans over each row of the table, checking to make sure all the details match the profile. When a match is found, it add the corresponding link to the User Profile.
// ==/UserScript==

// Options:
// Choose a speed to search at. The faster the search the more likely a result is to be missed and require a re-run
const newPageDelay = 200 // (ms) How long to look at each page for before loading the next page. <100 = Fast, ~150 = Normal, 200+ = Reliable.
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

  //Get the profileId from the 'Overview' tab the User Profile. TODO: Test to make sure this is consistent across clients/accounts
  const profileId = document.querySelector('#profile-overview .pv2:nth-of-type(2) .pl3 strong').innerHTML.trim();

  if (dataCell.innerHTML) {
    observer.disconnect(); // Stop observing

    // Get the target table header cell (may need to make a better query)
    const headerCell = document.querySelector('div.legacy-components-Tabs-src---Tabs-tab-panel-active--2qyFC .w-100.mt4 .legacy-components-Table-dist---Table-head-cell-align-left--3aEVX');
    if (headerCell) {
      // Create 'Preview All' button element
      const previewAllButton = document.createElement('button');
      previewAllButton.innerHTML = 'Preview All';
      previewAllButton.id = 'previewAll';
      previewAllButton.style.backgroundColor = "rgb(0, 169, 250)";  // Blue background
      previewAllButton.style.color = "white";  // White text
      previewAllButton.style.border = "none";  // No border
      previewAllButton.style.borderRadius = "10px";  // No border
      previewAllButton.style.padding = "10px 15px";  // Padding
      previewAllButton.style.margin = "5px 10px";  // Margin
      previewAllButton.style.cursor = "pointer";  // Cursor pointer
      previewAllButton.style.position = "relative";

      // Append the button to the header cell
      headerCell.appendChild(previewAllButton);
    }

    document.getElementById('previewAll').addEventListener('click', function() {
      const buttons = document.querySelectorAll('button.previewMessage');
      let index = 0;

      // Recursively clicks all the 'Preview' buttons
      function triggerNextButton() {
        if (index < buttons.length) {
          buttons[index].click();
          index++;
          triggerNextButton();
        }
      }

      triggerNextButton(); // Start the recursive clicks
    });

    // Loop through each row, checking to see if the text is 'Triggered' or 'Transactional'
    // Issues may occur if the Message/Campaign ID is either of those values
    for (let row of table.rows) {
      for (let cell of row.cells) {
        if (cell.textContent.trim() === 'Triggered' || cell.textContent.trim() === 'Transactional') {
          const rowIndex = cell.parentNode.rowIndex;
          const cellIndex = cell.cellIndex;

          // Get the template name and send date from the cells relative to the current one
          const templateNameCell = table.rows[rowIndex].cells[cellIndex - 2];
          const templateName = templateNameCell.textContent.trim();
          const sendDate = table.rows[rowIndex].cells[cellIndex + 2].textContent.trim();

          // Button Settings
          const button = document.createElement("button");
          button.innerHTML = "Preview";
          button.style.backgroundColor = "rgb(0, 169, 250)";  // Blue background
          button.style.color = "white";  // White text
          button.style.border = "none";  // No border
          button.style.borderRadius = "10px";  // No border
          button.style.padding = "10px 15px";  // Padding
          button.style.margin = "2px 10px";  // Margin
          button.style.cursor = "pointer";  // Cursor pointer
          button.style.position = "relative";
          button.className = 'previewMessage' // class name so it can be selected later

          button.onclick = function() {
            automatedCheck(templateName, sendDate, profileId, templateNameCell, button);
          };

          templateNameCell.appendChild(button);
        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
function createDateTimeString(dateTimeObject){
    const year = dateTimeObject.getFullYear();
    const month = String(dateTimeObject.getMonth() + 1).padStart(2, '0');
    const day = String(dateTimeObject.getDate()).padStart(2, '0');
    const hour = String(dateTimeObject.getHours()).padStart(2, '0');
    const minute = String(dateTimeObject.getMinutes()).padStart(2, '0');
    const second = String(dateTimeObject.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`
}
function automatedCheck(templateName, sendDate, profileId, templateNameCell, button) {
  button.textContent = "";

  // Spinner div
  const spinner = document.createElement("div");
  spinner.className = 'spinner';
  spinner.style.position = 'relative';
  button.appendChild(spinner);

  const startDateTime = new Date(sendDate);
  const endDateTime = new Date(sendDate)

  // since second value is missing initially, send log requires a bit of wiggle room. Increase search range by 1 minute either side
  startDateTime.setMinutes(startDateTime.getMinutes() - 1)
  endDateTime.setMinutes(endDateTime.getMinutes() + 1)

  // end date must be 1 day behind for some reason
  endDateTime.setDate(endDateTime.getDate() - 1);

  // Convert datetime to string for Send Log: YYYYMMDDhhmmss
  const formattedStartDateTime = createDateTimeString(startDateTime); // URL date
  const formattedEndDateTime = createDateTimeString(endDateTime); // URL date

  console.log(sendDate, formattedStartDateTime, formattedEndDateTime)

  // Construct the URL you want to navigate to
  const newURL = `https://my.sailthru.com/reports/transactional_log?start_date=${formattedStartDateTime}&end_date=${formattedEndDateTime}&template=${templateName}`;

  // Create an invisible iframe
  const iframe = document.createElement('iframe');

  // Show the hidden iframe if watchSearch is true. Can help with debugging, especially with a long newPageDelay
  if(watchSearch){
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '40%';
    iframe.style.height = '40%';
    iframe.style.border = '2px solid black';  // Optional, for visibility
  } else {
    iframe.style.display = 'none';
  }

  // Set iframe source to the new URL
  iframe.src = newURL;

  // Append iframe to body
  document.body.appendChild(iframe);

  let matchFound = false;
  let currentPage = 0

  // Listen for load event on iframe to start AJAX refresh checks
  iframe.onload = function() {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    let matchFound = false;
    let currentPage = 0;
    let rowCounter = 0; // Initialize a counter for rows checked

    const checkTable = function() {
      // Create iframe
      let iframeWindow = iframe.contentWindow;
      iframeWindow.addEventListener('error', function(event) {
        console.log("Network error occurred, stopping future requests.");
        clearInterval(intervalId);
      });

      const targetTable = iframeDocument.querySelector('.standard');
      const checkFailure = iframeDocument.querySelector('.row2 .row2');

      //Check to see if the end of the list was reached. If so, reset the button
      if (checkFailure && checkFailure.textContent.includes('You have not sent')) {
        button.innerHTML = "Error - Try Again";
        console.log("Error - Reached end of list. Please click the button again or try a longer delay.");
        return;
      }

      if (targetTable) {
        for (let row of targetTable.rows) {
          rowCounter++; // Increment row counter

          const cells = row.cells;

          const iframeTemplateName = cells[0].textContent.trim();
          const iframeProfileId = cells[1].textContent.trim();
          const iframeSendDate = cells[3].textContent.trim();

          // Stop early if the search is too far back
          if (new Date(sendDate) > new Date(iframeSendDate)){
            button.innerHTML = "Error - Try Again";
            console.log("Error - Past the send date. Please click the button again or try a longer delay.", iframeTemplateName, iframeSendDate, sendDate);

            clearInterval(intervalId); // Stop the interval if match is found
            return;
          }

          if (iframeTemplateName === templateName.trim() && iframeProfileId === profileId.trim() && iframeSendDate === sendDate.trim()) {
            matchFound = true;

            const magnifierCell = row.cells[6];
            const magnifierURL = magnifierCell.querySelector('.magnifier').getAttribute('href');

            // Link settings
            const templateLink = document.createElement('a');
            templateLink.href = magnifierURL;
            templateLink.target = '_blank';
            templateLink.style.textDecoration = 'underline';
            templateLink.style.color = '#333';  // Dark grey color
            templateLink.style.fontWeight = 'bold';
            templateLink.style.fontSize = 'larger';  // A font size or 2 larger

            templateLink.innerText = templateName;

            templateNameCell.innerHTML = ''; // Remove the previous content

            templateNameCell.appendChild(templateLink); // Add the new link

            button.removeChild(spinner);

            clearInterval(intervalId); // Stop the interval if match is found
            return;
          }
        }

        // If no match found, simulate AJAX refresh.
        if (!matchFound) {
          let iframeWindow = iframe.contentWindow;
          iframeWindow.eval(`
            if (true) {
              ajax.refresh(this, { start: ${(currentPage + 1) * 20} });
            }
          `);

          // Run checkTable again after the delay
          setTimeout(checkTable, newPageDelay);

          // Go to the next page
          currentPage++;
        }
      }
    };

    // Initially call checkTable
    checkTable();
  };
}
