#!/bin/bash

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -r css fonts img js LICENSE manifest.json *.html dist/chrome
sed -i '' '/  "applications": {/,/  },/d' dist/chrome/manifest.json
sed -i '' 's/ data-no-firefox//' dist/chrome/*.html
pushd dist/chrome; zip -r ../chrome.zip *; popd

cp -r css fonts img js LICENSE manifest.json *.html dist/firefox
rm dist/firefox/js/ga.js
sed -i '' '/ data-no-firefox/d' dist/firefox/*.html

pushd dist/firefox; zip -r ../firefox.xpi *; popd
