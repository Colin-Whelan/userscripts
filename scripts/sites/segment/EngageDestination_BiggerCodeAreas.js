// ==UserScript==
// @name        Engage/Destination - Bigger Text Areas
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*
// @match       https://app.segment.com/*/engage/spaces/*/audiences/*
// @match       https://app.segment.com/*
// @grant       GM_addStyle
// @version     1.5
// @author      Colin Whelan
// @description Adds these improvements:
// - Makes text areas for JSON bigger and easier to work with.
// - Makes 'New Audience' a bit better.
// - Makes 'And who/And who not' more visible.
// - Audience window takes full space.
// - Adds custom quick links to the sidebar
// ==/UserScript==

// set to true to enable quicklinks (recommended)
const addCustomQuicklinks = false

const quicklinksJson = `[
{
    "textToShow": "Custom Link 1",
    "url": "engage/spaces/instanceName/audiences/new"
},
{
    "textToShow": "Custom Link 2",
    "url": "unify/spaces/instanceName/explorer"
},
{
    "textToShow": "Destinations",
    "url": "destinations"
},
{
    "textToShow": "Libraries",
    "url": "protocols/libraries"
}
]`;

const urlPattern = /^https:\/\/app\.segment\.com\/[^\/]+\/engage\/spaces\/[^\/]+\/audiences\/new$/;
const currentUrl = window.location.href;

const isNewAudiencePage = urlPattern.test(currentUrl);

if(isNewAudiencePage){
  GM_addStyle(`
    .fade-in-simple { max-height: calc(100vh - 300px) !important; }  /* makes box take all available height */
    .fade-in-simple { max-height: calc(100vh - 300px) !important; }  /* makes box take all available height */
    .📦dspl_flex .ub-box-szg_border-box button.📦ltr-spc_0 {
      border: 1px solid rgb(193, 196, 214) !important;  /* Adds border to all clickable properties */
      margin: 0 2px;
    }
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
                // console.log(aceEditor)
              }
            }

            // start the observer again
            eventViewObserver.observe(document.body, { childList: true, subtree: true });
        }
    });
});

// Start observing changes in the DOM
eventViewObserver.observe(document.body, { childList: true, subtree: true });

function addQuicklinks(){
  // Parse the JSON structure
  const quicklinks = JSON.parse(quicklinksJson);

  // Target div where existing links are placed
  const targetDiv = document.querySelector('.fs-unmask');

  // Function to create a link element
  function createLinkElement(text, url, i) {
      let workspace = document.querySelector('strong.css-1wa6wcq').textContent
      workspace = workspace.replaceAll(" ", "-").toLowerCase()
      const div = document.createElement('div');
      div.className = 'css-1c0qan';
      div.id = `quicklink_${i}`;
      div.innerHTML = `<a class="📦pl_16px 📦pr_16px 📦dspl_flex 📦algn-itms_center 📦flx-drct_row 📦color_white 📦pst_relative 📦h_40px 📦crsr_pointer 📦mb_8px 📦mt_8px ub-box-szg_border-box" href="/${workspace}/${url}">
                          <span class="📦fnt-sze_14px 📦f-wght_600 📦ln-ht_20px 📦ltr-spc_-0-05px 📦fnt-fam_b77syt 📦color_c1c4d6 📦ml_16px ub-box-szg_border-box">${text}</span>
                       </a>`;
      return div;
  }

  // Configuration of the observer:
  const config = { childList: true, subtree: true };

  // Callback function to execute when mutations are observed
  const callback = function(mutationsList, observer) {
      for(const mutation of mutationsList) {
          if (mutation.type === 'childList') {
              const targetDiv = document.querySelector('.fs-unmask');
              if (targetDiv && targetDiv.children[0]) {
                  console.log('Found: ', targetDiv)
                  // Stop observing
                  observer.disconnect();

                  // create the header and append it to the target div
                  if(!document.getElementById('quicklinksHeader')){
                    console.log('adding new quicklinksHeader', JSON.parse(quicklinksJson))
                    const header = document.createElement('div');
                    header.id = 'quicklinksHeader';
                    header.style.borderTop = '1px solid #ccc'; // Change the color as needed
                    // header.style.fontWeight = 'bold';
                    // header.style.fontSize = '18px';
                    header.style.textAlign = 'left';
                    header.style.marginTop = '10px'; // Adds space above the border
                    header.style.paddingTop = '10px';
                    header.classList.add('📦pl_16px','📦pl_16px','📦pr_16px','📦dspl_flex','📦algn-itms_center','📦flx-drct_row','📦color_white','📦pst_relative','📦h_40px','📦mb_8px','📦mt_8px','ub-box-szg_border-box')
                    header.innerHTML = '<span class="📦f-wght_600 📦ltr-spc_-0-05px 📦fnt-fam_b77syt 📦color_c1c4d6 📦ml_16px ub-box-szg_border-box" style=""><span style="font-size: 18px;line-height: 32px;">Quick Links</span></span>'

                    // Append the header to the target div
                    targetDiv.children[0].appendChild(header); // This will add the header at the top of the target div
                  }

                  // Add each quick link to the target div
                  quicklinks.forEach((link, index) => {
                      const linkElement = createLinkElement(link.textToShow, link.url, index);
                      if(document.querySelector(`#quicklink_${index}`)) return
                      targetDiv.children[0].appendChild(linkElement);
                      console.log(targetDiv)
                  });
              }
          }
      }
  };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);

  // Start observing the document body for configured mutations
  observer.observe(document.body, config);
}

// Call the function to start adding quicklinks
if(addCustomQuicklinks){
  addQuicklinks();
}
