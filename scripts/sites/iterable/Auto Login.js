// ==UserScript==
// @name        Login Screen - Auto Fill Username
// @namespace   Violentmonkey Scripts
// @match       https://auth.iterable.com/u/login/identifier*
// @grant       none
// @version     1.0
// @author      -
// @description Auto enters your username and proceeds to the password screen. Press 'Esc' within 2 seconds to cancel the auto-login.
// ==/UserScript==

// Delay in milliseconds (e.g., 5000 milliseconds = 5 seconds)
const delay = 0;

// Your email address
const myEmailAddress = 'your@email.com';

(function() {
    'use strict';

    let cancelAutoSignIn = false;

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.innerHTML = `Auto-login will proceed in ${delay/1000} seconds. Press 'Esc' to cancel.`;
    tooltip.style.position = 'fixed';
    tooltip.style.bottom = '10px';
    tooltip.style.right = '10px';
    tooltip.style.backgroundColor = 'black';
    tooltip.style.color = 'white';
    tooltip.style.padding = '10px';
    tooltip.style.zIndex = '9999';
    if(document.querySelector('#username')) {
      document.body.appendChild(tooltip);

      // Listen for 'Esc' key press
      document.addEventListener('keydown', function(event) {
          if (event.key === "Escape") {
              cancelAutoSignIn = true;
              tooltip.innerHTML = "Auto-login has been cancelled.";
          }
      });

      // Check if form is present
      const form = document.querySelector('form._form-login-id');
      if (form) {
          // Fill in the email
          const emailInput = document.querySelector('#username');
          if (emailInput) {
              emailInput.value = myEmailAddress;
          }

          // Delay and then click the "Sign in" button, unless 'Esc' is pressed
          setTimeout(function() {
              if (!cancelAutoSignIn && myEmailAddress.includes("@") && emailInput) {
                  const signInButton = document.querySelector('button._button-login-id');
                  if (signInButton) {
                      signInButton.click();
                  }
              } else {
                  tooltip.innerHTML = "Auto-login has been cancelled.";
              }
              // Remove tooltip after use
              setTimeout(() => tooltip.remove(), 2000);
          }, delay);
      }
    }
})();
