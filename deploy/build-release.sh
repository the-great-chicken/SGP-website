#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# != 1 ]]; then
    echo "Usage: bash deploy/build-release.sh /absolute/new-release-directory" >&2
    exit 2
fi
[[ "$(uname -s)" == Linux ]] || { echo "Build Linux releases on Linux." >&2; exit 1; }
[[ "$(node --version)" == "v$(cat .node-version)" ]] || { echo "Install the Node version in .node-version." >&2; exit 1; }
command -v restic >/dev/null || { echo "Install restic so the full hosting test suite can run." >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Build from a clean committed checkout." >&2; exit 1; }
python3 -c 'from pathlib import Path; assert not [p for p in Path(".").glob(".env*") if p.name != ".env.example"], "Build from a checkout without .env files"'
# Item icons are generated separately; don't compile the offline renderer's graphics stack.
npm ci --ignore-scripts
npm rebuild esbuild unrs-resolver

# Release packaging uses the same mandatory gate as CI. Keep its Python environment
# isolated from the checkout so a release cannot accidentally depend on a developer venv.
test_venv="$(mktemp -d)"
trap 'rm -rf "$test_venv"' EXIT
python3 -m venv "$test_venv"
"$test_venv/bin/python" -m pip install ".[test]"

# No production credentials or production database are needed to validate or build.
env -i \
    PATH="$test_venv/bin:$PATH" \
    HOME="$HOME" \
    PYTHON="$test_venv/bin/python" \
    DATABASE_URL=file:.data/build.sqlite \
    NEXT_TELEMETRY_DISABLED=1 \
    npm run check

python3 deploy/host.py package --source "$PWD" --output "$1"
