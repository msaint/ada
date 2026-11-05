#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -x "$PWD/work/runtime/node_modules/.bin/node" ]; then
  export PATH="$PWD/work/runtime/node_modules/.bin:$PATH"
fi
export APP_BASE_URL="http://localhost:${PORT:-3001}"
exec npm run dev -- --hostname 127.0.0.1 --port "${PORT:-3001}" "$@"
