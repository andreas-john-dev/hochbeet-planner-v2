#!/usr/bin/env bash
# Builds dist/ for the AgentCore code deployment: the agent plus all dependencies as wheels
# for the runtime (Linux ARM64, Python 3.13). Infra zips dist/ as code asset.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
requirements="$(mktemp)"
trap 'rm -f "$requirements"' EXIT
uv export --frozen --no-dev --no-hashes --no-emit-project --quiet -o "$requirements"
uv pip install --quiet --target dist --requirements "$requirements" \
  --python-version 3.13 --python-platform aarch64-manylinux2014 --only-binary :all:
cp main.py dist/
cp -r src/bed_assistant dist/
find dist -name '__pycache__' -type d -prune -exec rm -rf {} +
echo "bed-assistant: dist/ $(du -sh dist | cut -f1)"
