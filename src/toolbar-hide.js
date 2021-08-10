// Only known to work in some 'about:' pages.
document.defaultView.locationbar.visible = false;
document.defaultView.toolbar.visible = false;

// Alternate approach:
// https://developer.mozilla.org/en-US/docs/Web/API/Window/open
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs
// https://stackoverflow.com/questions/15281000/duplicate-a-tab-in-chrome-without-reloading-the-page
