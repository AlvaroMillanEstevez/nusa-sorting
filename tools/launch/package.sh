#!/bin/bash
# Builds the production game and packs it into a .zip for the CrazyGames developer portal (Basic Launch, no
# SDK): index.html at the root of the zip, relative paths only. Checks the limits on the way.
#
#   npm run package   → release/nusa-sorting-YYYYMMDD-<commit>.zip
set -euo pipefail
cd "$(dirname "$0")/../.."

npm run build

# Nothing from development may reach the build: no dev scenes, no demo levels, no tools.
for marker in GalleryScene UikitScene CoverScene previewLevel preview-showcase demo-levels resetSave installThemeArtTrial themeart; do
  if grep -q -- "$marker" dist/assets/*.js; then echo "✗ the build contains '$marker'" >&2; exit 1; fi
done
# Relative paths only (the portal serves the game from a subfolder in an iframe).
if grep -Eq '(src|href)="/' dist/index.html; then echo "✗ dist/index.html has an absolute path" >&2; exit 1; fi

files=$(find dist -type f | wc -l)
bytes=$(du -sb dist | cut -f1)
mb=$(awk "BEGIN { printf \"%.2f\", $bytes / 1048576 }")
echo "build: $files files, $mb MB (limits: 1500 files; 50 MB without the SDK, 20 MB for the mobile homepage)"
if [ "$files" -gt 1500 ]; then echo "✗ too many files" >&2; exit 1; fi
if [ "$bytes" -gt $((20 * 1048576)) ]; then echo "✗ over 20 MB" >&2; exit 1; fi

mkdir -p release
name="nusa-sorting-$(date +%Y%m%d)-$(git rev-parse --short HEAD)"
zipfile="release/$name.zip"
rm -f "$zipfile"
(cd dist && zip -qr -X "../$zipfile" .)
echo "✓ $zipfile ($(du -h "$zipfile" | cut -f1))"
unzip -l "$zipfile" | tail -n +4 | head -n -2
