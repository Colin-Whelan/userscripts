// ==UserScript==
// @name        Common Utilities
// @namespace   Violentmonkey Scripts
// @match       https://app.iterable.com/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Common utility functions used by multiple scripts
// @grant        GM_addStyle
// ==/UserScript==


(function() {
    'use strict';

    // Register with the loader system
    window.SiteEnhancer = window.SiteEnhancer || {};
    window.SiteEnhancer.scripts = window.SiteEnhancer.scripts || {};
    window.SiteEnhancer.utils = window.SiteEnhancer.utils || {};

    // Script metadata
    window.SiteEnhancer.scripts['common-utils'] = {
        version: '0.1.0',
        author: 'you',
        type: 'utility',
        init: init,
        description: 'Common utility functions used by multiple scripts'
    };

    // Core utility functions that will be available to other scripts
    const utils = {
        /**
         * Create and inject a custom element into the page
         * @param {string} tag - HTML tag name
         * @param {object} attributes - Key/value pairs of attributes
         * @param {string|HTMLElement} content - Inner content or child element
         * @param {HTMLElement} parent - Parent element to append to
         * @returns {HTMLElement} The created element
         */
        createElement: function(tag, attributes = {}, content = '', parent = null) {
            const element = document.createElement(tag);

            // Set attributes
            for (const [key, value] of Object.entries(attributes)) {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else {
                    element.setAttribute(key, value);
                }
            }

            // Set content
            if (content) {
                if (typeof content === 'string') {
                    element.innerHTML = content;
                } else if (content instanceof HTMLElement) {
                    element.appendChild(content);
                }
            }

            // Append to parent if provided
            if (parent) {
                parent.appendChild(element);
            }

            return element;
        },

        /**
         * Waits for an element to appear in the DOM
         * @param {string} selector - CSS selector
         * @param {number} timeout - Max time to wait in ms
         * @param {HTMLElement} parent - Parent element to search within
         * @returns {Promise<HTMLElement>} The found element
         */
        waitForElement: function(selector, timeout = 10000, parent = document) {
            return new Promise((resolve, reject) => {
                // Check if element already exists
                const element = parent.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                // Set timeout
                const timeoutId = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, timeout);

                // Create observer
                const observer = new MutationObserver((mutations) => {
                    const element = parent.querySelector(selector);
                    if (element) {
                        observer.disconnect();
                        clearTimeout(timeoutId);
                        resolve(element);
                    }
                });

                // Start observing
                observer.observe(parent, {
                    childList: true,
                    subtree: true
                });
            });
        },

        /**
         * Adds CSS to the page
         * @param {string} css - CSS string
         */
        addStyles: function(css) {
            GM_addStyle(css);
        },

        /**
         * Creates a simple modal dialog
         * @param {string} title - Modal title
         * @param {string|HTMLElement} content - Modal content
         * @param {Array} buttons - Array of button config objects
         * @returns {HTMLElement} The modal element
         */
        showModal: function(title, content, buttons = []) {
            // Create backdrop
            const backdrop = this.createElement('div', {
                'class': 'se-modal-backdrop',
                'style': {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 9999
                }
            }, '', document.body);

            // Create modal
            const modal = this.createElement('div', {
                'class': 'se-modal',
                'style': {
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'white',
                    borderRadius: '5px',
                    padding: '20px',
                    width: '400px',
                    maxWidth: '90%',
                    boxShadow: '0 0 20px rgba(0,0,0,0.3)',
                    zIndex: 10000
                }
            }, '', backdrop);

            // Add title
            this.createElement('h3', {
                'class': 'se-modal-title',
                'style': {
                    margin: '0 0 15px 0',
                    borderBottom: '1px solid #eee',
                    paddingBottom: '10px'
                }
            }, title, modal);

            // Add content
            const contentEl = this.createElement('div', {
                'class': 'se-modal-content',
                'style': {
                    marginBottom: '20px'
                }
            }, content, modal);

            // Add buttons
            if (buttons.length > 0) {
                const buttonContainer = this.createElement('div', {
                    'class': 'se-modal-buttons',
                    'style': {
                        textAlign: 'right'
                    }
                }, '', modal);

                buttons.forEach(btn => {
                    const button = this.createElement('button', {
                        'class': `se-modal-button ${btn.class || ''}`,
                        'style': {
                            padding: '8px 12px',
                            marginLeft: '10px',
                            background: btn.primary ? '#4CAF50' : '#f1f1f1',
                            color: btn.primary ? 'white' : 'black',
                            border: '1px solid #ddd',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }
                    }, btn.text, buttonContainer);

                    button.addEventListener('click', () => {
                        if (btn.action) {
                            btn.action(modal, backdrop);
                        } else {
                            backdrop.remove();
                        }
                    });
                });
            } else {
                // Add default close button if no buttons provided
                this.createElement('button', {
                    'class': 'se-modal-close',
                    'style': {
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: '#999'
                    }
                }, '×', modal).addEventListener('click', () => {
                    backdrop.remove();
                });
            }

            // Allow closing by clicking backdrop
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    backdrop.remove();
                }
            });

            return { modal, backdrop };
        },

        /**
         * Shows a notification toast message
         * @param {string} message - Notification message
         * @param {string} type - Notification type (info, success, warning, error)
         * @param {number} duration - How long to show the notification in ms
         * @returns {HTMLElement} The notification element
         */
        showNotification: function(message, type = 'info', duration = 3000) {
            // Define color based on type
            const colors = {
                info: { bg: '#2196F3', text: 'white' },
                success: { bg: '#4CAF50', text: 'white' },
                warning: { bg: '#FFC107', text: 'black' },
                error: { bg: '#F44336', text: 'white' }
            };

            const color = colors[type] || colors.info;

            // Create notification element
            const notification = this.createElement('div', {
                'class': `se-notification se-notification-${type}`,
                'style': {
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: '15px 20px',
                    background: color.bg,
                    color: color.text,
                    borderRadius: '4px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    zIndex: 9999,
                    transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
                    transform: 'translateX(100%)',
                    opacity: 0
                }
            }, message, document.body);

            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
                notification.style.opacity = '1';
            }, 10);

            // Add close button
            this.createElement('span', {
                'style': {
                    marginLeft: '10px',
                    cursor: 'pointer'
                }
            }, '×', notification).addEventListener('click', () => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            });

            // Auto hide after duration
            if (duration > 0) {
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => notification.remove(), 300);
                    }
                }, duration);
            }

            return notification;
        },

        /**
         * Debounce function to limit how often a function is called
         * @param {Function} func - Function to debounce
         * @param {number} wait - Milliseconds to wait
         * @returns {Function} Debounced function
         */
        debounce: function(func, wait = 300) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        /**
         * Throttle function to limit how often a function is called
         * @param {Function} func - Function to throttle
         * @param {number} limit - Milliseconds to limit
         * @returns {Function} Throttled function
         */
        throttle: function(func, limit = 300) {
            let waiting = false;
            return function(...args) {
                if (!waiting) {
                    func.apply(this, args);
                    waiting = true;
                    setTimeout(() => {
                        waiting = false;
                    }, limit);
                }
            };
        },

        /**
         * Check if we're on a specific page
         * @param {string|RegExp} pattern - URL pattern to match
         * @returns {boolean} True if on matching page
         */
        isOnPage: function(pattern) {
            if (pattern instanceof RegExp) {
                return pattern.test(window.location.href);
            } else {
                return window.location.href.includes(pattern);
            }
        },

        /**
         * Get value from local storage with a default value
         * @param {string} key - Storage key
         * @param {*} defaultValue - Default value if key doesn't exist
         * @returns {*} The stored value or default
         */
        getStorageValue: function(key, defaultValue) {
            const value = localStorage.getItem(`se_${key}`);
            if (value === null) return defaultValue;
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        },

        /**
         * Save value to local storage
         * @param {string} key - Storage key
         * @param {*} value - Value to store
         */
        setStorageValue: function(key, value) {
            if (typeof value === 'object') {
                localStorage.setItem(`se_${key}`, JSON.stringify(value));
            } else {
                localStorage.setItem(`se_${key}`, value);
            }
        }
    };

    // Initialize the common utilities
    function init() {
        console.log('Initializing common utilities v0.1.0');

        // Add global CSS for all site enhancement UI elements
        utils.addStyles(`
            .se-btn {
                display: inline-block;
                padding: 6px 12px;
                background: #f1f1f1;
                border: 1px solid #ddd;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 5px;
            }
            .se-btn:hover {
                background: #e9e9e9;
            }
            .se-btn-primary {
                background: #4CAF50;
                color: white;
                border-color: #43A047;
            }
            .se-btn-primary:hover {
                background: #43A047;
            }
            .se-input {
                padding: 6px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 14px;
            }
            .se-label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
        `);


        // Configuration button utility
        utils.addConfigButton = function(parentElement, configFunction, buttonText = '⚙️ Configure') {
            // Skip if parent element doesn't exist
            if (!parentElement) return null;

            // Check if a button already exists with the same text in this container
            const existingButton = Array.from(parentElement.querySelectorAll('.se-config-button'))
                .find(btn => btn.textContent === buttonText);

            if (existingButton) return existingButton;

            // Create a styled button
            const configButton = document.createElement('button');
            configButton.textContent = buttonText;
            configButton.className = 'se-config-button';
            configButton.title = 'Open settings';

            // Style the button
            configButton.style.cssText = `
                background: #f1f1f1;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 8px;
                margin-left: 5px;
                font-size: 12px;
                cursor: pointer;
                color: #333;
                transition: background 0.2s, opacity 0.2s;
            `;

            // Add hover effects
            configButton.addEventListener('mouseenter', () => {
                configButton.style.background = '#e0e0e0';
            });

            configButton.addEventListener('mouseleave', () => {
                configButton.style.background = '#f1f1f1';
            });

            // Add click event
            configButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                configFunction();
            });

            // Add to parent
            parentElement.appendChild(configButton);

            return configButton;
        };

        // Floating config button that can be added to any page position
        utils.addFloatingConfigButton = function(configFunction, position = 'bottom-right', buttonText = '⚙️') {
            // Determine position CSS based on requested position
            let positionCSS = '';
            switch (position) {
                case 'top-right':
                    positionCSS = 'top: 20px; right: 20px;';
                    break;
                case 'top-left':
                    positionCSS = 'top: 20px; left: 20px;';
                    break;
                case 'bottom-left':
                    positionCSS = 'bottom: 20px; left: 20px;';
                    break;
                case 'bottom-right':
                default:
                    positionCSS = 'bottom: 20px; right: 20px;';
                    break;
            }

            // Create a styled button
            const configButton = document.createElement('div');
            configButton.textContent = buttonText;
            configButton.className = 'se-floating-config-button';
            configButton.title = 'Configure script settings';

            // Style the button
            configButton.style.cssText = `
                ${positionCSS}
                position: fixed;
                width: 36px;
                height: 36px;
                background: #4CAF50;
                color: white;
                border-radius: 50%;
                text-align: center;
                line-height: 36px;
                cursor: pointer;
                z-index: 9997;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                font-size: 18px;
                transition: transform 0.2s, background 0.2s;
            `;

            // Add hover effects
            configButton.addEventListener('mouseenter', () => {
                configButton.style.transform = 'scale(1.1)';
                configButton.style.background = '#43A047';
            });

            configButton.addEventListener('mouseleave', () => {
                configButton.style.transform = 'scale(1)';
                configButton.style.background = '#4CAF50';
            });

            // Add click event
            configButton.addEventListener('click', configFunction);

            // Add to body
            document.body.appendChild(configButton);

            return configButton;
        };

        // Make utilities available globally
        window.SiteEnhancer.utils = utils;

        console.log('Common utilities initialized');
    }


    // Call init if this script is loaded directly
    if (!window.SiteEnhancer || !window.SiteEnhancer.loader) {
        init();
    }
})();
