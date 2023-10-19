// ==UserScript==
// @name        Email Composer - See Usage
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @match       https://my.sailthru.com/template/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds a button to show where the template is being used.
// ==/UserScript==

let buttonAdded = false;  // Flag to track if button is already added

// Create a function to start observing #header_nav_links for mutations
function observeHeaderNavLinks() {

    const targetNode = document.querySelector('#header_nav_links');
    if (!targetNode) return;

    const config = { attributes: true, childList: true, subtree: true };
    const observer = new MutationObserver(() => {

        if (buttonAdded) return;  // Exit if button is already added

        const btn = document.createElement('button');
        btn.textContent = 'Template Usage';
        btn.style.marginLeft = '5px'; // space between the buttons
        btn.style.marginTop = '15px'; // space between the buttons
        btn.style.marginBottom = '15px'; // space between the buttons
        btn.style.backgroundColor = 'rgb(0, 169, 250)'; // set button color
        btn.style.backgroundImage = 'none'; // set button color
        btn.style.border = 'none'; // remove border
        btn.style.borderRadius = '4px'; // round the edges
        btn.style.color = 'white'; // text color
        btn.style.padding = '5px 10px'; // padding for better appearance
        btn.style.cursor = 'pointer'; // hand cursor on hover
        btn.style.outline = 'none'; // remove focus outline
        btn.style.transition = 'opacity 0.2s'; // smooth transition
        const idMatch = window.location.href.match(/(\d+)/);
        if (idMatch) {
            const id = idMatch[1];
            btn.addEventListener('click', () => window.location.href = `https://my.sailthru.com/email-composer/${id}/usage`);
        }
        btn.onmouseover = () => btn.style.opacity = '0.7'; // reduce opacity on hover for a hover effect
        btn.onmouseout = () => btn.style.opacity = '1'; // revert opacity on mouse out

        const insertAfterElem = document.querySelector('#header_nav_links');
        if (insertAfterElem && insertAfterElem.parentNode) {
            insertAfterElem.appendChild(btn, insertAfterElem.nextSibling);

            buttonAdded = true;  // Set flag to true after adding button
            observer.disconnect();  // Stop observing since button is added
        }
    });

    observer.observe(targetNode, config);
}

// Start observing
observeHeaderNavLinks();
