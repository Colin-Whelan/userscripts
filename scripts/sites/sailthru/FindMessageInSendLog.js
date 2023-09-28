// ==UserScript==
// @name        Find That Message
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/user_profile?id=*
// @grant       none
// @version     1.1
// @author      -
// @description 2023-09-28, 1:28:40 p.m.
// ==/UserScript==

// Choose a speed to search at. The faster the search the more likely a result is to be missed and require a re-run
const newPageDelay = 150 // (ms) How long to look at each page for before loading the next page. <100 = Fast, ~150 = normal, 200+ = slow
const watchSearch = true // Toggle to true to watch the search for the message in real time

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

  //Need to test to make sure this is consistent across clients/accounts
  const profileId = document.querySelector('#profile-overview .pv2:nth-of-type(2) .pl3 strong').innerHTML.trim();

  if (dataCell.innerHTML) {
    observer.disconnect(); // Stop observing

    // Get the target table header cell
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

      function triggerNextButton() {
        if (index < buttons.length) {
          buttons[index].click();
          index++;
          triggerNextButton();
        }
      }

      triggerNextButton();
    });

    for (let row of table.rows) {
      for (let cell of row.cells) {
        if (cell.textContent.trim() === 'Triggered' || cell.textContent.trim() === 'Transactional') {
          const rowIndex = cell.parentNode.rowIndex;
          const cellIndex = cell.cellIndex;

          const templateCell = table.rows[rowIndex].cells[cellIndex - 2];
          const templateName = templateCell.textContent.trim();
          const sendDate = table.rows[rowIndex].cells[cellIndex + 2].textContent.trim();

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
          button.className = 'previewMessage'

          button.onclick = function() {
            automatedCheck(templateName, sendDate, profileId, templateCell, button);
          };

          templateCell.appendChild(button);


        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function automatedCheck(templateName, sendDate, profileId, templateCell, button) {
  button.textContent = "";

  const spinner = document.createElement("div");
  spinner.className = 'spinner';
  spinner.style.position = 'relative';
  button.appendChild(spinner);

  // Convert the sendDate to MM%2FDD%2FYYYY format
  const sendDateObj = new Date(sendDate);
  const year = sendDateObj.getFullYear();
  const month = String(sendDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(sendDateObj.getDate()).padStart(2, '0');

  const formattedDate = `${month}%2F${day}%2F${year}`;

  // Construct the URL you want to navigate to
  const newURL = `https://my.sailthru.com/reports/transactional_log?start_date=${formattedDate}&end_date=${formattedDate}&template=${templateName}`;

  // Create an invisible iframe
  const iframe = document.createElement('iframe');

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


  // Listen for load event on iframe to start AJAX refresh checks
  let matchFound = false;
  let currentPage = 0

  iframe.onload = function() {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    let matchFound = false;
    let currentPage = 0;
    let rowCounter = 0; // Initialize a counter for rows checked

    const checkTable = function() {
      let iframeWindow = iframe.contentWindow;
      iframeWindow.addEventListener('error', function(event) {
        console.log("Network error occurred, stopping future requests.");
        clearInterval(intervalId);
      });

      const targetTable = iframeDocument.querySelector('.standard');
      const checkFailure = iframeDocument.querySelector('.row2 .row2');
      if (checkFailure && checkFailure.textContent.includes('You have not sent')) {
        // Reset the button here
        button.innerHTML = "Error - Try Again";
        console.log("Error. Probably too fast. Please click again or try a longer delay.");
        return;
      }

      if (targetTable) {
        for (let row of targetTable.rows) {
        rowCounter++; // Increment row counter
          const cells = row.cells;

          const iframeTemplateName = cells[0].textContent.trim();
          const iframeProfileId = cells[1].textContent.trim();
          const iframeSendDate = cells[3].textContent.trim();

          if (iframeTemplateName === templateName.trim() && iframeProfileId === profileId.trim() && iframeSendDate === sendDate.trim()) {
            // console.log('Match found');
            matchFound = true;

            const magnifierCell = row.cells[6];
            const magnifierURL = magnifierCell.querySelector('.magnifier').getAttribute('href');

            const templateLink = document.createElement('a');
            templateLink.href = magnifierURL;
            templateLink.target = '_blank';
            templateLink.style.textDecoration = 'underline';
            templateLink.style.color = '#333';  // Dark grey color
            templateLink.style.fontWeight = 'bold';
            templateLink.style.fontSize = 'larger';  // A font size or 2 larger

            templateLink.innerText = templateName;

            templateCell.innerHTML = '';
            templateCell.appendChild(templateLink);

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
              ajax.refresh(ajax.refresh(this, { start: ${(currentPage + 1) * 20} }));
            }
          `);

          // Run checkTable again after a delay
          setTimeout(checkTable, newPageDelay);

          currentPage++;
        }
      }
    };

    // Initially call checkTable
    checkTable();
  };
}


