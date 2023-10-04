// ==UserScript==
// @name        Email Composer - Toggle Structure
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     1.0
// @author      -
// @description Adds a 'Toggle Structure' button that makes differentiating between content blocks and rows easier. Doesn't affect the final send HTML.
// ==/UserScript==

let showStructureByDefault = true;

(function() {
    'use strict';

    function addButton(label, callback) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.marginLeft = '5px'; // space between the buttons
        btn.style.marginTop = '15px'; // space between the buttons
        btn.style.marginBottom = '15px'; // space between the buttons
        btn.style.backgroundColor = 'rgb(0, 169, 250)'; // set button color
        btn.style.border = 'none'; // remove border
        btn.style.borderRadius = '4px'; // round the edges
        btn.style.color = 'white'; // text color
        btn.style.padding = '5px 10px'; // padding for better appearance
        btn.style.cursor = 'pointer'; // hand cursor on hover
        btn.style.outline = 'none'; // remove focus outline
        btn.style.transition = 'opacity 0.2s'; // smooth transition
        btn.addEventListener('click', callback);
        btn.onmouseover = () => btn.style.opacity = '0.7'; // reduce opacity on hover for a hover effect
        btn.onmouseout = () => btn.style.opacity = '1'; // revert opacity on mouse out

        const insertAfterElem = document.querySelector('#header_nav_links');
        if (insertAfterElem && insertAfterElem.parentNode) {
            insertAfterElem.appendChild(btn, insertAfterElem.nextSibling);
        }

        if(showStructureByDefault){
          beePluginInstance.toggleStructure()
        }
    }

    // Wait until the beePluginInstance is available
    const interval = setInterval(() => {
        if (typeof beePluginInstance !== 'undefined' && document.querySelector('#bee_plugin_container')) {

            addButton('Toggle Outline', () => beePluginInstance.toggleStructure());
            // Native preview lets you preview with user data
            // addButton('Toggle Preview', () => beePluginInstance.togglePreview());
            //
            // Merge tags aren't enabled...
            // addButton('Toggle Merge Preview', () => beePluginInstance.toggleMergeTagsPreview());
            clearInterval(interval);
        }
    }, 1000);
})();
