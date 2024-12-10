// ==UserScript==
// @name        LO Monitor Dashboard - Gradient Edition
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/LO-Monitor*
// @match       https://my.sailthru.com/lo-monitor*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @version     2.1
// @author      -
// @description Lifecycle Optimizer monitoring dashboard with gradient-based metrics relative to N-day averages. Uses full color spectrum for more granularity.
// Set LO names to measured inversely, where more sends indicate issues such as emails about failure events.
// Set a custom N day average period, defaults to 30 days.
// ==/UserScript==

(function() {
  // SETTINGS
  const INVERSE_LO_METRICS = [
    "LO_Name_1",
    "LO_Name_2"
  ];

  const AVERAGE_PERIOD = 30 // in days


  // LEAVE AS IS
  const debug = false

  'use strict';
  document.title = "LO Monitor"

  // Helper functions for dates
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function getMetricState(count, average, isInverse, date) {
    if (!count || !average || date === formatDate(new Date())) return null;

    const percentDiff = ((count - average) / average) * 100;
    // For inverse metrics, we flip the visual indicator but keep the actual difference
    // in the tooltip for clarity
    const adjustedDiff = isInverse ? -percentDiff : percentDiff;

    // Below average indicators (yellow -> red)
    if (adjustedDiff <= -75) return { class: 'severe-below', diff: percentDiff };
    if (adjustedDiff <= -50) return { class: 'high-below', diff: percentDiff };
    if (adjustedDiff <= -25) return { class: 'medium-below', diff: percentDiff };
    if (adjustedDiff <= -10) return { class: 'low-below', diff: percentDiff };

    // Above average indicators (green -> purple)
    if (adjustedDiff >= 75) return { class: 'severe-above', diff: percentDiff };
    if (adjustedDiff >= 50) return { class: 'high-above', diff: percentDiff };
    if (adjustedDiff >= 25) return { class: 'medium-above', diff: percentDiff };
    if (adjustedDiff >= 10) return { class: 'low-above', diff: percentDiff };

    return { class: 'normal', diff: percentDiff };
  }

  function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(formatDate(date));
    }
    // return dates.reverse(); // Reverse to get oldest first
    return dates;
  }

  // Storage functions
  function getStorageKey(date, loId) {
    return `lo_metrics_${date}_${loId}`;
  }

  function saveMetricsToStorage(date, loId, metrics) {
    const key = getStorageKey(date, loId);
    GM_setValue(key, JSON.stringify(metrics));
  }

  function getMetricsFromStorage(date, loId) {
    const key = getStorageKey(date, loId);
    const stored = GM_getValue(key);
    return stored ? JSON.parse(stored) : null;
  }

  async function fetchActiveLOs() {
    const los = await makeUIAPIRequest('/uiapi/lifecycle/');
    return los.filter(lo => lo.status === 'active');
  }

  async function fetchAverageHistory(loId) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - AVERAGE_PERIOD);

    const url = `/uiapi/lifecycle?id=${loId}&withRangedStats=true&start=${formatDate(start)}&end=${formatDate(end)}`;
    if (debug) console.log(`Fetching ${AVERAGE_PERIOD} day history for LO ${loId} at: ${url}`);

    const stats = await makeUIAPIRequest(url);
    const average = stats.entryCount / AVERAGE_PERIOD;

    return average;
  }

  async function fetchLOStats(loId, date) {
    const url = `/uiapi/lifecycle?id=${loId}&withRangedStats=true&start=${date}&end=${date}`

    if (debug) console.log(`Fetching stats for LO ${loId} on ${date} at: ${url}`);

    const stats = await makeUIAPIRequest(url);
    return stats.entryCount;
  }

  async function makeUIAPIRequest(endpoint) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `https://my.sailthru.com${endpoint}`,
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

  function createMonitorDashboard() {
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'lo-monitor';
    dashboardContainer.innerHTML = `
        <div id="lo-monitor-content">
            <div class="monitor-header">
                <h1>LO API History (7 Days)</h1>
                <div class="controls">
                    <button id="clear-data" class="control-button">Clear LO Data</button>
                    <button id="refresh-button" class="control-button">Refresh Data</button>
                    <span id="last-updated"></span>
                </div>
            </div>
            <div class="metrics-grid" id="metrics-grid">
                <div class="loading">Loading metrics...</div>
            </div>
        </div>
    `;

    const mainDiv = document.getElementById('main');
    if (mainDiv) {
      mainDiv.innerHTML = '';
      mainDiv.appendChild(dashboardContainer);
    }

    // Add clear data handler
    document.getElementById('clear-data').addEventListener('click', function() {
      // Get all keys from GM storage
      const keys = GM_listValues ? GM_listValues() : [];
      keys.forEach(key => {
        if (key.startsWith('lo_metrics_')) {
          GM_deleteValue(key);
        }
      });
      refreshMetrics();
    });

    document.getElementById('refresh-button').addEventListener('click', refreshMetrics);
  }


  async function fetchTotalStats(loId) {
    const stats = await makeUIAPIRequest(`/uiapi/lifecycle?id=${loId}&withStats=true`);
    const totals = {
      sendCount: 0,
      openCount: 0,
      clickCount: 0
    };

    if (stats.stepStats) {
      Object.values(stats.stepStats).forEach(step => {
        totals.sendCount += (step.sendCount || 0);
        totals.openCount += (step.openCount || 0);
        totals.clickCount += (step.clickCount || 0);
      });
    }

    return totals;
  }

  async function fetchAndDisplayMetrics() {
    try {
      const dates = getLast7Days();
      const activeLOs = await fetchActiveLOs();
      const headerRow = document.createElement('div');
      headerRow.className = 'grid-row header';
      headerRow.innerHTML = `
          <div class="grid-cell">
              LO Name <span class="greyText">(${AVERAGE_PERIOD} Day Average)</span>
          </div>
          ${dates.map(date => `
              <div class="grid-cell date-cell">${date.split('-').slice(1).join('/')}</div>
          `).join('')}
          <div class="grid-cell total-cell">All Time Stats</div>
      `;

      // Add legend as a separate element before the grid
      const legendDiv = document.createElement('div');
      legendDiv.className = 'metrics-legend';
      legendDiv.innerHTML = `
          <div class="legend-content">
              Below Avg: <span style="background: #fff3cd">-10%</span> →
                        <span style="background: #ffe5cc">-25%</span> →
                        <span style="background: #ffd4d4">-50%</span> →
                        <span style="background: #ffb3b3">-75%</span><br>
              Above Avg: <span style="background: #c8e6c9">+10%</span> →
                        <span style="background: #b2dfdb">+25%</span> →
                        <span style="background: #bbdefb">+50%</span> →
                        <span style="background: #e1bee7">+75%</span>
          </div>
      `;

      // Insert both into the metrics grid
      const metricsGrid = document.getElementById('metrics-grid');
      metricsGrid.innerHTML = '';
      metricsGrid.appendChild(legendDiv);
      metricsGrid.appendChild(headerRow);

      for (const lo of activeLOs) {
        const row = document.createElement('div');
        row.className = 'grid-row';

        const isInverse = INVERSE_LO_METRICS.includes(lo.name);
        const average = await fetchAverageHistory(lo.id);

        let rowHTML = `
          <div class="grid-cell">
            <a href="https://my.sailthru.com/lifecycle_optimizer#/flows/${lo.id}" target="_blank">
              ${lo.name}
              ${isInverse ? '<span class="inverse-indicator">[INVERSE]</span>' : ''}
            </a>
            <span class="average-indicator" title="${AVERAGE_PERIOD}-day average API calls">
              (${formatNumber(Math.round(average))})
            </span>
          </div>
        `;

        for (const date of dates) {
          const count = date === formatDate(new Date())
            ? await fetchLOStats(lo.id, date)
            : getMetricsFromStorage(date, lo.id) || await fetchLOStats(lo.id, date);

          if (date !== formatDate(new Date())) {
            saveMetricsToStorage(date, lo.id, count);
          }

          const metricState = getMetricState(count, average, isInverse, date);
          let tooltip = `${formatNumber(count)}`;

          if (metricState) {
            const diffText = metricState.diff >= 0 ? '+' : '';
            tooltip = `${formatNumber(count)} (${diffText}${Math.round(metricState.diff)}% vs average)`;
            if (isInverse) {
              tooltip += ' [INVERSE METRIC]';
            }
          }

          rowHTML += `
            <div class="grid-cell metric-cell ${metricState?.class || ''} ${date === formatDate(new Date()) ? 'current-day' : ''}"
                 title="${tooltip}">
              ${formatNumber(count || 0)}
            </div>
          `;
        }

        const totalStats = await fetchTotalStats(lo.id);
        rowHTML += `
          <div class="grid-cell total-cell" title="All time totals">
            <div>Sends: ${formatNumber(totalStats.sendCount)}</div>
            <div>Opens: ${formatNumber(totalStats.openCount)}</div>
            <div>Clicks: ${formatNumber(totalStats.clickCount)}</div>
          </div>
        `;

        row.innerHTML = rowHTML;
        metricsGrid.appendChild(row);
      }

      document.getElementById('last-updated').textContent =
        `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
      console.error('Error fetching metrics:', error);
      document.getElementById('metrics-grid').innerHTML =
        '<div class="error">Error loading metrics. Please try again.</div>';
    }
  }

  function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
  }

  function refreshMetrics() {
      if (document.getElementById('metrics-grid').children.length <= 1) {
          // If grid is empty or only has header, do full refresh
          const metricsGrid = document.getElementById('metrics-grid');
          metricsGrid.innerHTML = '<div class="loading">Refreshing metrics...</div>';
          fetchAndDisplayMetrics();
      } else {
          // Otherwise do targeted refresh
          refreshCurrentDayMetrics();
      }
  }

  async function refreshCurrentDayMetrics() {
    const today = formatDate(new Date());
    const currentLOs = Array.from(document.querySelectorAll('.grid-row')).slice(1) // Skip header row
        .map(row => ({
            id: row.querySelector('a').href.split('/').pop(),
            name: row.querySelector('a').textContent.trim()
        }));

    // Find cells for today and update them
    for (const lo of currentLOs) {
        const row = document.querySelector(`a[href$="${lo.id}"]`).closest('.grid-row');
        const todayCell = Array.from(row.querySelectorAll('.metric-cell'))
            .find(cell => cell.classList.contains('current-day'));

        if (todayCell) {
            todayCell.innerHTML = '(refreshing)';
            todayCell.style.color = '#666';

            const count = await fetchLOStats(lo.id, today);

            todayCell.innerHTML = formatNumber(count || 0);
            todayCell.style.color = '';
        }
    }

    // Check for new LOs
    const activeLOs = await fetchActiveLOs();
    const newLOs = activeLOs.filter(lo =>
        !currentLOs.some(currentLo => currentLo.id === lo.id)
    );

    if (newLOs.length > 0) {
        // If new LOs exist, do a full refresh
        fetchAndDisplayMetrics();
    } else {
        // Just update the timestamp
        document.getElementById('last-updated').textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;
    }
}

  function initBackToTop() {
  // Create the button
  const button = document.createElement('div');
  button.id = 'back-to-top';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  `;
  document.body.appendChild(button);

  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 200) {
      button.classList.add('visible');
    } else {
      button.classList.remove('visible');
    }
  });

  // Scroll to top when clicked
  button.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

  function initMonitorDashboard() {
  createMonitorDashboard();
  fetchAndDisplayMetrics();
  initBackToTop();
  setInterval(refreshMetrics, 60000); // 1 min
}

  GM_addStyle(` /* Update metrics grid container */
  .metrics-grid {
    position: relative;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    min-width: 1200px;
    overflow: visible !important;
  }

  /* Legend styling */
  .metrics-legend {
    position: sticky;
    top: 0;
    z-index: 101;
    background: #f5f5f5;
    padding: 8px 16px;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 8px 8px 0 0;
  }

  .legend-content {
    font-size: 11px;
    color: #666;
  }

  /* Make header row sticky below legend */
  .grid-row.header {
    position: sticky;
    top: 40px; /* Adjust based on legend height */
    background-color: #f5f5f5;
    font-weight: bold;
    z-index: 100;
    border-bottom: 2px solid #e0e0e0;
  }

  /* Add solid background to header cells */
  .grid-row.header .grid-cell {
    background-color: #f5f5f5;
  }

  /* Add shadow to sticky header when scrolled */
  .grid-row.header::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -5px;
    height: 5px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.1), transparent);
    pointer-events: none;
  }

  /* Ensure non-header rows have proper background */
  .grid-row:not(.header) {
    background-color: white;
  }

  /* Maintain proper spacing */
  #main {
    padding: 20px !important;
  }

  body {
    min-width: 100% !important;
  }


  #back-to-top {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    opacity: 0;
    visibility: hidden;
    z-index: 1000;
  }

  #back-to-top:hover {
    background-color: #f5f5f5;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  #back-to-top.visible {
    opacity: 1;
    visibility: visible;
  }
    .monitor-header h1 {
        margin: 0;
        color: #333;
    }
    .controls {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    .control-button {
        background-color: #0066cc;
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
    .grid-cell a + .average-indicator {
        margin-left: 8px;
        color: #666;
        font-size: 13px;
        font-weight: normal;
    }
    .grid-cell span + .warning-indicator {
        margin-left: 8px;
        color: red;
        font-size: 13px;
        font-weight: normal;
    }

    /* Restore original grid layout */
    .grid-row {
        display: grid;
        grid-template-columns: 2fr repeat(7, 1fr) 1.5fr;
        border-bottom: 1px solid #e0e0e0;
    }

    button {
      padding: 8px 20px;
      margin: 6px;
      border-radius: 5px;
      background-color: rgb(58, 122, 240) !important;
      color: white;
      border: medium;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
      background: none;
    }

    button:hover {
      color: white;
    }

    .grid-row:last-child {
        border-bottom: none;
    }
    .grid-cell {
        padding: 12px 16px;
        align-items: center;
        font-size: 14px;
        text-align: right;
    }
    .grid-cell:first-child {
        text-align: left;
    }
    .date-cell {
        font-size: 12px;
        color: #666;
    }
    .grid-cell a {
        color: #0066cc;
        text-decoration: none;
    }
    .grid-cell a:hover {
        text-decoration: underline;
    }
    .loading, .error {
        padding: 20px;
        text-align: center;
        color: #666;
    }
    .error {
        color: #dc3545;
    }
    footer, header {
        display: none !important;
    }
    .debug-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 14px;
        color: #666;
    }

    .debug-label input[type="checkbox"] {
        margin: 0;
    }

    .total-cell {
        font-size: 12px;
        padding: 8px 16px;
        background-color: #f8f9fa;
        border-left: 2px solid #e0e0e0;
    }
    .current-day {
        background-color: #e8f4ff;
        font-style: italic;
    }

    .current-day:hover {
        background-color: #d1e9ff;
    }

    .custom-warning {
        background-color: #fff3f3;
        color: #dc3545;
        font-weight: bold;
    }

    .custom-warning:hover {
        background-color: #ffe6e6;
    }

    .auto-warning {
        background-color: #fff3dc;
        color: #856404;
        font-weight: bold;
    }

    .auto-warning:hover {
        background-color: #fff0c7;
    }

    .critical-warning {
        background-color: #343a40;
        color: #ffffff;
        font-weight: bold;
    }

    .critical-warning:hover {
        background-color: #23272b;
    }
    .greyText {
      color: grey;
      font-weight: normal;
    }
    .redText {
      color: red;
      font-weight: normal;
    }



    .metrics-grid {
        background: white;
        border-radius: 8px;
        overflow-x: auto; /* Allow horizontal scroll on small screens */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        min-width: 1200px; /* Minimum width to prevent squishing */
    }

    .grid-row {
        display: grid;
        grid-template-columns: minmax(400px, 2fr) repeat(7, minmax(100px, 1fr)) minmax(150px, 1.5fr);
        border-bottom: 1px solid #e0e0e0;
    }

    .grid-cell {
        padding: 12px 16px;
        align-items: center;
        font-size: 14px;
        text-align: right;
        white-space: nowrap; /* Prevent wrapping */
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .grid-cell:first-child {
        text-align: left;
        overflow: visible; /* Allow name cell to show full content */
        white-space: normal; /* Allow wrapping for name cell */
    }


    /* Ensure the header stays visible */
    .monitor-header {
        position: sticky;
        top: 0;
        background-color: #f0f4f5;
        z-index: 1;
        padding-bottom: 20px;
    }

    /* Ensure tooltips show above grid */
    [title] {
        position: relative;
        z-index: 2;
    }

    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }

    .refreshing {
        animation: pulse 1s infinite;
        color: #666;
        font-style: italic;
    }


 /* Below average gradient (pale yellow -> pale red) */
    .low-below {
      background-color: #fff3cd;
      color: #000000;
      font-weight: bold;
    }

    .medium-below {
      background-color: #ffe5cc;
      color: #000000;
      font-weight: bold;
    }

    .high-below {
      background-color: #ffd4d4;
      color: #000000;
      font-weight: bold;
    }

    .severe-below {
      background-color: #ffb3b3;
      color: #000000;
      font-weight: bold;
    }

    /* Above average gradient (green -> teal -> blue -> violet) */
    .low-above {
      background-color: #c8e6c9;
      color: #000000;
      font-weight: bold;
    }

    .medium-above {
      background-color: #b2dfdb;
      color: #000000;
      font-weight: bold;
    }

    .high-above {
      background-color: #bbdefb;
      color: #000000;
      font-weight: bold;
    }

    .severe-above {
      background-color: #e1bee7;
      color: #000000;
      font-weight: bold;
    }

    .normal {
      background-color: transparent;
    }

    .inverse-indicator {
      color: #dc3545;
      margin-left: 4px;
      font-size: 12px;
    }
  `);

  // Initialize the dashboard
  initMonitorDashboard();
})();

