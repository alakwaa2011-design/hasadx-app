#!/usr/bin/env bash
set -euo pipefail

: "${PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH:?Playwright WebKit executable path is required}"

webkit_root="$(cd "$(dirname "$PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH")" && pwd -P)"
browser_variant="minibrowser-gtk"

for argument in "$@"; do
  if [[ "$argument" == "--headless" ]]; then
    browser_variant="minibrowser-wpe"
    break
  fi
done

browser_root="$webkit_root/$browser_variant"
browser_executable="$browser_root/bin/MiniBrowser"

if [[ ! -x "$browser_executable" ]]; then
  echo "Playwright WebKit browser is missing: $browser_executable" >&2
  echo "Run 'pnpm --filter @workspace/homework-app exec playwright install webkit'." >&2
  exit 1
fi

export WEBKIT_EXEC_PATH="$browser_root/bin"
export WEBKIT_INJECTED_BUNDLE_PATH="$browser_root/lib"
compiler_runtime_path="$(dirname "$(gcc -print-file-name=libatomic.so.1)")"
export LD_LIBRARY_PATH="$browser_root/lib:$browser_root/sys/lib:$compiler_runtime_path:${REPLIT_LD_LIBRARY_PATH:-${LD_LIBRARY_PATH:-}}"
export WEBKIT_FORCE_COMPLEX_TEXT=1

exec "$browser_executable" "$@"