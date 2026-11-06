# Runzivo Sandboxes for OpenCode

Create and manage [Runzivo](https://runzivo.dev) sandboxes from inside [OpenCode](https://opencode.ai). A sandbox is an isolated Linux microVM with your files in `/workspace`. OpenCode can create one, run commands in it over SSH, show what it costs, put it to sleep, wake it and delete it. Compute is charged per running minute from your Runzivo workspace credits; there is no separate plan.

[![CI](https://github.com/Runzivo/rzv-opencode-plugin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Runzivo/rzv-opencode-plugin/actions/workflows/ci.yml) [![Latest release](https://img.shields.io/github/v/release/Runzivo/rzv-opencode-plugin)](https://github.com/Runzivo/rzv-opencode-plugin/releases/latest) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Runzivo](https://img.shields.io/badge/Runzivo-sandboxes-0B0F14)](https://runzivo.dev/sandboxes/)

<img src="https://raw.githubusercontent.com/Runzivo/rzv-opencode-plugin/main/assets/demo.gif" width="1200" alt="Animated demo of Runzivo sandboxes for OpenCode, in a terminal panel: the rzv install and the plugin entry in opencode.json, then opencode run prompts call rzv_sandbox_create, rzv_sandbox_exec (Linux x86_64, plugin-ok), rzv_sandbox_status (7h 59m left, credits used), rzv_sandbox_stop, rzv_sandbox_start and rzv_sandbox_delete, which runs only after the first call is refused at the permission prompt and the second is approved. The sandbox ID shown is a placeholder." />

The plugin only runs the `rzv` CLI on your machine. It makes no API calls of its own, stores no tokens, and never reads or uploads your code.

## Requirements

- OpenCode 1.19.5 or later
- OpenSSH and a Runzivo account with a workspace that has credit
- The `rzv` CLI 0.26.0 or later, signed in:

  ```sh
  curl -fsSL https://runzivo.dev/downloads/rzv/install.sh | sh
  rzv login
  ```

## Install

Add the plugin to `opencode.json` in your project, or to `~/.config/opencode/opencode.json` for every project:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:Runzivo/rzv-opencode-plugin#v0.1.0"]
}
```

Restart OpenCode. It installs the plugin from GitHub at that tag. The plugin finds `rzv` in `RZV_BIN`, then `PATH`, then `~/.local/bin/rzv`.

## Use

Type a command, or just ask OpenCode ("start a 4 vCPU Runzivo sandbox and run the tests there").

| Command | What it does |
| --- | --- |
| `/rzv-create [size] [lifetime]` | Create a sandbox, wait until it runs, write the `<id>.rzv` SSH alias |
| `/rzv-status [id]` | Status, expiry, time left, run time and credits used |
| `/rzv-connect <id>` | Write the SSH alias and show `ssh <id>.rzv` |
| `/rzv-exec <id> <command>` | Run a command in the sandbox over SSH |
| `/rzv-sleep <id>` / `/rzv-wake <id>` | Stop or start the sandbox |
| `/rzv-delete <id>` | Delete it and all its files, after you confirm |

Sandboxes the plugin creates are named `opencode-<project>-<random>`. Details: [Tools and commands](docs/usage.md).

## Documentation

| Page | What it covers |
| --- | --- |
| [Tools and commands](docs/usage.md) | Every tool, its options, lifetime and billing |
| [Security](docs/security.md) | What runs where, keys, permissions |
| [Troubleshooting](docs/troubleshooting.md) | Errors and how to fix them |
| [Testing](docs/testing.md) | Unit tests and the live end-to-end test |
| [Releasing](docs/releasing.md) | Versions, tags, npm and the OpenCode ecosystem list |

MIT licensed ([LICENSE](LICENSE)). The `rzv` CLI and the Runzivo service keep their own licenses.
