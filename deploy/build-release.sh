#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# != 1 ]]; then
    echo "Usage: bash deploy/build-release.sh /absolute/new-release-directory" >&2
    exit 2
fi
[[ "$(uname -s)" == Linux ]] || { echo "Build Linux releases on Linux." >&2; exit 1; }
[[ "$(node --version)" == "v$(cat .node-version)" ]] || { echo "Install the Node version in .node-version." >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Build from a clean committed checkout." >&2; exit 1; }
python3 -c 'from pathlib import Path; assert not [p for p in Path(".").glob(".env*") if p.name != ".env.example"], "Build from a checkout without .env files"'
# Item icons are generated separately; don't compile the offline renderer's graphics stack.
npm ci --ignore-scripts
npm rebuild esbuild unrs-resolver
npm run lint
python3 -m unittest discover -s tests -p test_hosting.py -v
# No production credentials or production database are needed to build.
env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=file:.data/build.sqlite NEXT_TELEMETRY_DISABLED=1 npm run build
python3 deploy/host.py package --source "$PWD" --output "$1"
