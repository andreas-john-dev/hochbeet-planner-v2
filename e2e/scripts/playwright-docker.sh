#!/usr/bin/env bash
# Runs Playwright in the official image, like the CI job `e2e`, so screenshots render exactly
# as in CI (same Chromium, same fonts). Arguments go to `playwright test`, e.g.
#   pnpm --filter e2e test:docker --update-snapshots=changed
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
version=$(node -p "require('$root/e2e/node_modules/@playwright/test/package.json').version")

# Proxy and CA bundle pass through when the host needs them (e.g. cloud sessions).
proxy=()
for name in HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy; do
  [ -n "${!name:-}" ] && proxy+=(-e "$name")
done
ca=()
if [ -f /root/.ccr/ca-bundle.crt ]; then
  ca=(-v /root/.ccr/ca-bundle.crt:/ca.crt:ro -e NODE_EXTRA_CA_CERTS=/ca.crt)
fi

docker run --rm --ipc=host "${proxy[@]}" "${ca[@]}" \
  -v "$root:/work" -w /work/e2e \
  "mcr.microsoft.com/playwright:v$version-noble" \
  bash -c 'corepack enable >/dev/null && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm exec playwright test "$@"' _ "$@"
