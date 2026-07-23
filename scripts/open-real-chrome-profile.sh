#!/bin/zsh

set -euo pipefail

PROFILE_DIR="${1:-/Users/frankzhang/Documents/New project/predx-ui-qa/.auth/real-chrome-profile}"
TARGET_URL="${2:-https://predx.pro/news}"

mkdir -p "$PROFILE_DIR"

open -na "Google Chrome" --args "--user-data-dir=$PROFILE_DIR" "$TARGET_URL"
