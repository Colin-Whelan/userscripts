// ==UserScript==
// @name        Engage/Destination - Bigger Text Areas
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*
// @match       https://app.segment.com/*/engage/spaces/*/audiences/*
// @match       https://app.segment.com/*
// @grant       GM_addStyle
// @version     1.3
// @author      Colin Whelan
// @description Adds these improvements:
// - Makes text areas for JSON bigger and easier to work with.
// - Makes 'New Audience' a bit better.
// - Makes 'And who/And who not' more visible.
// - Audience window takes full space.
// - Option for custom tooltips in audience conditions.
// - Adds custom quick links to the sidebar
// ==/UserScript==


const addConditionTooltips = false

const tips = [
  `API Event+Payload`, // event
  `Part of a List`, // audience
  `Campaign interactions or test groups`, // computedTrait
  `Customer flags`, // sql
  `Customer details(PII)` // customTrait
]

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
          if (node.role == 'dialog' && node.attributes['data-state'] && node.attributes['data-state'].value && node.textContent != 'AudienceFolder') {
            if (node.querySelector('.📦otln_iu2jf4_1849h0v.📦bg_2u3whs_1849h0v.📦bs_iarjze_1849h0v').children[1].textContent != 'Performed an Event') return // some other similar element

            tooltipObserver.disconnect()
            node.style.width = '400px'

            // Set the parent element to a flex container to center its children
            const parentElement = node.parentElement; // Adjust this if the structure is different
            parentElement.style.display = 'flex';
            parentElement.style.justifyContent = 'center';
            parentElement.style.alignItems = 'center';
            parentElement.style.flexDirection = 'column';

            let childCount = 0

            for(let child of node.firstChild.children) {
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

function addQuicklinks(){
  // Parse the JSON structure
  const quicklinks = JSON.parse(quicklinksJson);

  // Target div where existing links are placed
  const targetDiv = document.querySelector('.fs-unmask.css-r8gsu9');

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
              const targetDiv = document.querySelector('.fs-unmask.css-r8gsu9');
              if (targetDiv && targetDiv.children[0]) {
                  // Stop observing
                  observer.disconnect();

                  // create the header and append it to the target div
                  if(!document.getElementById('quicklinksHeader')){
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
