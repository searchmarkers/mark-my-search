__Note from ator-dev:__ Mark My Search may appear to be slowing down, despite having a number of ongoing mini-projects and issues. This is not the case, but I will be more or less not committing to it for about the next 2 months. After that period has expired, efforts will be renewed. I am still a student and have entered a very important period, so please bear with me while I deal with my my own unrelated work.

I am also aware that this README is very outdated. A fresh one to reflect our aspirations is coming in the future. Please get started in Discussions or contribute an idea in Issues in the meantime!

Any pull requests submitted in this time are, as ever, gratefully accepted and will be reviewed according to my spare time.

# Mark My Search

**Research productivity extension**

**Mark My Search** is a Free and Open Source browser extension to render online research more efficient and effective.

It addresses the growing issue of finding answers to your search queries, speeding up the process of sifting through results and getting you where you need to be once you're there. By highlighting the words you search for across the web, **Mark My Search** lets you instantly know page relevancy, where to find matches, and where your problem is addressed in the most depth.

The extension is instant to install and use, can be personalised to meet your particular needs, and efficiently processes pages to provide the best results with the least disruption possible.


## Features and Operation

* Provide a colourful, unobtrusive interface to finding words within a page.
* Display in realtime which words occur, showing the match count in a tooltip.
* Highlight all occurrences of your words.
  * Highlight new occurrences as the page changes.
* Provide matching options for advanced use.
  * Optionally match letter case, word stems, whole words only, or diacritics.
  * Allow custom regular expressions.
* Recognise a search based on a URL, extracting search terms.
  * Allow custom 'search engines' to be registered.
* Allow words to be extracted from selected text.
* Persist search words through links followed or opened in a new tab.
* Allow creation, modification, and deletion of terms.
* Provide a compact scrollbar view of where terms occur in the page.
* Allow occurrences to be 'jumped' (scrolled) to in either direction by clicking the term buttons.
  * Provide shortcuts for individual/global jumping, including different 'jump' modes.
  * Jump to occurrences usefully by 'focusing' whole buttons and links where possible, and otherwise focusing at a sensible point in a block where multiple terms occur.
* Allow the user to disable auto-highlighting for any period of time.
* Allow the user to deactivate highlighting on a specific page.
* Allow websites to be excluded from auto-highlighting or modification.


## Advanced Use

**Mark My Search** provides a small set of tightly scoped features to balance efficiency with power. Advanced users can follow these steps to get more out of the extension.

* Individual term jumping: A convenient shortcut is assigned to jump (scroll) between word occurrences. In Firefox, additional similar shortcuts are provided for jumping to specific terms. In Chromium-based browsers these cannot be assigned automatically, but may be changed at <chrome://extensions/shortcuts>.
* Individual term jumping (lazy): A shortcut can be assigned to 'toggle select modes', which makes the individual jumping shortcuts choose a term to 'select'. Selected term buttons are highlighted, and the general term jumping shortcut will instead jump to occurrences of this word.
* Problem reports: You can report problems with the extension, including websites which misbehave when highlighted or where highlighting is incorrect, from the anonymous message field in the popup. Thank you for helping improve the extension!


## Compatibility

**Mark My Search** is fully cross-browser. Its source is designed to produce the same experience across all *modern* browsers based on Firefox or Chromium. Any inconsistency between platforms should be considered a bug to be addressed as far as possible.

* The Manifest V2 branch supports modern Firefox releases. This branch is stable and contains all important features including backports, despite no longer being under active development. It should work on Chromium but is not explicitly tested.
* The Manifest V3 branch supports recent Chromium releases and very recent Firefox releases (with certain advanced flags enabled). This is being developed for the highest stability and consistency, and will receive all future enhancements and features.
* Safari will remain unsupported until a developer with an Apple device contributes maintainable compatibility code.


## Store Listings

* At [Chrome Web Store](https://chrome.google.com/webstore/detail/mark-my-search/lijbnhoniejpjjgemoifpjklobhakinb)
* At [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mark-my-search/pgkppfodndbpalojpibdnlcdfcnidemj)
* At [Firefox Browser Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/mark-my-search/)
