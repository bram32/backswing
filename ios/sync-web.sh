#!/bin/sh
# Copies the built web app into the iOS bundle folder. Run before xcodegen / fastlane.
set -e
cd "$(dirname "$0")/.."
node build.js >/dev/null
rm -rf ios/FreeRelief/web
cp -R dist/site ios/FreeRelief/web
echo "web app synced into ios/FreeRelief/web"
