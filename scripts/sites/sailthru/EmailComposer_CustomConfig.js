// ==UserScript==
// @name        Email Composer - Custom Config
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     1.0
// @author      -
// @description 2023-10-03, 11:34:38 p.m.
// ==/UserScript==

let showStructureByDefault = true;

(function() {
    'use strict';

    function setCustomConfig(callback) {
        beePluginInstance.toggleStructure()

        let myBeeConfig = {
          uid: 'sailthru-prod-706',
          container: 'bee_plugin_container',
          autosave: 30,
          language: 'en-US',
          trackChanges: true,
          preventClose: true,
          editorFonts: {},
          contentDialog: {},
          defaultForm: {},
          roleHash: "",
          rowDisplayConditions: {},
          editSingleRow: false,
          commenting: true,
          commentingThreadPreview: true,
          commentingNotifications: true,
          disableLinkSanitize: true,
          advancedPermissions: {
            content: {
              image: {
                properties: {
                  imageWidth: {
                    show: false,
                  },
                  textAlign: {
                    show: true,
                    locked: true
                  },
                }
              },
            },
          },
          contentDefaults: {
            title: {
              hideContentOnMobile: true,
              defaultHeadingLevel: 'h3',
              blockOptions: {
                align: 'center',
                paddingTop: '5px',
                paddingRight: '5px',
                paddingBottom: '5px',
                paddingLeft: '5px',
              },
              mobileStyles: {
                textAlign: "center",
                fontSize: "30px",
                paddingTop: "20px",
                paddingRight: "20px",
                paddingBottom: "20px",
                paddingLeft: "20px",
              },
            },
            button: {
              label: "My New Label",
              href: "http://www.google.com",
              width: "35%",
              styles: {
                color: "#ffffff",
                fontSize: '22px',
                fontFamily: "'Comic Sans MS', cursive, sans-serif",
                backgroundColor: "#FF819C",
                borderBottom: "0px solid transparent",
                borderLeft: "0px solid transparent",
                borderRadius: "25px",
                borderRight: "0px solid transparent",
                borderTop: "0px solid transparent",
                lineHeight: "200%",
                maxWidth: "100%",
                paddingBottom: "5px",
                paddingLeft: "20px",
                paddingRight: "20px",
                paddingTop: "5px"
              },
              blockOptions: {
                paddingBottom: "20px",
                paddingLeft: "20px",
                paddingRight: "20px",
                paddingTop: "20px",
                align: "center",
                hideContentOnMobile: true
              },
              mobileStyles: {
                paddingBottom: "10px",
                paddingLeft: "10px",
                paddingRight: "10px",
                paddingTop: "10px",
                textAlign: "center",
                fontSize: "40px",
              },
            },
            social: {
              icons: [
                {
                  type: 'custom',
                  name: 'Facebook',
                  image: {
                    prefix: 'https://www.facebook.com/',
                    alt: 'Facebook',
                    src: `https://img.icons8.com/dusk/64/000000/facebook-new--v2.png`,
                    title: 'Facebook',
                    href: 'https://www.facebook.com/'
                  },
                  text: ''
                }
              ],
              blockOptions: {
                align: "center",
                hideContentOnMobile: true,
                paddingBottom: "10px",
                paddingLeft: "10px",
                paddingRight: "10px",
                paddingTop: "10px",
              },
              mobileStyles: {
                paddingTop: "10px",
                paddingRight: "10px",
                paddingBottom: "10px",
                paddingLeft: "10px",
                textAlign: "right",
              },
            }
          }
        }
        beePluginInstance.save()

        setTimeout(() => {
            beePluginInstance.loadConfig(myBeeConfig);
            setTimeout(() => {
                beePluginInstance.reload();
            }, 1000);
        }, 1000);


        console.log('New config loaded')
    }

    // Wait until the beePluginInstance is available
    const interval = setInterval(() => {
        if (typeof beePluginInstance !== 'undefined' && document.querySelector('#bee_plugin_container')) {

            setCustomConfig(() => beePluginInstance.toggleStructure());
            clearInterval(interval);
        }
    }, 1000);
})();
