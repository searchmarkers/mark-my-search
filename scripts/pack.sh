#! /bin/sh

scripts/install-manifest.sh $1

mkdir --parents pack
rm --force pack/mark_my_search-$1.zip
echo "Pack artefacts for $1 platform cleaned. Packing with zip…"

zip --recurse-paths pack/mark_my_search-$1.zip dist/ icons/ pages/ lib/ manifest.json
echo "Packed for $1 platform."
