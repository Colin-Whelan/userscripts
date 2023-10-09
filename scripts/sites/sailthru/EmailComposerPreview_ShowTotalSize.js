// ==UserScript==
// @name        Email Preview - Show Total Size
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Show the approximate total size of the email in KB on the 'Preview' screen
// ==/UserScript==
function getSizeAndAppend(iframe, targetDiv) {
  previewIframeObserver.disconnect();

  const iframeContent = iframe.outerHTML;

  // Convert content to a blob and get its size
  const blob = new Blob([iframeContent], {
    type: 'text/html'
  });
  const sizeInKB = (blob.size / 1024).toFixed(2); // Convert bytes to KB and keep 2 decimal places
  console.log(sizeInKB)

  if(!document.getElementById('emailSize')){
      // Create a new div for the size text with styling
      const sizeDiv = document.createElement('div');
      sizeDiv.textContent = `Approx. email size: ${sizeInKB} KB`;
      sizeDiv.id = 'emailSize';
      sizeDiv.style.fontSize = "20px"; // Bigger font size

      // Insert the new div right before the target div
      targetDiv.parentElement.insertBefore(sizeDiv, targetDiv);
  } else {
    document.getElementById('emailSize').textContent = `Approx. email size: ${sizeInKB} KB`;
  }

  previewIframeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

const previewIframeObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      const previewIframe = document.querySelector('.pn--HtmlPreview-iframe--1f2Oq');
      const targetDiv = document.querySelector('div.sc-gicCDI.sc-kLLXSd.eWoGyS.eAcqHB');

      if ((previewIframe && targetDiv)) {
        console.log(previewIframe)
        getSizeAndAppend(previewIframe, targetDiv);

      }
    }
  }
});

// Start observing the entire document with the configured parameters
previewIframeObserver.observe(document.body, {
  childList: true,
  subtree: true
});
