// ==UserScript==
// @name        Templates List - Create Campaign From Template
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       none
// @version     1.2
// @author      Colin Whelan
// @description Adds an icon on template row hover to create Campaign with same name as the Template.
// Add a default target and suppression list below.
// ==/UserScript==

(function() {
    'use strict';

    // Both are required for the Audience details to be set.
    const defaultTargetList = 'Default Target List Name'
    const defaultSuppressionList = 'Default Suppression List Name'

    function showModal(content, isError, blastId = null) {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        backdrop.style.zIndex = '9999';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'flex-start';
        backdrop.style.paddingTop = '10vh';

        const modal = document.createElement('div');
        modal.style.backgroundColor = isError ? '#ffcccc' : '#ccffcc';
        modal.style.padding = '20px';
        modal.style.borderRadius = '15px';
        modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        modal.style.maxWidth = '90%';
        modal.style.maxHeight = '90%';
        modal.style.overflowY = 'auto';

        if (blastId) {
            const campaignLink = `https://my.sailthru.com/campaign#${blastId}`;
            content = `<a href="${campaignLink}" target="_blank" style="color: black; font-weight: bold; text-decoration: underline;">View Campaign</a><br><br>` + content;
        }

        modal.innerHTML = `<pre class="code" style="white-space: pre-wrap;">${content}</pre>`;

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '20px';
        closeButton.onclick = function() { backdrop.remove(); };

        backdrop.addEventListener('click', function(event) {
            if (event.target === backdrop) {
                backdrop.remove();
            }
        });

        modal.appendChild(closeButton);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    }

    function processTableRows() {
        const tableRows = document.querySelectorAll('#stui-table-templates-list table tbody tr');

        if (tableRows.length > 0) {
            tableRows.forEach((row, index) => {
                // Skip if the row already has our button
                if (row.querySelector('.fal.fa-rocket')) return;

                const templateName = row.cells[3].textContent.trim();
                const rawLabels = row.cells[5].textContent.trim();

                let labelsObj = {};
                if (rawLabels !== '—') {
                    rawLabels.split(',').forEach(label => {
                        labelsObj[label.trim()] = 1;
                    });
                }

                const button = document.createElement('i');
                button.className = 'fal fa-rocket sc-bxivhb JxMSQ';
                button.title = 'Create Campaign';
                button.style.cursor = 'pointer';
                button.setAttribute('aria-hidden', 'true');

                button.addEventListener('click', function(event) {
                    event.stopPropagation();

                    const paramsValue = {
                        "name": templateName,
                        "list": defaultTargetList,
                        "schedule_time": "",
                        "copy_template": templateName,
                        "suppress_list": defaultSuppressionList,
                        "labels": labelsObj
                    };

                    const formData = `method=POST&action=blast&params=${encodeURIComponent(JSON.stringify(paramsValue)).replaceAll('%20','+').replaceAll('!','%21')}`;

                    fetch('https://my.sailthru.com/api/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData,
                        credentials: 'include'
                    })
                    .then(response => response.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, "text/html");
                        const preCode = doc.querySelector('pre.code');

                        if (preCode) {
                            try {
                                const jsonResponse = JSON.parse(preCode.textContent);
                                if (jsonResponse.error) {
                                    showModal(jsonResponse.errormsg, true);
                                } else {
                                    jsonResponse.content_html = "hidden for brevity";
                                    jsonResponse.content_text = "hidden for brevity";
                                    showModal(JSON.stringify(jsonResponse, null, 2), false, jsonResponse.blast_id);
                                }
                            } catch (e) {
                                showModal('Response parsing error: ' + e.toString(), true);
                            }
                        } else {
                            showModal('No detailed response found.', true);
                        }
                    })
                    .catch(error => showModal('Error: ' + error.toString(), true));
                });

                const actionCell = row.querySelector('td:last-child');
                if (actionCell) {
                    actionCell.querySelectorAll('span')[1].appendChild(button);
                }
            });
        }
    }

    window.addEventListener('load', function() {
        const targetNode = document.querySelector('#stui-table-templates-list table tbody');

        if (targetNode) {
            // Process existing rows
            processTableRows();

            // Set up observer for future changes
            const observer = new MutationObserver(() => {
                processTableRows();
            });

            observer.observe(targetNode, { childList: true });
        } else {
            console.error('!Templates List!: The target node was not found.');
        }
    });
})();
