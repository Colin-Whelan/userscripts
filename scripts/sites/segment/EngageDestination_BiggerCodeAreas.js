// ==UserScript==
// @name        Engage/Destination - Bigger Text Areas
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*
// @match       https://app.segment.com/*/engage/spaces/*/audiences/*
// @match       https://app.segment.com/*
// @grant       GM_addStyle
// @version     1.1
// @author      Colin Whelan
// @description Makes text areas for JSON bigger and easier to work with. Makes 'New Audience' a bit better. 
// ==/UserScript==

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
