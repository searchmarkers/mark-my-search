#! /bin/sh

rm --force --recursive dist
echo "Compilation artefacts cleaned. Compiling with tsc…"

npx tsc --project tsconfig.json
echo "Compilation finished."
