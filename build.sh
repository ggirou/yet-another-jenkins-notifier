#!/bin/bash

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -r css fonts img js LICENSE manifest.json *.html dist/chrome
sed -i.bak '/  "applications": {/,/  },/d' dist/chrome/manifest.json
sed -i.bak 's/ data-no-firefox//' dist/chrome/*.html
pushd dist/chrome; rm *.bak; zip -r ../chrome.zip *; popd

cp -r css fonts img js LICENSE manifest.json *.html dist/firefox
rm dist/firefox/js/ga.js
sed -i.bak '/"author"/d' dist/firefox/manifest.json
sed -i.bak '/"minimum_chrome_version"/d' dist/firefox/manifest.json
sed -i.bak '/"content_security_policy"/d' dist/firefox/manifest.json
sed -i.bak '/"browser_style"/d' dist/firefox/manifest.json
sed -i.bak 's/, "js\/ga.js"//' dist/firefox/manifest.json
sed -i.bak '/ data-no-firefox/d' dist/firefox/*.html

pushd dist/firefox; rm *.bak; zip -r ../firefox.xpi *; popd
