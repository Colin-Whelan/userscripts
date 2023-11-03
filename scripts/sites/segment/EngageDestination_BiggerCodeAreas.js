// ==UserScript==
// @name        Engage/Destination - Bigger Text Areas
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*
// @match       https://app.segment.com/*/engage/spaces/*/audiences/*
// @match       https://app.segment.com/*
// @grant       GM_addStyle
// @version     1.2
// @author      Colin Whelan
// @description Makes text areas for JSON bigger and easier to work with. Makes 'New Audience' a bit better. Makes 'And who/And who not' more visible. Audience window takes full space. Option for custom tooltips in audience conditions.
// ==/UserScript==


const addConditionTooltips = false

const tips = [
  `event tip`, // event
  `audience tip`, // audience
  `computedTrait tip`, // computedTrait
  `sql tip`, // sql
  `customTrait tip` // customTrait
]

const urlPattern = /^https:\/\/app\.segment\.com\/[^\/]+\/engage\/spaces\/[^\/]+\/audiences\/new$/;
const currentUrl = window.location.href;

const isNewAudiencePage = urlPattern.test(currentUrl);

if(isNewAudiencePage){
  GM_addStyle(`
   .fade-in-simple { max-height: none !important; }  /* makes box take all available height */
  .📦dspl_flex .ub-box-szg_border-box button.📦ltr-spc_0 { border: 1px solid rgb(63, 68, 70) !important; }  /* Adds border to And/And not button */
  `);
}

const eventPreviewHeight = 550 // height for the event viewer editor area in px

// Define a function to adjust the CodeMirror size
function adjustCodeMirrorSize(codeMirrorContainer) {
    if (codeMirrorContainer) {
        // Calculate the available height
        const availableHeight = window.innerHeight - codeMirrorContainer.getBoundingClientRect().top;

        // Set the height to the calculated available height
        codeMirrorContainer.style.height = availableHeight * 0.8 + "px";
    }
}

// Create a MutationObserver to watch for changes
const observer = new MutationObserver((mutationsList, observer) => {
  const codeMirrorView = document.querySelector('.react-codemirror2 .CodeMirror')
    // Check if the target element is added to the DOM
    mutationsList.forEach((mutation) => {
        if (mutation.addedNodes.length && codeMirrorView) {
            adjustCodeMirrorSize(codeMirrorView); // Adjust the size when the element is added
            observer.disconnect();
        }
    });
});

// Start observing changes in the DOM
observer.observe(document.body, { childList: true, subtree: true });

// Create a MutationObserver to watch for changes
const eventViewObserver = new MutationObserver((mutationsList, eventViewObserver) => {
    let aceEditors = document.querySelectorAll('#ace-editor')
    // Check if the target element is added to the DOM
    mutationsList.forEach((mutation) => {
        // console.log(mutation.target)
        if (mutation.addedNodes.length && aceEditors.length) {
            eventViewObserver.disconnect();

            for (let i = 0; i < aceEditors.length; i++) {
              let aceEditor = aceEditors[i];

              if(aceEditor.style.height != `${eventPreviewHeight}px`){
                aceEditor.style.height = `${eventPreviewHeight}px`
                console.log(aceEditor)
              }
            }

            // start the observer again
            eventViewObserver.observe(document.body, { childList: true, subtree: true });
        }
    });
});

// Start observing changes in the DOM
eventViewObserver.observe(document.body, { childList: true, subtree: true });

// Function to insert styles for the tooltip
function insertTooltipStyles() {
  GM_addStyle(`
    .custom-tooltip {
      position: relative;
      display: inline-block;
      border-bottom: 1px dotted #222222; /* Optional style */
    }

    .custom-tooltip .tooltip-text {
      width: 200px;
      text-align: left;
    }

    .custom-tooltip:hover .tooltip-text {
      visibility: visible;
      opacity: 1;
    }
  `);
}

// Function to add tooltips
function addTooltips() {
  // Insert tooltip CSS styles
  insertTooltipStyles();

  // MutationObserver to watch for the specific span element
  const tooltipObserver = new MutationObserver((mutationsList, observer) => {


    for (let mutation of mutationsList) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.role == 'dialog' && node.attributes['data-state'] && node.attributes['data-state'].value) {
            tooltipObserver.disconnect()
            console.log('adding tooltips')
            node.style.width = '400px'

            // Set the parent element to a flex container to center its children
            const parentElement = node.parentElement; // Adjust this if the structure is different
            parentElement.style.display = 'flex';
            parentElement.style.justifyContent = 'center';
            parentElement.style.alignItems = 'center';
            parentElement.style.flexDirection = 'column';

            let childCount = 0

            for(let child of node.firstChild.children) {

              console.log(child)
              child.classList.add('custom-tooltip')
              child.classList.add('📦otln_iu2jf4_1849h0v', '📦bg_2u3whs_1849h0v', '📦bs_iarjze_1849h0v', 'ub-box-szg_border-box', '📦flx_1', '📦dspl_flex', '📦algn-itms_center', '📦flx-srnk_0', '📦ovflw-x_hidden', '📦ovflw-y_hidden', '📦pl_12px', '📦pr_12px');
              const tooltipDiv = document.createElement('div');
              tooltipDiv.className = 'tooltip-text';
              tooltipDiv.textContent = tips[childCount];
              child.appendChild(tooltipDiv);

              childCount++
            }



            tooltipObserver.observe(document.body, { childList: true, subtree: true });
          }
          else {
            if(node.attributes['data-state'] && node.attributes['data-state'].value){
              console.log(node.role, node.attributes['data-state'].value)
            }

          }
        });
      }
    }
  });

  // Start observing changes in the DOM for the tooltip
  tooltipObserver.observe(document.body, { childList: true, subtree: true });
}

// Call the function to start adding tooltips
if(addConditionTooltips){
  addTooltips();
}

