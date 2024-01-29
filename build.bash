#!/bin/bash

# replace TypeScript-friendly imports with correct style:
# import("src/example.mjs") -> import(chrome.runtime.getURL("dist/example.mjs"))
script='s/(\b)import\("src((\/(\w|\.|-)+)*)"\)/\1import\(chrome.runtime.getURL\("dist\2"\))/'

swap=".build.swp"

# recursively monitor the JavaScript output directory for close-from-write-mode events
inotifywait --recursive --monitor dist/ --event close_write |
	while read path action file; do
		length=$(expr length $file)
		# ignore files which are not plain JavaScript
		if [ $length -lt 3 ] || [ ${file: -3} != ".js" ]; then
		if [ $length -lt 4 ] || [ ${file: -4} != ".mjs" ]; then
			continue
		fi fi
		# use sed script to transform file, and write this to swap file
		cat $path$file | sed -E "$script" > $swap
		# make sure we only write if the file contents are different (avoiding infinite recursion)
		if [ "$(diff --brief $swap $path$file)" ]; then
			cat $swap > $path$file
		fi
		rm $swap
		echo "rewrote $path$file due to $action"
	done
