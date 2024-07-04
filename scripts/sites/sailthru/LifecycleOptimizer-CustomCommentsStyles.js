// ==UserScript==
// @name        Lifecyle Optimizer - Custom Comments Styles
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer*
// @grant       GM_addStyle
// @version     1.0
// @author      Colin Whelan
// @description Add custom sytling to the new 'Comments' feature
// ==/UserScript==

const notesColor = '#8462e0'
const notesBorderColor = 'none' // any color or 'none'
const flapColor = '#5C50EF'
const fontSize = '14px'
const fontFamily = '"proxima-nova", "Proxima Nova", Helvetica, Arial, sans-serif' // default
// box rounding - flap is hidden if not 0
const r = 0 // in px



const flap = r != 0 ? false : true // disable the flap if there is a rounded border
// Updated path to maintain the angled top-right corner
let boxPath = ''

if (flap == true){
  boxPath = `M 0,0 L 166,0 175,9 175,101 0,101 Z`
} else {
  boxPath = `M 0,${r} A ${r},${r} 0 0 1 ${r},0 L ${175-r},0 A ${r},${r} 0 0 1 175,${r} L 175,${100-r} A ${r},${r} 0 0 1 ${175-r},100 L ${r},100 A ${r},${r} 0 0 1 0,${100-r} Z`
}



let styles = `
  svg.step-comment > g > g > path:first-child {
    fill: ${notesColor} !important;
    stroke: ${notesBorderColor} !important;
  }
  svg.step-comment > g > g > path:last-child {
    fill: ${flapColor} !important;
  }
  svg.step-comment > g > foreignObject > div {
    font-size: ${fontSize} !important;
    font-family: ${fontFamily} !important;
  }
`

if (!flap){
  styles += `
  svg.step-comment > g > g > path:last-child {
    display:none !important;
  }`
}

function initializeScript() {
  GM_addStyle(styles);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const boxes = node.querySelectorAll('svg.step-comment > g > g > path:first-child');
            if (boxes.length > 0) {
              console.log('New boxes found:', boxes);
              processBoxes(boxes);
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Process existing boxes
  const existingBoxes = document.querySelectorAll('svg.step-comment > g > g > path:first-child');
  if (existingBoxes.length > 0) {
    console.log('Existing boxes found:', existingBoxes);
    processBoxes(existingBoxes);
    alert(boxPath)
  }
}

function processBoxes(boxes) {
  boxes.forEach(box => {
    box.setAttribute('d', boxPath);
    // Add any other processing you want to do with the boxes here
  });
}

initializeScript();
