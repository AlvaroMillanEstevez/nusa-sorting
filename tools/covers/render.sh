#!/bin/bash
# Renders the three store covers to PNG at their exact sizes (1920×1080, 800×1200, 800×800) from the dev
# server's ?cover page, in a headless Chrome at 2 device pixels per CSS pixel.
#
#   npm run dev              (in another terminal; or set URL to any running dev server)
#   tools/covers/render.sh   → docs/launch/covers/cover-*.png
#
# CHROME may point to any Chrome/Chromium binary; by default the Playwright headless shell is used, with the
# libraries extracted to ~/.cache/nusa-libs on WSL (see the project notes).
set -euo pipefail
URL=${URL:-http://localhost:5180}
OUT=${OUT:-docs/launch/covers}
CHROME=${CHROME:-$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/*/ 2>/dev/null | tail -1)chrome-headless-shell}
LIBS=~/.cache/nusa-libs/root/usr/lib/x86_64-linux-gnu
mkdir -p "$OUT"
render() { # shape, css width, css height
  LD_LIBRARY_PATH=$LIBS:$LIBS/nss:${LD_LIBRARY_PATH:-} timeout 90 "$CHROME" --no-sandbox --hide-scrollbars \
    --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=2 --window-size="$2,$3" \
    --virtual-time-budget=8000 --screenshot="$OUT/cover-$1.png" "$URL/?cover=$1" >/dev/null 2>&1
  echo "$OUT/cover-$1.png ($(( $2 * 2 ))x$(( $3 * 2 )))"
}
render landscape 960 540
render portrait 400 600
render square 400 400
