// ==UserScript==
// @name        WaitDelayWarning
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Modifying 'Wait' steps in Lifecycle Optimizer flows can have SERIOUS consequences. This adds a warning message to the modal that shows when removing the step, and links to the documentation.
// ==/UserScript==

// Select the element to watch
var targetNode = document.querySelector('body');

 // Create the warning div
var warningDiv = document.createElement('div');
warningDiv.style.backgroundColor = 'red';
warningDiv.style.borderRadius = '5px';
warningDiv.style.padding = '10px';
warningDiv.style.marginBottom = '10px';
warningDiv.style.color = 'white';
warningDiv.innerHTML = '<strong>WARNING</strong>: Modifying \'Wait\' steps can have <strong>SERIOUS</strong> consequences. <br><a href="https://getstarted.sailthru.com/lo/lifecycle-optimizer/#Edit_Flows" target="_blank" style="color:white;text-decoration:underline;">Read this for more info.</a>';

// Create a new observer instance
var observer = new MutationObserver(function(mutationsList) {
  // Check each mutation that occurred
  for(var mutation of mutationsList) {
    // If an element with class 'modal-dialog' was added to the DOM, do something here
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      var addedNodes = mutation.addedNodes;
      for (var i = 0; i < addedNodes.length; i++) {
        if (addedNodes[i].classList && addedNodes[i].classList.contains('react-modal-group-enter')) {

          // check if this modal is for a 'wait' step
          var modalTitle = addedNodes[i].querySelector('.modal-title');
          if (modalTitle && modalTitle.innerText == 'Removing a Wait Step from an Active Flow') {

            // Add the warning div to the modal
            addedNodes[i].querySelector('.modal-header').insertAdjacentHTML("beforebegin", warningDiv.outerHTML);
          }
        }
        if (addedNodes[i].classList && addedNodes[i].classList.contains('step-editor')) {
           // Add the warning div to the modal
            warningDiv.style.marginRight = '10px'
            warningDiv.style.marginTop = '10px'
            addedNodes[i].querySelector('.close').insertAdjacentHTML("beforebegin", warningDiv.outerHTML);
            console.log('Side Panel Opened!');
        }
      }
    }

  }
});

// Start observing the target node for configured mutations
var config = { childList: true, subtree: true };
observer.observe(targetNode, config);
