// ==UserScript==
// @name         Campaign Preview Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       Colin Whelan
// @match        https://app.iterable.com/campaigns/*
// @grant        none
// @description  Preview & prepare schedule times before launching, improved page layout with tighter spacing, and streamlined workflow for campaign scheduling
// ==/UserScript==

(function() {
    'use strict';

    let scheduledDateTime = null;
    let schedulePreviewUI = null;

    // Debug flag - set to true to enable console logging
    const _DEBUG = false;

    // Logging helper
    function log(message, data = null) {
        if (!_DEBUG) return;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Iterable Schedule Preview ${timestamp}] ${message}`, data || '');
    }

    // Add CSS overrides to improve page layout
    function addCSSOverrides() {
        log('Adding CSS overrides for better page layout');

        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'iterable-schedule-preview-css';

        const css = `
            /* Reduce spacing between form fields */
            .sc-Nxspf + .sc-Nxspf {
                margin-top: 0.3rem !important;
            }

            /* Adjust section headers */
            .dlLwSQ {
                font-size: 0.8rem !important;
                margin: 1rem 0px 0.3rem !important;
            }

            /* Reduce bottom margin on containers */
            .cRjXNc {
                margin-bottom: 0.3rem !important;
            }
        `;

        style.innerHTML = css;

        // Check if styles already exist to avoid duplicates
        const existingStyle = document.getElementById('iterable-schedule-preview-css');
        if (existingStyle) {
            existingStyle.remove();
        }

        document.head.appendChild(style);
        log('CSS overrides applied successfully');
    }

    log('Userscript loaded and initialized');

    // Wait for page to load
    function waitForElement(selector, callback, timeout = 10000) {
        log(`Waiting for element: ${selector}`);
        const startTime = Date.now();
        const checkForElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                log(`Element found: ${selector}`);
                callback(element);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(checkForElement, 100);
            } else {
                log(`Timeout waiting for element: ${selector}`);
            }
        };
        checkForElement();
    }

    // Check if we're on the summary view
    function isOnSummaryView() {
        const isSummary = window.location.href.includes('view=Summary') ||
               window.location.search.includes('view=Summary') ||
               !window.location.search.includes('view=');
        log(`Is on summary view: ${isSummary}`, window.location.href);
        return isSummary;
    }

    // Create the schedule preview UI
    function createSchedulePreviewUI(notLaunchedElement) {
        log('Creating schedule preview UI');
        // Find the parent container for the launch time field
        const launchTimeField = notLaunchedElement.closest('[data-test="form-field"]');
        if (!launchTimeField) {
            log('ERROR: Could not find launch time field container');
            return;
        }
        log('Found launch time field container');

        // Store reference to the prepare button for the clear function
        const prepareButton = document.querySelector('.prepare-schedule-btn');

        // Create container for our UI
        const container = document.createElement('div');
        container.style.cssText = `
            margin-top: 12px;
            padding: 16px;
            border: 2px dashed #e0e0e0;
            border-radius: 8px;
            background-color: #f9f9f9;
            font-family: inherit;
        `;

        // Create header with NOT LAUNCHED flag
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        `;

        const notLaunchedFlag = document.createElement('span');
        notLaunchedFlag.textContent = 'NOT LAUNCHED';
        notLaunchedFlag.style.cssText = `
            background-color: #ff9800;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        `;

        const title = document.createElement('span');
        title.textContent = 'Schedule Preview';
        title.style.cssText = `
            font-weight: 600;
            color: #333;
        `;

        header.appendChild(notLaunchedFlag);
        header.appendChild(title);

        // Create date input
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.cssText = `
            margin-right: 12px;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: inherit;
        `;

        // Create time input
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.style.cssText = `
            margin-right: 12px;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: inherit;
        `;

        // Set default values (current date, current time + 1 hour)
        const now = new Date();
        const defaultDate = now.toISOString().split('T')[0];
        const defaultTime = new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

        dateInput.value = defaultDate;
        timeInput.value = defaultTime;

        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        `;

        inputContainer.appendChild(dateInput);
        inputContainer.appendChild(timeInput);

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
        `;

        // Create Confirm Schedule Time button
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm Schedule Time';
        confirmButton.style.cssText = `
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-weight: 600;
        `;

        confirmButton.addEventListener('click', () => {
            const dateValue = dateInput.value;
            const timeValue = timeInput.value;

            log('Confirm Schedule Time clicked', { date: dateValue, time: timeValue });

            if (!dateValue || !timeValue) {
                log('ERROR: Date or time not selected');
                alert('Please select both date and time');
                return;
            }

            scheduledDateTime = {
                date: dateValue,
                time: timeValue
            };

            log('Scheduled date/time set', scheduledDateTime);

            // Click the schedule button to open modal
            openScheduleModal();
        });

        // Create Clear button (which also hides the panel)
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear & Hide';
        clearButton.style.cssText = `
            background-color: #f44336;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-weight: 600;
        `;

        clearButton.addEventListener('click', () => {
            log('Clear & Hide button clicked - resetting and hiding panel');
            dateInput.value = defaultDate;
            timeInput.value = defaultTime;
            scheduledDateTime = null;

            // Hide the panel and restore the prepare button
            container.remove();
            schedulePreviewUI = null;

            // Restore the prepare button text and color
            if (prepareButton) {
                prepareButton.textContent = 'Prepare Schedule Time';
                prepareButton.style.backgroundColor = '#2196F3'; // Restore original blue color
                log('Restored prepare button text and color');
            }
        });

        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(clearButton);

        // Assemble the UI
        container.appendChild(header);
        container.appendChild(inputContainer);
        container.appendChild(buttonContainer);

        // Insert after the launch time field
        launchTimeField.insertAdjacentElement('afterend', container);
        log('Schedule preview UI created and inserted into page');

        return container;
    }

    // Open the schedule modal and populate it
    function openScheduleModal() {
        log('Attempting to open schedule modal');
        const scheduleButton = document.querySelector('[data-test="schedule-button"]');
        if (!scheduleButton) {
            log('ERROR: Schedule button not found');
            alert('Schedule button not found. Please make sure you are on the campaign summary page.');
            return;
        }

        log('Schedule button found, clicking it');
        // Click the schedule button
        scheduleButton.click();

        // Wait for modal to appear and populate it
        log('Waiting 500ms for modal to appear');
        setTimeout(() => {
            populateScheduleModal();
        }, 500);
    }

    // Populate the schedule modal with our pre-selected date/time
    function populateScheduleModal() {
        if (!scheduledDateTime) {
            log('ERROR: No scheduled date/time set');
            return;
        }

        log('Starting to populate schedule modal', scheduledDateTime);

        // Wait for modal elements to be available
        const checkAndPopulate = (attempts = 0) => {
            log(`Attempting to find modal inputs (attempt ${attempts + 1}/20)`);
            const dateInput = document.querySelector('#scheduleCampaignStartDateAndTime');
            const timeInput = document.querySelector('#typeahead-input');

            log('Modal input elements found:', {
                dateInput: !!dateInput,
                timeInput: !!timeInput
            });

            if (dateInput && timeInput && attempts < 20) {
                // Format date for the modal (MM/DD/YYYY)
                const [year, month, day] = scheduledDateTime.date.split('-');
                const formattedDate = `${month}/${day}/${year}`;

                // Format time for the modal (convert 24h to 12h format)
                const [hours, minutes] = scheduledDateTime.time.split(':');
                const hour12 = parseInt(hours) % 12 || 12;
                const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
                const formattedTime = `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;

                log('Formatted values for modal:', {
                    originalDate: scheduledDateTime.date,
                    formattedDate: formattedDate,
                    originalTime: scheduledDateTime.time,
                    formattedTime: formattedTime
                });

                // Set the date
                log('Setting date input value');
                dateInput.value = formattedDate;
                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                dateInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Set the time
                log('Setting time input value');
                timeInput.value = formattedTime;
                timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                timeInput.dispatchEvent(new Event('change', { bubbles: true }));

                log('Schedule modal populated successfully with:', formattedDate, formattedTime);
            } else if (attempts < 20) {
                log(`Modal inputs not ready, retrying in 200ms...`);
                setTimeout(() => checkAndPopulate(attempts + 1), 200);
            } else {
                log('ERROR: Could not find modal inputs after 20 attempts');
            }
        };

        checkAndPopulate();
    }

    // Add the "Prepare Schedule Time" button
    function addPrepareScheduleButton(notLaunchedElement) {
        log('Adding Prepare Schedule Time button');
        // Check if button already exists
        if (notLaunchedElement.parentElement.querySelector('.prepare-schedule-btn')) {
            log('Button already exists, skipping');
            return;
        }

        const button = document.createElement('button');
        button.textContent = 'Prepare Schedule Time';
        button.className = 'prepare-schedule-btn';
        button.style.cssText = `
            margin-left: 12px;
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
        `;

        button.addEventListener('click', () => {
            log('Prepare Schedule Time button clicked');
            if (schedulePreviewUI) {
                log('Schedule preview UI already exists, ignoring click');
                return;
            } else {
                log('Creating new schedule preview UI');
                schedulePreviewUI = createSchedulePreviewUI(notLaunchedElement);
                button.textContent = 'Schedule Preview Active';
                button.style.backgroundColor = '#4CAF50'; // Change to green when active
            }
        });

        // Add button next to the "Not launched" text
        notLaunchedElement.parentElement.appendChild(button);
        log('Prepare Schedule Time button added successfully');
    }

    // Initialize the script
    function initialize() {
        log('Initializing script');

        // Add CSS overrides first
        addCSSOverrides();

        if (!isOnSummaryView()) {
            log('Not on summary view, skipping initialization');
            return;
        }

        log('On summary view, looking for "Not launched" element');

        // Try multiple selectors to find the "Not launched" text
        const selectors = [
            '[data-test="form-readonly-field-scheduleStartTime"] span',
            '[data-test="form-readonly-field-scheduleStartTime"] .sc-eIECrE',
            '[data-test="form-readonly-field-scheduleStartTime"] .sc-fLdDTP',
            '[data-test="form-readonly-field-scheduleStartTime"]'
        ];

        let elementFound = false;

        const trySelector = (index = 0) => {
            if (index >= selectors.length) {
                log('ERROR: None of the selectors found the launch time element');
                return;
            }

            const selector = selectors[index];
            log(`Trying selector ${index + 1}/${selectors.length}: ${selector}`);

            waitForElement(selector, (element) => {
                if (elementFound) return; // Prevent multiple matches

                log('Found element with selector:', selector);
                log('Element content:', element.textContent.trim());
                log('Element HTML:', element.outerHTML.substring(0, 200) + '...');

                // Check if this element or its children contain "Not launched"
                const textContent = element.textContent.trim();
                if (textContent === 'Not launched' || textContent.includes('Not launched')) {
                    log('Campaign is not launched, adding prepare schedule button');
                    elementFound = true;

                    // Find the span with "Not launched" text specifically
                    let targetElement = element;
                    if (element.tagName !== 'SPAN') {
                        const spanElement = element.querySelector('span');
                        if (spanElement && spanElement.textContent.trim().includes('Not launched')) {
                            targetElement = spanElement;
                        }
                    }

                    // Hide the original "Not launched" text since we'll show our own
                    targetElement.style.display = 'none';
                    log('Hidden original "Not launched" text');

                    addPrepareScheduleButton(targetElement);
                } else {
                    log('Campaign already launched or different status, not adding button');
                }
            }, 2000); // Shorter timeout per selector

            // Try next selector after a delay if this one doesn't work
            setTimeout(() => {
                if (!elementFound) {
                    trySelector(index + 1);
                }
            }, 2500);
        };

        trySelector();
    }

    // Run on page load and navigation changes
    log('Running initial initialization');
    initialize();

    // Handle SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            log('URL changed, re-initializing', { from: lastUrl, to: url });
            lastUrl = url;
            setTimeout(initialize, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    log('Script setup complete - mutation observer active');

})();
