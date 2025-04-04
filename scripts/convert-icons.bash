#! /bin/bash

mkdir --parents icons/dist/
rm --force icons/dist/*
echo "Icon conversion artefacts cleaned. Converting with sharp…"

sizes=(16 32 48 64 96 128 240 300)
for size in ${sizes[@]}; do
	npx sharp --input icons/mms.svg --output icons/dist/mms-${size}.png resize $size $size &
done
sizes=(32)
for size in ${sizes[@]}; do
	npx sharp --input icons/mms-off.svg --output icons/dist/mms-off-${size}.png resize $size $size &
done
wait
echo "Icons converted."
