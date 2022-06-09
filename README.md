# Mark My Search

**Research productivity extension**

**Mark My Search** is a Free and Open Source browser extension intended to render online research more efficient and effective.

It addresses the growing issue of finding answers to your search queries on the web, by facilitating the process of sifting through a multitude of results and taking you where you need to be once you get there. By highlighting the words you searched for across the web, **Mark My Search** lets you instantly know the relevancy of a result, where to find any occurrence of a match, and where your problem is addressed in the most depth.

The extension is instant to install and use, can be disabled temporarily or for any period of time, and intelligently processes pages to provide the best results with the least disruption possible.


## Features and Operation

Note that not all features are fully implemented, and a few may use temporary non-optimal code.

* Recognise a search based on a URL, and thus extract search terms.
  * Allow custom 'search engines' to be registered or detected from dynamic bookmarks.
  * Persist 'research' through links followed, including those opened in a new tab.
* Provide a 'research' navigation toolbar that displays whether or not certain terms occur.
  * Display the number of occurrences in the mouseover text.
* Highlight occurrences of your search terms in a 'research' page.
  * Highlight new occurrences as the page changes.
  * Allow editing, adding, and removing of terms.
    * Provide a context menu item for 'researching' selected text.
  * Allow configuration of how a match is determined for a specific term.
  * Detect 'research' when a search occurs without requiring a new page to be loaded.
* Provide a compact scrollbar view of where terms occur in a page.
* Allow occurrences to be 'jumped' (scrolled) to in either direction by clicking the term buttons.
  * Provide shortcuts for individual/global jumping, including different 'jump' modes.
  * Jump to occurrences usefully by 'focusing' whole buttons and links where possible, and otherwise focusing at a sensible point in a block where multiple terms occur.
* Allow the user to disable auto-activation for any period of time.
* Allow the user to disable 'research' and remove highlighting on a specific page.


## Advanced Use

**Mark My Search** provides a small set of tightly scoped features to balance efficiency with power. Advanced users can follow these steps to get more out of the extension.

* Individual term jumping: By default, a convenient shortcut is assigned to jump (scroll) between any term occurrences. In Firefox, additional similar shortcuts are provided to 'jump' term 0,1,…. In Chromium-based browsers these cannot be assigned automatically - visit <chrome://extensions/shortcuts> and assign e.g. Alt+1 with Alt+Shift+1, Alt+2…
* Lazy individual term jumping: a shortcut can be assigned to 'toggle select modes', which changes the mode from 'jump to term' to 'choose term'. Once a term is chosen its button will be lighter, and the general term jumping shortcut will instead 'jump' the chosen term.
* Problem reports: You can report problems with the extension, including websites which misbehave when highlighted or where highlighting is incorrect, from the toolbar icon. The report option opens a text box where you can input a description of the issue, then sends the following fields anonymously: version number, website URL (in the active tab), terms being highlighted in that website, and your message. The instant report option does the same thing without a description. Thanks for helping improve the extension!


## Compatibility

_As of 2022-05-31_

Releases are regularly ported between browsers.

* **Mark My Search v1.0.14** is compatible with reasonably modern Firefox releases, and will remain so while Manifest V2 is supported (so for the foreseeable future). V3 will be supported once it is at a reasonable stage of development.
* **Mark My Search v1.0.11** is compatible with browsers using very recent releases of Chromium; Manifest V3 is supported but V2 is not explicitly tested.


## Store Listings

* At [Chrome Web Store](https://chrome.google.com/webstore/detail/mark-my-search/lijbnhoniejpjjgemoifpjklobhakinb)
* At [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mark-my-search/pgkppfodndbpalojpibdnlcdfcnidemj)
* At [Firefox Browser Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/mark-my-search/)
