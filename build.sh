#!/bin/bash

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -r css fonts img js LICENSE manifest.json *.html dist/chrome
sed -i '' '/  "applications": {/,/  },/d' dist/chrome/manifest.json
pushd dist/chrome; zip -r ../chrome.zip *; popd

cp -r css fonts img js LICENSE manifest.json *.html dist/firefox
pushd dist/firefox; zip -r ../firefox.xpi *; popd
