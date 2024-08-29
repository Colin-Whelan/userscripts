// ==UserScript==
// @name        Global - Custom Favions
// @namespace   Change page favicon
// @match       https://my.sailthru.com/*
// @match       https://sailthru.zendesk.com/*
// @match       https://getstarted.sailthru.com/*
// @match       https://getstarted.meetmarigold.com/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Add a custom favicon to different Sailthru pages depending on the doomain. Could be configured for other pages with bit of know-how.
// ==/UserScript==

// Downloaded from https://icons8.com/icons/. Hosted on glitch.com
const sailthruMainFavicon = 'https://cdn.glitch.global/4c74f8d5-b1a6-4a37-91dc-9b40f9d9d76e/icons8-email-50.png';
const sailthruZendeskFavicon = 'https://cdn.glitch.global/4c74f8d5-b1a6-4a37-91dc-9b40f9d9d76e/icons8-help-50.png';
const sailthruStartFavicon = 'https://cdn.glitch.global/4c74f8d5-b1a6-4a37-91dc-9b40f9d9d76e/icons8-documentation-64.png';

function getFaviconForURL(url) {
    if (url.includes('my.sailthru.com')) {
        return sailthruMainFavicon;
    } else if (url.includes('sailthru.zendesk.com')) {
        return sailthruZendeskFavicon;
    } else if (url.includes('getstarted.sailthru.com') || url.includes('getstarted.meetmarigold.com')) {
        return sailthruStartFavicon;
    }
    return null;  // default fallback, can be removed if not needed
}

function setFavicon(url) {
    let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = url;
    document.getElementsByTagName('head')[0].appendChild(link);
}

const currentFavicon = getFaviconForURL(window.location.href);
if (currentFavicon) {
    setFavicon(currentFavicon);
}
