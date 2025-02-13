// ==UserScript==
// @name        Email Composer - See Usage
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @match       https://my.sailthru.com/template/*
// @grant       GM_addStyle
// @version     1.7
// @run-at      document-idle
// @author      Colin Whelan
// @description Shows live template usage status on page load
// ==/UserScript==



GM_addStyle(`
        .FileManager_fileManager__sagQH .FileManager_fileManagerDropbox__sagQH {
        top: 58px !important;
        }
`);

let templateId;

function addStylesheet() {
    const style = document.createElement('style');
    style.textContent = `
        .template-usage-status {
            margin: auto 8px;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 12px;
            cursor: pointer;
            transition: opacity 0.2s;
            display: inline-block;
            font-weight: 500;
        }
        .template-usage-status:hover {
            opacity: 0.8;
        }
        .status-active {
            background-color: #FF4444;
            color: white;
        }
        .status-inactive {
            background-color: #FF9500;
            color: white;
        }
        .status-none {
            background-color: #4CD964;
            color: white;
        }
        .status-loading {
            background-color: #999;
            color: white;
        }

    `;
    document.head.appendChild(style);
}

async function fetchTemplateUsage(templateId) {
    try {
        const response = await fetch(`https://my.sailthru.com/uiapi/lifecycle/?template_id=${templateId}`);
        if (!response.ok) throw new Error('Failed to fetch template usage');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching template usage:', error);
        return null;
    }
}

function createStatusElement(usage) {
    const container = document.createElement('div');
    container.classList.add('template-usage-status');

    if (!usage) {
        container.textContent = '...';
        container.classList.add('status-loading');
        return container;
    }

    const activeCount = usage.filter(flow => flow.status === 'active').length;
    const inactiveCount = usage.filter(flow => flow.status === 'inactive').length;
    const maxCount = Math.max(activeCount, inactiveCount);

    // Format text showing both counts with pluralization based on max value
    container.textContent = `${activeCount}(${inactiveCount}) ${maxCount === 1 ? 'LO' : 'LOs'}`;

    if (activeCount > 0) {
        container.classList.add('status-active');
    } else if (inactiveCount > 0) {
        container.classList.add('status-inactive');
    } else {
        container.classList.add('status-none');
    }

    container.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = `https://my.sailthru.com/email-composer/${templateId}/usage`;
        link.target = '_blank';
        link.click();
    });

    return container;
}

async function addStatusIndicator() {
    const insertAfterElem = document.querySelector('#header_nav_links');
    if (!insertAfterElem) return;

    const idMatch = window.location.href.match(/(\d+)/);
    if (!idMatch) return;

    templateId = idMatch[1];

    const statusElement = createStatusElement(null);
    insertAfterElem.appendChild(statusElement);

    const usageData = await fetchTemplateUsage(templateId);
    const updatedStatusElement = createStatusElement(usageData);
    insertAfterElem.replaceChild(updatedStatusElement, statusElement);
}

addStylesheet();
addStatusIndicator();
