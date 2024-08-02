# Mark My Search

*Mark My Search* is a browser extension that finds and highlights phrases.

It takes inspiration from many other extensions, including the now legendary SearchWP add-on for Firefox.

**Some of the ways you can use it:**

* A replacement for the browser's find-in-page function (`Ctrl`/`Cmd` + `F`).
  * *Mark My Search*'s highlighting stays up to date on pages with infinite scrolling and other dynamic content.
  * You can search for multiple keywords at once.
  * You can edit advanced matching options for each keyword:  
    Case sensitivity; Whole words only; [Stemming](https://en.wikipedia.org/wiki/Stemming) mode; [Diacritics](https://en.wikipedia.org/wiki/Diacritic) sensitivity; **[Regex](https://en.wikipedia.org/wiki/Regular_expression) mode**.
  
* Finding the relevant parts of a page you visited from web search.
  * *Mark My Search* highlights keywords from online searches automatically. This setting is on by default, but it can be changed from the startpage or popup.

* Highlighting a set of keywords on certain websites.
  * *Mark My Search* can store lists of keywords and highlight them automatically on certain websites.
  * You can configure this in the "Keyword Lists" section of the popup.

**Common problems:**

* On pages which change frequently, *Mark My Search* can cause slowdown.
* Very many highlights can cause slowdown.
* Some pages, especially ones with a lot of Javascript, respond poorly to *Mark My Search*'s highlighting. NOTE: This is a fixable issue that is being worked on!


## On-page components

* Toolbar (control buttons, keyword controls, add-keyword control)
  * Keyword counts
  * Keyword jumping / stepping
* Highlighting
* Scrollbar markers


## Compatibility

**Mark My Search** is fully cross-browser. The source is designed to produce the same experience across all *modern* browsers based on Firefox or Chromium. Currently it is tested against the most recent releases.

* The `main` branch uses Manifest V3 and supports recent Firefox and Chromium versions.
* The `manifest-v2` branch uses Manifest V2 and contains the source for Firefox releases of *Mark My Search*. It will be **deprecated soon** in favour of Manifest V3 on both browsers.
* Safari is unsupported as I do not have access to an Apple computer.


## Store Listings

* [Firefox Browser Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/mark-my-search/)
* [Chrome Web Store](https://chrome.google.com/webstore/detail/mark-my-search/lijbnhoniejpjjgemoifpjklobhakinb)
* [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mark-my-search/pgkppfodndbpalojpibdnlcdfcnidemj)
