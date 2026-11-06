// Runzivo sandboxes for OpenCode. Every action runs the rzv CLI; the plugin
// makes no API calls, stores no tokens and reads none of your code.
import { type Plugin, tool } from "@opencode-ai/plugin"
import { randomBytes } from "node:crypto"
import { basename } from "node:path"
import {
  INSTALL_HINT,
  LIFETIMES,
  MIN_RZV,
  SIZES,
  type Sandbox,
  describe,
  explain,
  findRzv,
  parseVersion,
  run,
  sandboxName,
  versionAtLeast,
} from "./rzv.ts"

const z = tool.schema
const id = () => z.string().regex(/^sbx_[A-Za-z0-9]{1,64}$/).describe("Sandbox id (sbx_...), from rzv_sandbox_status")

type Opts = { signal?: AbortSignal; timeoutMs?: number }

let checked: string | undefined

// Finds rzv and checks its version once per OpenCode run.
async function rzvBin(): Promise<string> {
  const bin = findRzv()
  if (!bin) throw new Error(`The rzv CLI was not found (RZV_BIN, PATH, ~/.local/bin/rzv). ${INSTALL_HINT}`)
  if (checked !== bin) {
    const v = parseVersion((await run(bin, ["--version"], { timeoutMs: 15_000 })).stdout)
    if (!v || !versionAtLeast(v, MIN_RZV)) {
      throw new Error(`This plugin needs rzv ${MIN_RZV} or later (found ${v ?? "unknown"}). ${INSTALL_HINT}`)
    }
    checked = bin
  }
  return bin
}

async function rzvJSON(args: string[], opts: Opts = {}): Promise<any> {
  const r = await run(await rzvBin(), [...args, "--json"], opts)
  if (r.code !== 0) throw new Error(explain(r))
  return JSON.parse(r.stdout)
}

async function sshConfig(sid: string, opts: Opts): Promise<string> {
  const r = await run(await rzvBin(), ["sandboxes", "ssh-config", sid, "--write"], opts)
  if (r.code !== 0) throw new Error(explain(r))
  return `${sid}.rzv`
}

const MOVING = new Set(["pending", "queued", "starting", "stopping"])

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((r) => {
    const t = setTimeout(r, ms)
    signal?.addEventListener("abort", () => (clearTimeout(t), r()), { once: true })
  })

// Polls until the sandbox leaves a moving state, or the deadline passes.
async function settle(s: Sandbox, opts: Opts & { deadlineMs: number }): Promise<Sandbox> {
  const end = Date.now() + opts.deadlineMs
  while (MOVING.has(s.status) && Date.now() < end) {
    await sleep(3000, opts.signal)
    if (opts.signal?.aborted) throw new Error(`Cancelled while ${s.name} (${s.id}) was ${s.status}.`)
    try {
      s = (await rzvJSON(["sandboxes", "get", s.id], { signal: opts.signal, timeoutMs: 30_000 })).sandbox as Sandbox
    } catch (e) {
      throw new Error(`${s.name} (${s.id}) is ${s.status}, but checking it failed: ${(e as Error).message}`)
    }
  }
  return s
}

async function lifecycle(verb: "start" | "stop", sid: string, opts: Opts): Promise<string> {
  const out = await rzvJSON(["sandboxes", verb, sid], opts)
  const s = await settle(out.sandbox as Sandbox, { ...opts, deadlineMs: 300_000 })
  const note = MOVING.has(s.status) ? "\nStill changing; check again with rzv_sandbox_status." : ""
  return describe(s) + note
}

const COMMANDS: Record<string, { description: string; template: string }> = {
  "rzv-create": {
    description: "Create a Runzivo sandbox (optional: size, lifetime, name)",
    template:
      "Create a Runzivo sandbox with the rzv_sandbox_create tool. Use these options if given: $ARGUMENTS. Report the sandbox id, SSH alias, expiry and credits.",
  },
  "rzv-status": {
    description: "Show Runzivo sandboxes: status, expiry, time left, credits",
    template: "Show Runzivo sandbox status with the rzv_sandbox_status tool for: $ARGUMENTS. Report the tool output as is.",
  },
  "rzv-connect": {
    description: "Write the SSH alias for a Runzivo sandbox",
    template: "Run the rzv_sandbox_connect tool for sandbox $1 and report the ssh command.",
  },
  "rzv-sleep": {
    description: "Stop a Runzivo sandbox and its compute charge",
    template: "Run the rzv_sandbox_stop tool for sandbox $1 and report the result.",
  },
  "rzv-wake": {
    description: "Start a stopped Runzivo sandbox",
    template: "Run the rzv_sandbox_start tool for sandbox $1 and report the result.",
  },
  "rzv-delete": {
    description: "Delete a Runzivo sandbox and all its files (asks first)",
    template: "Run the rzv_sandbox_delete tool for sandbox $1 and report the result.",
  },
  "rzv-exec": {
    description: "Run a command in a Runzivo sandbox over SSH",
    template: "Use the rzv_sandbox_exec tool. The first word is the sandbox id, the rest is the command: $ARGUMENTS. Report the output.",
  },
}

export const RunzivoPlugin: Plugin = async ({ worktree, directory }) => ({
  // Adds the slash commands, and makes delete ask unless the user configured it.
  async config(cfg) {
    cfg.command ??= {}
    for (const [name, c] of Object.entries(COMMANDS)) cfg.command[name] ??= c
    // A string permission ("allow" for everything) is the user's choice; leave it.
    cfg.permission ??= {}
    if (typeof cfg.permission === "object") (cfg.permission as Record<string, unknown>).rzv_sandbox_delete ??= "ask"
  },
  tool: {
    rzv_sandbox_create: tool({
      description:
        "Create a Runzivo sandbox (a Linux VM, files in /workspace) with the rzv CLI, wait for it to be created, and write its SSH alias <id>.rzv. Billed per running minute from the user's Runzivo credits.",
      args: {
        name: z.string().max(50).optional().describe("Short label; the sandbox is named opencode-<label>-<random>"),
        size: z.enum(SIZES).optional().describe("Default 2vcpu-8gb"),
        lifetime: z.enum(LIFETIMES).optional().describe("Default 8h; the sandbox is deleted at the end"),
        disk_gib: z.number().int().min(5).max(64).optional().describe("Disk size in GiB"),
      },
      async execute(a, ctx) {
        const name = sandboxName(a.name ?? basename(worktree || directory), randomBytes(2).toString("hex"))
        const args = ["sandboxes", "create", "--name", name, "--idempotency-key", `opencode-${randomBytes(8).toString("hex")}`]
        if (a.size) args.push("--size", a.size)
        if (a.lifetime) args.push("--lifetime", a.lifetime)
        if (a.disk_gib) args.push("--disk-gib", String(a.disk_gib))
        const created = (await rzvJSON(args, { signal: ctx.abort, timeoutMs: 600_000 })).sandbox as Sandbox
        const s = await settle(created, { signal: ctx.abort, deadlineMs: 300_000 })
        let ssh = ""
        try {
          ssh = `\nSSH: ssh ${await sshConfig(s.id, { signal: ctx.abort })}`
        } catch (e) {
          ssh = `\nSSH alias not written yet: ${(e as Error).message} Run rzv_sandbox_connect once it is running.`
        }
        return { title: `Created ${s.name}`, output: describe(s) + ssh, metadata: { sandbox_id: s.id } }
      },
    }),
    rzv_sandbox_status: tool({
      description:
        "Show Runzivo sandboxes in the selected workspace, or one sandbox: status, expiry, time left, run time and credits used.",
      args: { id: id().optional() },
      async execute(a, ctx) {
        if (a.id) return describe((await rzvJSON(["sandboxes", "get", a.id], { signal: ctx.abort })).sandbox)
        const out = await rzvJSON(["sandboxes", "list"], { signal: ctx.abort })
        const list = (out.sandboxes ?? []) as Sandbox[]
        if (!list.length) return "No sandboxes in this workspace. Create one with rzv_sandbox_create."
        return list.map(describe).join("\n") + `\n${list.length} sandbox(es); at most ${out.max_running ?? "-"} run at once.`
      },
    }),
    rzv_sandbox_connect: tool({
      description: "Write the SSH alias <id>.rzv for a running Runzivo sandbox and return the ssh command to open it.",
      args: { id: id() },
      async execute(a, ctx) {
        return `Connect from a terminal with: ssh ${await sshConfig(a.id, { signal: ctx.abort })}`
      },
    }),
    rzv_sandbox_stop: tool({
      description: "Stop (sleep) a Runzivo sandbox. Compute billing stops; files in /workspace stay. Running processes end.",
      args: { id: id() },
      async execute(a, ctx) {
        return lifecycle("stop", a.id, { signal: ctx.abort, timeoutMs: 300_000 })
      },
    }),
    rzv_sandbox_start: tool({
      description: "Start (wake) a stopped Runzivo sandbox. It cannot start after its lifetime ends.",
      args: { id: id() },
      async execute(a, ctx) {
        return lifecycle("start", a.id, { signal: ctx.abort, timeoutMs: 600_000 })
      },
    }),
    rzv_sandbox_delete: tool({
      description: "Delete a Runzivo sandbox and every file in it. The user is asked to confirm.",
      args: { id: id() },
      async execute(a, ctx) {
        const s = (await rzvJSON(["sandboxes", "get", a.id], { signal: ctx.abort })).sandbox as Sandbox
        await ctx.ask({
          permission: "rzv_sandbox_delete",
          patterns: [a.id],
          always: [],
          metadata: { sandbox: s.name, id: a.id },
        })
        await rzvJSON(["sandboxes", "delete", a.id], { signal: ctx.abort, timeoutMs: 300_000 })
        return `Deleted ${s.name} (${a.id}) and its files.`
      },
    }),
    rzv_sandbox_exec: tool({
      description:
        "Run a shell command in a running Runzivo sandbox over SSH (<id>.rzv) and return its output. Never put API keys or other secrets in the command.",
      args: {
        id: id(),
        command: z.string().min(1).describe("Shell command to run in the sandbox"),
        timeout: z.number().int().min(1).max(3600).optional().describe("Seconds, default 300"),
      },
      async execute(a, ctx) {
        const host = await sshConfig(a.id, { signal: ctx.abort })
        // "--" stops ssh reading options from the command, so it cannot change how ssh runs locally.
        const r = await run("ssh", ["-o", "BatchMode=yes", "--", host, a.command], {
          signal: ctx.abort,
          timeoutMs: (a.timeout ?? 300) * 1000,
        })
        const body = [r.stdout, r.stderr].filter((x) => x.trim()).join("\n")
        if (r.code === 255 && !r.stdout) throw new Error(`SSH to ${host} failed: ${r.stderr.trim()} Is the sandbox running?`)
        return { title: `exit ${r.code}`, output: `${body}\n[exit status ${r.code}]`, metadata: { exit: r.code } }
      },
    }),
  },
})

export default { id: "runzivo", server: RunzivoPlugin }
