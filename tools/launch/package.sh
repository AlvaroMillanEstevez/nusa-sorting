#!/bin/bash
# Builds the production game and packs it into a .zip for a portal: index.html at the root of the zip, relative
# paths only. Checks the limits on the way.
#
#   npm run package        → release/nusa-sorting-YYYYMMDD-<commit>.zip       (the game's own build: no SDK, no ads)
#   npm run package:poki   → release/nusa-warung-sort-poki-YYYYMMDD-<commit>.zip (Poki's SDK and ads)
set -euo pipefail
cd "$(dirname "$0")/../.."

target=${1:-web}
if [ "$target" = poki ]; then
  npm run build:poki
  out=dist-poki
  name="nusa-warung-sort-poki-$(date +%Y%m%d)-$(git rev-parse --short HEAD)"
else
  npm run build
  out=dist
  name="nusa-sorting-$(date +%Y%m%d)-$(git rev-parse --short HEAD)"
fi

# Nothing from development may reach the build: no dev scenes, no demo levels, no tools.
for marker in GalleryScene UikitScene CoverScene previewLevel preview-showcase demo-levels resetSave; do
  if grep -q -- "$marker" $out/assets/*.js; then echo "✗ the build contains '$marker'" >&2; exit 1; fi
done
# Relative paths only (portals serve the game from a subfolder in an iframe).
if grep -Eq '(src|href)="/' $out/index.html; then echo "✗ $out/index.html has an absolute path" >&2; exit 1; fi

# No text selection on body, with every prefix (the CSS minifier drops -moz- and -ms-).
for prop in -webkit-user-select -moz-user-select -ms-user-select ' user-select'; do
  if ! grep -q -- "$prop: none" $out/index.html; then echo "✗ $out/index.html lacks '$prop: none'" >&2; exit 1; fi
done

# The SDK only where it belongs: Poki's in the Poki build (its one allowed outside request), none in the other.
if [ "$target" = poki ]; then
  grep -q 'game-cdn.poki.com/scripts/v2/poki-sdk.js' $out/index.html || { echo "✗ the Poki build lacks Poki's SDK" >&2; exit 1; }
  outside=$(grep -oE '(src|href)="https?://[^"]+"' $out/index.html | grep -v 'game-cdn.poki.com' || true)
  if [ -n "$outside" ]; then echo "✗ outside requests besides Poki's SDK: $outside" >&2; exit 1; fi
else
  if grep -q 'poki' $out/index.html $out/assets/*.js; then echo "✗ the game's own build contains Poki's SDK" >&2; exit 1; fi
fi

files=$(find $out -type f | wc -l)
bytes=$(du -sb $out | cut -f1)
mb=$(awk "BEGIN { printf \"%.2f\", $bytes / 1048576 }")
echo "build: $files files, $mb MB (limits: 1500 files; keep under 20 MB)"
if [ "$files" -gt 1500 ]; then echo "✗ too many files" >&2; exit 1; fi
if [ "$bytes" -gt $((20 * 1048576)) ]; then echo "✗ over 20 MB" >&2; exit 1; fi

mkdir -p release
zipfile="release/$name.zip"
rm -f "$zipfile"
(cd $out && zip -qr -X "../$zipfile" .)
echo "✓ $zipfile ($(du -h "$zipfile" | cut -f1))"
unzip -l "$zipfile" | tail -n +4 | head -n -2 | tail -3
