// ==UserScript==
// @name        Email Test Send - Email Shorthands
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @match       https://my.sailthru.com/campaign*/design
// @match       https://my.sailthru.com/template/*
// @grant       none
// @version     1.2
// @author      Colin Whelan
// @description Adds a dropdown of emails for an easier time sending tests. In the Email Composer this will add an extra '_' at the end that must be removed -> due to how React handles the event changes, at least some manual update is required.
// ==/UserScript==

//User variables. Use underscores for auto conversion to title case
const emailConfigs = {
  'me': 'example@gmail.com',
  'work': 'example@workDomain.com',
  'both': 'example@workDomain.com,example@gmail.com',
  'test_accounts': 'example@gmail.com, example@aol.com',
  'all_accounts': 'example+1@gmail.com,example+2@gmail.com,example+3@gmail.com,example+4@gmail.com,example+5@gmail.com,example+6@gmail.com,example+7@gmail.com,example+8@gmail.com'
};

const shorthandPreviewChars = 40

// Script variables - Don't Edit!
const targetNode = document.body;

const observerConfig = {
  childList: true,
  subtree: true
};

function styleDropdown(dropdown) {
  dropdown.style.width = '100%';
  dropdown.style.height = '32px';
  dropdown.style.marginBottom = '10px';
  dropdown.style.padding = '0 10px';
  dropdown.style.fontSize = '16px';
  dropdown.style.lineHeight = '32px';
  dropdown.style.border = '1px solid #ccc';
  dropdown.style.borderRadius = '4px';
  dropdown.style.appearance = 'none'; // For removing the default appearance of dropdown in some browsers
  dropdown.style.background = 'white url("data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20fill=%22currentColor%22%20class=%22bi%20bi-chevron-down%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20fill-rule=%22evenodd%22%20d=%22M1.646%205.646a.5.5%200%200%201%20.708%200L8%2011.293l5.646-5.647a.5.5%200%200%201%20.708.708l-6%206a.5.5%200%200%201-.708%200l-6-6a.5.5%200%200%201%200-.708z%22/%3E%3C/svg%3E") no-repeat right 10px center';
  dropdown.style.backgroundSize = '16px 16px';
}

function formatShorthand(shorthand) {
  // Replace underscores with spaces and convert to title case
  return shorthand.replace(/_/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

function truncateEmails(emailStr, maxLength = shorthandPreviewChars) {
  if (emailStr.length <= maxLength) return emailStr;
  return emailStr.substring(0, maxLength) + '...';
}

function createDropdown(emailInput, selector, addUnderscore = false) {
  // Create the label and container for the dropdown
  const dropdownLabel = document.createElement('div');
  dropdownLabel.textContent = "Choose Shorthand...";
  dropdownLabel.classList.add('dropdown-label');
  styleDropdown(dropdownLabel);

  const dropdownContainer = document.createElement('div');
  dropdownContainer.classList.add('custom-dropdown');

  // Add the options to the dropdown
  for (let shorthand in emailConfigs) {
    const item = document.createElement('div');
    item.classList.add('dropdown-item');
    item.innerHTML = `<span>${formatShorthand(shorthand)}</span> <span class="preview">${truncateEmails(emailConfigs[shorthand])}</span>`;

    item.addEventListener('click', () => {
      emailInput.value = addUnderscore ? emailConfigs[shorthand] + "_" : emailConfigs[shorthand];
      dropdownContainer.style.display = 'none';
      dropdownLabel.textContent = formatShorthand(shorthand);
      if (addUnderscore) {
        checkForUnderscoreAndUpdateUI(emailInput.closest('.Modal__ModalContent-sc-yak2d3-2.LrNYw'));
      }
    });

    dropdownContainer.appendChild(item);
  }

  // Start collapsed
  dropdownContainer.style.display = 'none';

  // HTML Editor
  if(selector.toString() == '#test-email') {
    dropdownLabel.style.width = '75%'
    dropdownLabel.style.margin = '20px 20px 0px 20px'
  }
  // Campaign View
  else if(selector.toString() == '.test-email-input') {
    dropdownLabel.style.width = '75%'
  }

  // Handle the dropdown display on various events
  dropdownLabel.addEventListener('click', () => {
    dropdownContainer.style.display = dropdownContainer.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!dropdownContainer.contains(e.target) && e.target !== emailInput && e.target !== dropdownLabel) {
      dropdownContainer.style.display = 'none';
    }
  });

  // Insert the dropdown in the DOM
  emailInput.parentElement.insertAdjacentElement('beforebegin', dropdownLabel);
  emailInput.parentElement.insertAdjacentElement('beforebegin', dropdownContainer);
}

function injectDropdownForPage(modal, selector, addUnderscore = false) {
  // Check if the dropdown has already been added
  if (modal.getAttribute('data-custom-dropdown-injected')) return;

  // Find the email input field
  const emailInput = modal.querySelector(selector);
  if (!emailInput) return;

  // Create and insert the dropdown
  createDropdown(emailInput, selector, addUnderscore);

  // Mark the modal as having the dropdown
  modal.setAttribute('data-custom-dropdown-injected', 'true');
}

// Inject styles for the dropdown items and the preview
const style = document.createElement('style');
style.innerHTML = `
    .dropdown-item {
        padding: 8px;
        cursor: pointer;
    }
    .dropdown-item:hover {
        background-color: #e9e9e9;
    }
    .preview {
        color: grey;
    }
     .dropdown-label {
        display: block;
        padding: 6px 8px;  // Adjusted padding for vertical centering
        line-height: 20px;  // Added line-height for vertical centering
        cursor: pointer;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #fff;
        margin-bottom: 10px;
        text-align: left;
    }
    .custom-dropdown {
        position: absolute;
        border: 1px solid #ccc;
        background: #fff;
        width: 65%;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .Button__ButtonWrapper-sc-49mtrn-0.ckGjOY:disabled:hover {
        background-color: #cccccc !important; // Keep it gray on hover
    }
`;
document.head.appendChild(style);

const observerCallback = (mutationsList) => {
    for (let mutation of mutationsList) {
        if (mutation.type === 'childList') {
            const emailComposerModal = document.querySelector('.Modal__ModalContent-sc-yak2d3-2.LrNYw');
            if (emailComposerModal) {
              injectDropdownForPage(emailComposerModal, '.Input-sc-18zl22b-0.lcngyG', true);
            }
            const campaignDesignModal = document.querySelector('.test_send_popup');
            if (campaignDesignModal) {
              injectDropdownForPage(campaignDesignModal, '.test-email-input');
            }
            const htmlComposerModal = document.querySelector('.ui-dialog.ui-widget.ui-widget-content.ui-corner-all.ui-front.ui-draggable.ui-resizable');
            if (htmlComposerModal) {
              injectDropdownForPage(htmlComposerModal, '#test-email');
            }
        }
    }
};

const observer = new MutationObserver(observerCallback);
observer.observe(targetNode, observerConfig);
