// ==UserScript==
// @name         Indigo SKU URL Generator
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Generate final Indigo product URLs from SKUs
// @author       Colin Whelan
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // Constants
    const CONSTANTS = {
        TIMEOUT: 10000,
        LANGUAGES: {
            'en-ca': 'English (en-ca)',
            'fr-ca': 'French (fr-ca)'
        },
        BASE_URL: 'https://www.indigo.ca',
        ERRORS: {
            NOT_FOUND: 'Product not found or invalid SKU',
            NETWORK_ERROR: 'Network error',
            TIMEOUT: 'Request timed out',
            NO_SKUS: 'No valid SKUs found',
            EMPTY_INPUT: 'Please enter at least one SKU'
        }
    };

    // State
    let currentLang = 'en-ca';
    let modal = null;
    let isDarkMode = localStorage.getItem('indigo-sku-generator-dark') === 'true';

    // Initialize
    GM_registerMenuCommand("Indigo SKU URL Generator", showModal);

    // Utility functions
    function createRequestConfig(method, url, onload, onerror) {
        return {
            method,
            url,
            onload,
            onerror,
            ontimeout: () => onerror(new Error(CONSTANTS.ERRORS.TIMEOUT)),
            timeout: CONSTANTS.TIMEOUT
        };
    }

    function isValidProductUrl(url, sku) {
        const basicSkuPattern = new RegExp(`${CONSTANTS.BASE_URL}/${currentLang}/${sku}\\.html//`, 'i');
        return !basicSkuPattern.test(url);
    }

    function createError(sku, message) {
        return new Error(`SKU ${sku} - ${message}`);
    }

    function parseSkus(input) {
        const hasCommas = input.includes(',');
        const hasNewlines = input.includes('\n');

        const outputSeparator = hasCommas ? ', ' : '\n';
        const skus = input.split(/[,\n]/).map(sku => sku.trim()).filter(sku => sku);

        return { skus, outputSeparator };
    }

    // Modal creation
    function showModal() {
        if (modal) modal.remove();
        createModal();
    }

    function createModal() {
        modal = document.createElement('div');
        modal.style.cssText = getModalStyles();
        modal.innerHTML = getModalHTML();

        document.body.appendChild(modal);
        setupEventListeners();
        document.getElementById('skuInput').focus();
    }

    function getModalStyles() {
        const bgColor = isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
        return `
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            background: ${bgColor} !important; z-index: 999999 !important;
            display: flex !important; justify-content: center !important; align-items: center !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
            font-size: 14px !important; line-height: 1.4 !important; color: #333 !important; box-sizing: border-box !important;
        `;
    }

    function getModalHTML() {
        const languageOptions = Object.entries(CONSTANTS.LANGUAGES)
            .map(([value, text]) => `<option value="${value}">${text}</option>`)
            .join('');

        // Theme-based colors
        const theme = getThemeColors();

        return `
            <div style="background: ${theme.modalBg} !important; padding: 20px !important; border-radius: 8px !important;
                        max-width: 500px !important; width: 90% !important; max-height: 80vh !important;
                        overflow-y: auto !important; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
                        font-family: inherit !important; box-sizing: border-box !important; margin: 0 !important;">

                <div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 20px !important;">
                    <h3 style="margin: 0 !important; color: ${theme.text} !important; font-size: 18px !important; font-weight: bold !important;">Indigo SKU URL Generator</h3>
                    <div style="display: flex !important; align-items: center !important; gap: 10px !important;">
                        <button id="darkModeToggle" title="Toggle dark mode" style="background: ${theme.toggleBg} !important; color: ${theme.toggleText} !important; border: 1px solid ${theme.border} !important;
                                                                                  padding: 5px 8px !important; border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important;">
                            ${isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <button id="closeModal" style="background: none !important; border: none !important; font-size: 20px !important; cursor: pointer !important; color: ${theme.closeBtn} !important; padding: 0 !important;">&times;</button>
                    </div>
                </div>

                <div style="margin-bottom: 15px !important;">
                    <label style="display: flex !important; align-items: center !important; gap: 10px !important; margin-bottom: 10px !important;">
                        <span style="font-weight: bold !important; color: ${theme.text} !important;">Language:</span>
                        <select id="langSelect" style="padding: 5px !important; border: 1px solid ${theme.border} !important; border-radius: 4px !important; background: ${theme.inputBg} !important; color: ${theme.text} !important;">
                            ${languageOptions}
                        </select>
                    </label>
                </div>

                <div style="margin-bottom: 15px !important;">
                    <label style="display: block !important; margin-bottom: 5px !important; font-weight: bold !important; color: ${theme.text} !important;">
                        SKUs (comma or newline separated):
                    </label>
                    <textarea id="skuInput" placeholder="Enter SKUs like: 882709965732, 123456789012"
                        style="width: 100% !important; height: 100px !important; padding: 10px !important; border: 1px solid ${theme.border} !important;
                               border-radius: 4px !important; font-family: 'Courier New', Consolas, monospace !important; resize: vertical !important;
                               background: ${theme.inputBg} !important; color: ${theme.text} !important; font-size: 13px !important; box-sizing: border-box !important;"></textarea>
                </div>

                <div style="margin-bottom: 15px !important;">
                    <button id="generateUrls" style="background: #007cba !important; color: white !important; border: none !important;
                                                   padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-size: 14px !important;">
                        Generate URLs
                    </button>
                    <span id="loadingText" style="margin-left: 10px !important; display: none !important; color: ${theme.muted} !important;">Processing...</span>
                </div>

                <div id="results" style="display: none !important;">
                    <div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 10px !important;">
                        <label style="font-weight: bold !important; color: ${theme.text} !important;">Results:</label>
                        <button id="copyResults" style="background: #28a745 !important; color: white !important; border: none !important;
                                                       padding: 5px 10px !important; border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important;">
                            Copy All
                        </button>
                    </div>
                    <textarea id="resultOutput" readonly
                        style="width: 100% !important; height: 150px !important; padding: 10px !important; border: 1px solid ${theme.border} !important;
                               border-radius: 4px !important; font-family: 'Courier New', Consolas, monospace !important; background: ${theme.readonlyBg} !important;
                               resize: vertical !important; color: ${theme.text} !important; font-size: 13px !important; box-sizing: border-box !important;"></textarea>
                </div>
            </div>
        `;
    }

    function getThemeColors() {
        if (isDarkMode) {
            return {
                modalBg: '#2d3748',
                text: '#f7fafc',
                inputBg: '#4a5568',
                readonlyBg: '#2d3748',
                border: '#4a5568',
                muted: '#a0aec0',
                closeBtn: '#a0aec0',
                toggleBg: '#4a5568',
                toggleText: '#f7fafc'
            };
        } else {
            return {
                modalBg: 'white',
                text: '#333',
                inputBg: 'white',
                readonlyBg: '#f9f9f9',
                border: '#ddd',
                muted: '#666',
                closeBtn: '#666',
                toggleBg: '#f8f9fa',
                toggleText: '#333'
            };
        }
    }

    function setupEventListeners() {
        document.getElementById('langSelect').value = currentLang;
        document.getElementById('closeModal').onclick = () => modal.remove();
        document.getElementById('langSelect').onchange = (e) => { currentLang = e.target.value; };
        document.getElementById('generateUrls').onclick = generateUrls;
        document.getElementById('copyResults').onclick = copyResults;
        document.getElementById('darkModeToggle').onclick = toggleDarkMode;
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        localStorage.setItem('indigo-sku-generator-dark', isDarkMode.toString());

        // Recreate modal with new theme
        const wasVisible = modal !== null;
        if (wasVisible) {
            const skuInput = document.getElementById('skuInput').value;
            const langValue = document.getElementById('langSelect').value;
            const resultOutput = document.getElementById('resultOutput');
            const resultsVisible = document.getElementById('results').style.display !== 'none';
            const resultValue = resultOutput ? resultOutput.value : '';

            modal.remove();
            createModal();

            // Restore state
            document.getElementById('skuInput').value = skuInput;
            document.getElementById('langSelect').value = langValue;
            if (resultsVisible && resultValue) {
                document.getElementById('resultOutput').value = resultValue;
                document.getElementById('results').style.display = 'block';
            }
        }
    }

    // URL Generation
    async function generateUrls() {
        const input = document.getElementById('skuInput').value.trim();

        if (!input) {
            alert(CONSTANTS.ERRORS.EMPTY_INPUT);
            return;
        }

        const { skus, outputSeparator } = parseSkus(input);

        if (skus.length === 0) {
            alert(CONSTANTS.ERRORS.NO_SKUS);
            return;
        }

        setLoadingState(true);

        try {
            const results = await processSkus(skus);
            displayResults(results.join(outputSeparator));
        } catch (error) {
            console.error('Error processing SKUs:', error);
        } finally {
            setLoadingState(false);
        }
    }

    async function processSkus(skus) {
        const results = [];
        const loadingText = document.getElementById('loadingText');

        for (let i = 0; i < skus.length; i++) {
            const sku = skus[i];
            loadingText.textContent = `Processing ${i + 1}/${skus.length}...`;

            try {
                const finalUrl = await getFinalUrl(sku);
                results.push(finalUrl);
            } catch (error) {
                console.error(`Error processing SKU ${sku}:`, error);
                results.push(`Error: ${error.message}`);
            }
        }

        return results;
    }

    function setLoadingState(isLoading) {
        const loadingText = document.getElementById('loadingText');
        const generateBtn = document.getElementById('generateUrls');
        const resultsDiv = document.getElementById('results');

        loadingText.style.display = isLoading ? 'inline' : 'none';
        generateBtn.disabled = isLoading;
        generateBtn.textContent = isLoading ? 'Processing...' : 'Generate URLs';

        if (isLoading) {
            resultsDiv.style.display = 'none';
        }
    }

    function displayResults(resultText) {
        document.getElementById('resultOutput').value = resultText;
        document.getElementById('results').style.display = 'block';
    }

    // HTTP Request handling
    function getFinalUrl(sku) {
        return new Promise((resolve, reject) => {
            const initialUrl = `${CONSTANTS.BASE_URL}/${currentLang}/${sku}.html`;

            makeRequest('HEAD', initialUrl, sku)
                .then(resolve)
                .catch(() => makeRequest('GET', initialUrl, sku))
                .then(resolve)
                .catch(reject);
        });
    }

    function makeRequest(method, url, sku) {
        return new Promise((resolve, reject) => {
            const config = createRequestConfig(
                method,
                url,
                (response) => handleResponse(response, url, sku, resolve, reject),
                (error) => reject(createError(sku, error.statusText || CONSTANTS.ERRORS.NETWORK_ERROR))
            );

            GM_xmlhttpRequest(config);
        });
    }

    function handleResponse(response, initialUrl, sku, resolve, reject) {
        const finalUrl = response.finalUrl || initialUrl;

        if (!isValidProductUrl(finalUrl, sku) || finalUrl === initialUrl) {
            reject(createError(sku, CONSTANTS.ERRORS.NOT_FOUND));
            return;
        }

        resolve(finalUrl);
    }

    // Copy functionality
    function copyResults() {
        const resultOutput = document.getElementById('resultOutput');
        const copyBtn = document.getElementById('copyResults');

        if (!resultOutput.value) return;

        // Try GM_setClipboard first, fallback to execCommand
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(resultOutput.value);
        } else {
            resultOutput.select();
            document.execCommand('copy');
        }

        showCopyFeedback(copyBtn);
    }

    function showCopyFeedback(copyBtn) {
        const originalText = copyBtn.textContent;
        const originalColor = copyBtn.style.background;

        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#218838';

        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = originalColor;
        }, 1000);
    }
})();
