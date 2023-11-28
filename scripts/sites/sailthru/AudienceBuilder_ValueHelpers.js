// ==UserScript==
// @name        Audience Builder | Value Helpers
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/audience_builder#/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Adds helper rules based on input fields.
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
        mutations.forEach(mutation => {
            // console.log(mutation)
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {

                    if (node.classList && node.classList.contains('element')) {
                      let inputField = node.querySelectorAll('.stui-selector__single-value')[0]
                      if(inputField){
                        let conditionContainer = inputField.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.querySelectorAll('.value-inputfield ')[0]
                        let foundMatch = false
                        // console.log('expanded container.')
                        Object.keys(fieldHelpers).forEach(field => {
                            if (inputField.textContent === field) {
                                foundMatch = true
                                addHelperText(conditionContainer, field);
                            }
                        });

                        if(!foundMatch){
                           removeHelperText(conditionContainer);
                        }
                      }
                    }
                    if (node.classList && node.classList.contains('stui-selector__single-value')) {
                        let conditionContainer = node.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.querySelectorAll('.value-inputfield ')[0]
                        let foundMatch = false
                        // Check each field in the key-value pair
                        Object.keys(fieldHelpers).forEach(field => {
                            if (node.textContent === field) {
                                foundMatch = true
                                removeHelperText(conditionContainer);
                                addHelperText(conditionContainer, field);
                            }
                        });

                        if(!foundMatch){
                           removeHelperText(conditionContainer);
                        }
                    }
                });
            }
        });
    });

    // Options for the observer (which mutations to observe)
    const config = { childList: true, subtree: true };

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);

})();
