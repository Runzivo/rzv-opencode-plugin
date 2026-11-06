import assert from "node:assert/strict"
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { describe, explain, findRzv, parseVersion, run, sandboxName, versionAtLeast } from "../src/rzv.ts"

function fakeRzv(dir: string, body: string): string {
  const f = join(dir, "rzv")
  writeFileSync(f, `#!/bin/sh\n${body}\n`)
  chmodSync(f, 0o755)
  return f
}

test("findRzv prefers RZV_BIN, then PATH, then ~/.local/bin", () => {
  const a = mkdtempSync(join(tmpdir(), "rzv-a-"))
  const home = mkdtempSync(join(tmpdir(), "rzv-h-"))
  const bin = fakeRzv(a, "true")
  assert.equal(findRzv({ RZV_BIN: bin, PATH: "", HOME: home }), bin)
  assert.equal(findRzv({ RZV_BIN: join(a, "missing"), PATH: a, HOME: home }), undefined)
  assert.equal(findRzv({ PATH: a, HOME: home }), bin)
  assert.equal(findRzv({ PATH: "", HOME: home }), undefined)
  const local = join(home, ".local", "bin")
  mkdirSync(local, { recursive: true })
  const lbin = fakeRzv(local, "true")
  assert.equal(findRzv({ PATH: "", HOME: home }), lbin)
})

test("version checks", () => {
  assert.equal(parseVersion("rzv 0.26.0 (commit abc)"), "0.26.0")
  assert.equal(parseVersion("something"), undefined)
  assert.ok(versionAtLeast("0.26.0", "0.26.0"))
  assert.ok(versionAtLeast("1.0.0", "0.26.0"))
  assert.ok(!versionAtLeast("0.25.9", "0.26.0"))
})

test("sandbox names start with opencode-", () => {
  assert.equal(sandboxName("My Repo!", "ab12"), "opencode-my-repo-ab12")
  assert.equal(sandboxName("", "ab12"), "opencode-sandbox-ab12")
  assert.ok(sandboxName("x".repeat(200), "ab12").length <= 80)
})

test("explain maps rzv errors to clear messages", () => {
  const j = (error: string, message: string, code = 1) => ({ code, stdout: "", stderr: JSON.stringify({ error, message }) + "\n" })
  assert.match(explain(j("credit_exhausted", "Out of credit.")), /Out of credit\. \(credit_exhausted\) Add credit/)
  assert.match(explain(j("sandbox_capacity_busy", "Busy.")), /Busy\. \(sandbox_capacity_busy\) Try again in a few minutes/)
  assert.match(explain(j("sandbox_limit_reached", "Max.")), /Stop or delete/)
  assert.equal(explain(j("auth", "Sign in with `rzv login` first.", 3)), "Sign in with `rzv login` first.")
  assert.match(explain(j("auth", "Credentials expired.", 3)), /Run `rzv login` in a terminal/)
  assert.equal(explain({ code: 1, stdout: "", stderr: "rzv: boom\n" }), "boom")
  assert.match(explain({ code: 124, stdout: "", stderr: "" }), /timed out/)
})

test("run returns exit status and output without a shell", async () => {
  const d = mkdtempSync(join(tmpdir(), "rzv-r-"))
  const bin = fakeRzv(d, 'echo "out:$1"; echo err >&2; exit 7')
  const r = await run(bin, ["a b; touch x"])
  assert.equal(r.code, 7)
  assert.equal(r.stdout, "out:a b; touch x\n")
  assert.equal(r.stderr, "err\n")
})

test("describe shows expiry, time left and credits", () => {
  const out = describe({ id: "sbx_1", name: "opencode-x", size: "2vcpu-8gb", status: "running", expires_at: "2026-11-06T20:00:00Z", remaining_seconds: 3723, credits_used: 1.5, error: { code: "credit_exhausted" } })
  assert.match(out, /time left: 1h 2m/)
  assert.match(out, /credits used: 1.5/)
  assert.match(out, /error: credit_exhausted/)
})

test("run reports a missing program and a cancel clearly", async () => {
  const r = await run("/nonexistent/rzv", [])
  assert.equal(r.code, 127)
  assert.match(explain(r), /was not found/)
  const d = mkdtempSync(join(tmpdir(), "rzv-s-"))
  const ac = new AbortController()
  const p = run(fakeRzv(d, "sleep 5"), [], { signal: ac.signal })
  ac.abort()
  assert.equal(explain(await p), "Cancelled.")
})
