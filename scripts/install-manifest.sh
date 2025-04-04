#! /bin/sh

ln --force --symbolic platform/$1/manifest.json manifest.json
echo "Installed manifest for $1 platform."
