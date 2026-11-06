// Helpers that find and run the rzv CLI. No OpenCode imports, so tests run with plain Node.
import { execFile } from "node:child_process"
import { accessSync, constants } from "node:fs"
import { homedir } from "node:os"
import { delimiter, join } from "node:path"

export const MIN_RZV = "0.26.0"
export const INSTALL_HINT =
  "Install the Runzivo CLI with `curl -fsSL https://runzivo.dev/downloads/rzv/install.sh | sh`, run `rzv login`, then try again."
export const SIZES = ["2vcpu-8gb", "4vcpu-16gb", "8vcpu-32gb", "16vcpu-64gb"] as const
export const LIFETIMES = ["8h", "12h", "24h"] as const

export type Env = Record<string, string | undefined>
export type Result = { code: number; stdout: string; stderr: string }

function executable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

// RZV_BIN, then PATH, then ~/.local/bin/rzv.
export function findRzv(env: Env = process.env): string | undefined {
  if (env.RZV_BIN) return executable(env.RZV_BIN) ? env.RZV_BIN : undefined
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir && executable(join(dir, "rzv"))) return join(dir, "rzv")
  }
  const local = join(env.HOME ?? homedir(), ".local", "bin", "rzv")
  return executable(local) ? local : undefined
}

export function run(file: string, args: string[], opts: { timeoutMs?: number; signal?: AbortSignal; env?: Env } = {}) {
  return new Promise<Result>((resolve) => {
    execFile(
      file,
      args,
      { timeout: opts.timeoutMs ?? 120_000, signal: opts.signal, env: opts.env as NodeJS.ProcessEnv, maxBuffer: 8 << 20 },
      (err, stdout, stderr) => {
        const e = err as (NodeJS.ErrnoException & { code?: number | string; killed?: boolean }) | null
        let code = 0
        if (e) code = typeof e.code === "number" ? e.code : e.killed ? 124 : 1
        resolve({ code, stdout: String(stdout), stderr: String(stderr) })
      },
    )
  })
}

// Returns true when version a >= b (plain x.y.z).
export function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

export function parseVersion(out: string): string | undefined {
  return out.match(/rzv\s+v?(\d+\.\d+\.\d+)/)?.[1]
}

// Sandbox names are opencode-<slug>-<4 hex>, so plugin usage can be counted.
export function sandboxName(base: string, rand: string): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
  return `opencode-${slug || "sandbox"}-${rand}`
}

const HINTS: Record<string, string> = {
  credit_exhausted: "Add credit to the workspace in the Runzivo portal (Billing), then try again.",
  sandbox_capacity_busy: "Runzivo has no free capacity for that size right now. Try again in a few minutes, or use a smaller size.",
  no_capacity: "Try again in a few minutes, or use a smaller size.",
  sandbox_limit_reached: "Stop or delete a running sandbox first. rzv_sandbox_status lists them.",
  sandbox_not_found: "Check the id with rzv_sandbox_status.",
}

// Turns a failed rzv --json call into one clear message.
export function explain(r: Result): string {
  let code = ""
  let message = ""
  for (const line of r.stderr.trim().split("\n").reverse()) {
    try {
      const j = JSON.parse(line)
      if (j && typeof j.error === "string") {
        code = j.error
        message = String(j.message ?? "")
        break
      }
    } catch {}
  }
  if (!message) message = r.stderr.trim().replace(/^rzv:\s*/, "") || `rzv exited with status ${r.code}`
  if (r.code === 3) return message.includes("rzv login") ? message : `${message} Run \`rzv login\` in a terminal, then try again.`
  if (r.code === 124) return "rzv timed out. Try again; `rzv sandboxes list` shows what happened."
  const hint = HINTS[code]
  return [code ? `${message} (${code})` : message, hint].filter(Boolean).join(" ")
}

export type Sandbox = {
  id: string
  name: string
  size: string
  status: string
  disk_gib?: number
  lifetime_hours?: number
  expires_at?: string | null
  remaining_seconds?: number
  runtime_seconds?: number
  credits_used?: number
  error?: { code?: string; message?: string } | null
}

function hm(s?: number): string {
  if (s === undefined || s === null) return "-"
  const m = Math.max(0, Math.floor(s / 60))
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function describe(s: Sandbox): string {
  const lines = [
    `${s.name} (${s.id})`,
    `  status: ${s.status}   size: ${s.size}   disk: ${s.disk_gib ?? "-"} GiB`,
    `  expires: ${s.expires_at ?? "not started"}   time left: ${hm(s.remaining_seconds)}   lifetime: ${s.lifetime_hours ?? "-"}h`,
    `  run time: ${hm(s.runtime_seconds)}   credits used: ${s.credits_used ?? "-"}`,
  ]
  if (s.error?.code) lines.push(`  error: ${s.error.code}${s.error.message ? ` (${s.error.message})` : ""}`)
  return lines.join("\n")
}
