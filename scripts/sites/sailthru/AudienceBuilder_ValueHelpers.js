// ==UserScript==
// @name        Audience Builder | Value Helpers
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/audience_builder#/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds helper rules based on input fields + aligns is/contains/exists selector with the field/value inputs.
// ==/UserScript==

(function() {
    'use strict';

    // CSS to fix rendering when helper is added
    const css = `
    .value-inputfield, .c.c-120.mh2.pt1.mt3, .var-selector {
      margin-bottom: auto !important;
    }
    .c.c-120.mh2.pt1.mt3 {
      margin-top: 28px !important;
    }
    .value-inputfield {
      margin-top: 6px !important;
    }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    // Key-value pairs for fields and their helper texts
    const fieldHelpers = {
        'abc': 'test value, not for use in PROD',
        'membershipNumber': 'starts <b>001</b> <br>VIP accounts end in "_99"',
        // Add more fields here as needed
    };

    // Function to add custom helper text
    function addHelperText(element, field) {
        // remove existing helper texts
        removeHelperText(element)

        const helperDiv = document.createElement('div');
        const helperText = fieldHelpers[field]

        helperDiv.innerHTML = helperText;
        helperDiv.classList = ['custom-helper-text'];
        helperDiv.style.cssText = 'margin-top: 5px; font-size: 12px; color: grey;';
        element.appendChild(helperDiv);
    }

    // Function to remove custom helper text
    function removeHelperText(element) {
        const existingHelper = element.parentNode.querySelector('.custom-helper-text');
        if (existingHelper) {
            console.log('removing existing helper', existingHelper)
            existingHelper.remove();
        }
    }

    // Observer for changes in the DOM
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.classList && (node.classList.contains('element') || node.classList.contains('stui-selector__single-value'))) {
                    const inputField = node.querySelector('.stui-selector__single-value') || node;
                    const conditionContainer = inputField.closest('.criteria-body')?.querySelector('.value-inputfield');

                    if (conditionContainer) {
                        let foundMatch = false;
                        for (const field of Object.keys(fieldHelpers)) {
                            if (inputField.textContent === field) {
                                foundMatch = true;
                                addHelperText(conditionContainer, field);
                                break;
                            }
                        }

                        if (!foundMatch) {
                            removeHelperText(conditionContainer);
                        }
                    }
                }
            }
        }
    });


    // Options for the observer (which mutations to observe)
    const config = { childList: true, subtree: true };

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);
})();
