#!/usr/bin/env bash
# Live end-to-end test of the plugin through OpenCode itself, on Runzivo shared.
# Each step is one `opencode run` turn that calls a plugin tool; rzv checks the result.
#
#   OPENCODE_BIN=<opencode 1.19.5> OPENAI_KEY_FILE=<mode-600 key file> E2E_DIR=<empty dir> \
#     RZV_PROFILE=shared scripts/20-shared-e2e.sh
#
# Optional: PLUGIN_SPEC (default: this checkout), MODEL (default openai/gpt-5-nano),
# RZV_E2E_LOCK (a directory used as a lock so only one test uses sandboxes at a time).
set -euo pipefail

: "${OPENCODE_BIN:?set OPENCODE_BIN}" "${OPENAI_KEY_FILE:?set OPENAI_KEY_FILE}" "${E2E_DIR:?set E2E_DIR}"
repo=$(cd "$(dirname "$0")/.." && pwd)
spec=${PLUGIN_SPEC:-file://$repo}
model=${MODEL:-openai/gpt-5-nano}
lock=${RZV_E2E_LOCK:-$HOME/.cache/rzv-opencode-e2e.lock}
run_id=e2e$(date -u +%H%M%S)
log() { printf '== %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

rzv whoami | grep -q '^Environment: shared ' || fail "rzv whoami must show Environment: shared"
[ "$(stat -f %Lp "$OPENAI_KEY_FILE" 2>/dev/null || stat -c %a "$OPENAI_KEY_FILE")" = 600 ] || fail "key file must be mode 600"
"$OPENCODE_BIN" --version

mkdir -p "$(dirname "$lock")"
until mkdir "$lock" 2>/dev/null; do log "waiting for $lock"; sleep 20; done
cleanup() {
  rzv sandboxes list --json | python3 -I -c 'import sys,json
for s in json.load(sys.stdin)["sandboxes"]:
    if s["name"].startswith(sys.argv[1]): print(s["id"])' "opencode-$run_id-" |
    while read -r id; do log "cleanup: deleting $id"; rzv sandboxes delete "$id" >/dev/null || true; done
  rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT

home=$E2E_DIR/home proj=$E2E_DIR/proj
mkdir -p "$home"/{config,data,cache,state,tmp} "$proj"
export XDG_CONFIG_HOME=$home/config XDG_DATA_HOME=$home/data XDG_CACHE_HOME=$home/cache \
  XDG_STATE_HOME=$home/state TMPDIR=$home/tmp OPENCODE_DISABLE_AUTOUPDATE=1
cat >"$proj/opencode.json" <<EOF
{"\$schema": "https://opencode.ai/config.json", "plugin": ["$spec"],
 "provider": {"openai": {"options": {"apiKey": "{file:$OPENAI_KEY_FILE}"}}}}
EOF

n=0
turn() { # turn [--auto] <prompt>; output in $E2E_DIR/turn-N.jsonl
  n=$((n + 1)); local auto=()
  if [ "$1" = --auto ]; then auto=(--auto); shift; fi
  log "turn $n: $1"
  (cd "$proj" && "$OPENCODE_BIN" run "${auto[@]}" --format json -m "$model" "$1") >"$E2E_DIR/turn-$n.jsonl" 2>"$E2E_DIR/turn-$n.err" || true
  last=$E2E_DIR/turn-$n.jsonl
}
used() { grep -q "\"tool\":\"$1\"" "$last" || fail "turn $n did not call $1"; }
field() { rzv sandboxes get "$sid" --json | python3 -I -c 'import sys,json; print(json.load(sys.stdin)["sandbox"][sys.argv[1]])' "$1"; }

turn "Call the rzv_sandbox_create tool with name \"$run_id\" and lifetime \"8h\". Then reply with the sandbox id only."
used rzv_sandbox_create
sid=$(rzv sandboxes list --json | python3 -I -c 'import sys,json
print(next(s["id"] for s in json.load(sys.stdin)["sandboxes"] if s["name"].startswith(sys.argv[1])))' "opencode-$run_id-")
log "created $sid ($(field name)), status $(field status)"

turn "Call the rzv_sandbox_exec tool with id \"$sid\" and command \"uname -sm; echo plugin-ok > /workspace/e2e.txt; echo home-ok > ~/e2e-home.txt; cat /workspace/e2e.txt\". Reply with the output."
used rzv_sandbox_exec
grep -q 'plugin-ok' "$last" || fail "exec output missing"

turn "Call the rzv_sandbox_status tool with id \"$sid\". Reply with the credits used."
used rzv_sandbox_status
grep -q 'credits used' "$last" || fail "status output missing credits"
log "metering: runtime_seconds=$(field runtime_seconds) credits_used=$(field credits_used)"

turn "Call the rzv_sandbox_stop tool with id \"$sid\"."
used rzv_sandbox_stop
[ "$(field status)" = stopped ] || fail "expected stopped, got $(field status)"

turn "Call the rzv_sandbox_start tool with id \"$sid\"."
used rzv_sandbox_start
[ "$(field status)" = running ] || fail "expected running, got $(field status)"

turn "Call the rzv_sandbox_exec tool with id \"$sid\" and command \"cat /workspace/e2e.txt; cat ~/e2e-home.txt || echo home-gone\"."
used rzv_sandbox_exec
grep -q 'plugin-ok' "$last" || fail "/workspace did not survive stop and start"
if grep -q 'home-ok' "$last"; then log "home directory survived stop and start"; else log "home directory did not survive"; fi

turn "Call the rzv_sandbox_delete tool with id \"$sid\"."
[ "$(field status)" != deleted ] || fail "delete ran without the user's approval"
log "delete without approval was refused; sandbox still $(field status)"

turn --auto "Call the rzv_sandbox_delete tool with id \"$sid\"."
used rzv_sandbox_delete
if rzv sandboxes get "$sid" --json >/dev/null 2>&1; then log "after delete: $(field status)"; else log "after delete: not found"; fi

if grep -qF -f "$OPENAI_KEY_FILE" "$E2E_DIR"/turn-*; then fail "the API key appears in the evidence"; fi
log "PASS ($n turns, sandbox $sid)"
