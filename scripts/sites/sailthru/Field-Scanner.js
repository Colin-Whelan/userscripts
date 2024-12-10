// ==UserScript==
// @name        Field Scanner
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/field-scan*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @version     1.1
// @author      Colin Whelan
// @description Scans all fields in Sailthru and displays their counts from the entire audience. Shows 2 samples. Gives the option to download as CSV.
// ==/UserScript==

(function() {
  'use strict';
  document.title = "Field Scanner"

  // TEST MODE CONFIGURATION
  const TEST_MODE = false;
  const TEST_FIELDS = [
    "first_name",
    "last_name"
  ];

  // Debug mode for extra logging
  const DEBUG = false;

  function debugLog(...args) {
    if (DEBUG) {
      console.log(...args);
    }
  }


  // Helper function to format numbers with commas
  function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
  }

  async function fetchAllFields() {
    // If in test mode, return test fields instead of making API call
    if (TEST_MODE) {
      console.log('TEST MODE: Using test fields array:', TEST_FIELDS);
      return TEST_FIELDS;
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: "https://my.sailthru.com/uiapi/querybuilder/query/?term=*",
        headers: {
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        onload: function(response) {
          try {
            resolve(JSON.parse(response.responseText));
          } catch (error) {
            reject(new Error('Failed to parse JSON response'));
          }
        },
        onerror: reject
      });
    });
  }

  function downloadCSV(results) {
    // Define headers
    const headers = ['Field Name', 'Total Count', 'Email Count', 'Sample Profiles'];

    // Convert results to CSV rows
    const csvRows = results.map(result => {
        const sampleEmails = result.samples.map(s => s.email).join('; ');
        return [
            result.field,
            result.totalCount,
            result.emailCount,
            sampleEmails
        ];
    });

    // Combine headers and data
    const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(cell =>
            // Wrap in quotes if contains comma or is string
            typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
        ).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `field_scan_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function fetchFieldCount(fieldName) {
    const body = {
      sourceLists: {
        lists: ["LEAVE-AS-IS"],
        mode: "all",
        editing: false,
        valid: true,
        shouldSavePreference: false
      },
      criteriaMap: {
        "LEAVE-AS-IS": {
          key: "var_contains",
          criteria: "exists",
          field: fieldName,
          errors: {},
          readOnly: false
        }
      },
      criteriaArrangement: ["LEAVE-AS-IS"],
      focusedCriterion: "LEAVE-AS-IS",
      mode: "and",
      isOver: false,
      isAllCollapsed: false,
      isAllExpanded: true,
      isSmartListEdit: false,
      client_id: 1111 // doesn't need to be real ID. Leave as is.
    };

    debugLog(`Fetching count for field: ${fieldName}`);
    debugLog('Request body:', JSON.stringify(body, null, 2));

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://my.sailthru.com/uiapi/profilecounting?id=LEAVE-AS-IS",
        headers: {
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/json",
          "Origin": "https://my.sailthru.com",
          "Referer": "https://my.sailthru.com/audience_builder",
          "Cookie": document.cookie, // space details and whatnot are here. The rest of the headers are static.
          "DNT": "1",
          "Sec-GPC": "1",
          "Connection": "keep-alive",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin"
        },
        data: JSON.stringify(body),
        onload: function(response) {
          debugLog(`Raw response for ${fieldName}:`, {
            status: response.status,
            statusText: response.statusText,
            responseText: response.responseText,
            headers: response.responseHeaders
          });

          if (response.status !== 200) {
            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
            return;
          }

          try {
            debugLog(`RAW response for ${fieldName}:`, response);
            const result = JSON.parse(response.responseText);
            debugLog(`Parsed response for ${fieldName}:`, result);

            if (result && typeof result.count === 'number') {
              // Return an object with all the data we need
              resolve({
                count: result.count,
                emailCount: result.emailCount || 0,
                sample: result.sample || [],
                field: fieldName
              });
            } else {
              reject(new Error(`Invalid response format. Expected count property. Got: ${JSON.stringify(result)}`));
            }
          } catch (error) {
            console.error(`Error parsing response for ${fieldName}:`, {
              error: error,
              responseText: response.responseText
            });
            reject(new Error(`Failed to parse JSON response: ${error.message}`));
          }
        },
        onerror: function(error) {
          console.error(`Network error for ${fieldName}:`, error);
          reject(new Error(`Network error: ${error.message}`));
        },
        ontimeout: function() {
          reject(new Error('Request timed out'));
        }
      });
    });
}

function createScannerDashboard() {
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'field-scanner';
    dashboardContainer.innerHTML = `
      <div id="scanner-content">
        <div class="scanner-header">
          <h1>Field Scanner</h1>
          <div class="controls">
            <button id="refresh-button" class="control-button">Refresh Data</button>
            <button id="download-csv" class="control-button" disabled>Download CSV</button>
            <span id="last-updated"></span>
          </div>
        </div>
        <div class="results-grid" id="results-grid">
          <div class="loading">Loading fields...</div>
        </div>
      </div>
    `;

    const mainDiv = document.getElementById('main');
    if (mainDiv) {
      mainDiv.innerHTML = '';
      mainDiv.appendChild(dashboardContainer);
    }

    document.getElementById('refresh-button').addEventListener('click', scanFields);
    document.getElementById('download-csv').addEventListener('click', () => {
        const results = window.currentResults; // We'll set this in scanFields
        if (results && results.length) {
            downloadCSV(results);
        }
    });
}

async function scanFields() {
    try {
        const fields = await fetchAllFields();
        const resultsGrid = document.getElementById('results-grid');
        const downloadButton = document.getElementById('download-csv');


        downloadButton.disabled = true;

        // Create header
        const headerRow = document.createElement('div');
        headerRow.className = 'grid-row header';
        headerRow.innerHTML = `
            <div class="grid-cell">Field Name</div>
            <div class="grid-cell">Total Count</div>
            <div class="grid-cell">Email Count</div>
            <div class="grid-cell">Sample Profiles</div>
        `;

        resultsGrid.innerHTML = '';
        resultsGrid.appendChild(headerRow);

        // Add loading indicator
        const loadingRow = document.createElement('div');
        loadingRow.className = 'grid-row loading-row';
        loadingRow.innerHTML = '<div class="grid-cell">Scanning fields... (0/${fields.length})</div>';
        resultsGrid.appendChild(loadingRow);

        // Process fields
        let results = [];
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            loadingRow.innerHTML = `<div class="grid-cell">Scanning fields... (${i + 1}/${fields.length})</div>`;

            try {
                const data = await fetchFieldCount(field);
                results.push({
                    field,
                    totalCount: data.count,
                    emailCount: data.emailCount,
                    samples: data.sample?.slice(0, 2) || []
                });
            } catch (error) {
                console.error(`Error fetching count for ${field}:`, error);
                results.push({
                    field,
                    totalCount: 'Error',
                    emailCount: 'Error',
                    samples: []
                });
            }
        }

        // Remove loading row
        loadingRow.remove();

        // Sort results by total count (descending)
        results.sort((a, b) => {
            const countA = typeof a.totalCount === 'number' ? a.totalCount : -1;
            const countB = typeof b.totalCount === 'number' ? b.totalCount : -1;
            return countB - countA;
        });


        window.currentResults = results; // Store results for CSV download
        downloadButton.disabled = false;  // Enable download button

        // Display results
        results.forEach((result, index) => {
            const row = document.createElement('div');
            row.className = `grid-row ${index % 2 === 0 ? 'even' : 'odd'}`;

            const sampleHtml = result.samples.map(sample =>
                `<div class="sample-email">
                    <a href="https://my.sailthru.com/reports/user_profile?id=${sample.id}"
                       target="_blank"
                       title="ID: ${sample.id}">${sample.email}</a>
                 </div>`
            ).join('');

            row.innerHTML = `
                <div class="grid-cell fieldname">${result.field}</div>
                <div class="grid-cell totalcount">${typeof result.totalCount === 'number' ? formatNumber(result.totalCount) : result.totalCount}</div>
                <div class="grid-cell validcount">${typeof result.emailCount === 'number' ? formatNumber(result.emailCount) : result.emailCount}</div>
                <div class="grid-cell samples">${sampleHtml}</div>
            `;
            resultsGrid.appendChild(row);
        });

        document.getElementById('last-updated').textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Error scanning fields:', error);
        document.getElementById('results-grid').innerHTML =
            '<div class="error">Error loading fields. Please try again.</div>';
        document.getElementById('download-csv').disabled = true;
    }
}

    // Test function to try a single field
  async function testSingleField(fieldName) {
    try {
      console.log(`Testing field: ${fieldName}`);
      const count = await fetchFieldCount(fieldName);
      console.log(`Success! Count for ${fieldName}: ${count}`);
    } catch (error) {
      console.error(`Test failed for ${fieldName}:`, error);
    }
  }

  // Add this at the bottom of your script to run a single test
  if (TEST_MODE && TEST_FIELDS.length > 0) {
    console.log('Running test for single field...');
    testSingleField(TEST_FIELDS[0]);
  }

  // Add styles
  GM_addStyle(`
      #field-scanner {
        padding: 20px;
    }

    .scanner-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .scanner-header h1 {
        margin: 0;
        color: #333;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .control-button {
        background: #0066cc;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }

    .control-button:hover {
        background-color: #0052a3;
    }

    #last-updated {
        color: #666;
        font-size: 14px;
    }

    .results-grid {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        overflow: hidden;
    }

    .grid-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 2fr;
        border-bottom: 1px solid #e0e0e0;
    }

    .grid-row:last-child {
        border-bottom: none;
    }

    .grid-row.header {
        background-color: #f5f5f5;
        font-weight: bold;
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .grid-row.even {
        background-color: #ffffff;
    }

    .grid-row.odd {
        background-color: #f8f9fa;
    }

    .grid-cell {
        padding: 12px 16px;
        font-size: 14px;
    }

    .samples {
        font-size: 12px;
        color: #666;
    }

    .sample-email {
        margin: 2px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .loading, .error {
        padding: 20px;
        text-align: center;
        color: #666;
    }

    .error {
        color: #dc3545;
    }

    .loading-row {
        background-color: #f8f9fa;
        font-style: italic;
    }
    .control-button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    #download-csv {
        background: #28a745;
        color: white;
    }

    #download-csv:hover:not(:disabled) {
        background: #218838;
    }
  `);

  // Initialize the dashboard
  createScannerDashboard();
  scanFields();
})();
