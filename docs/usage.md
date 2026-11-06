# Tools and commands

The plugin adds seven tools that OpenCode's agent can call, and a slash command for each. The commands are short prompts that ask the agent to call the tool, so they use one model turn. A command or `permission` rule you define yourself with the same name wins.

| Tool | rzv command it runs |
| --- | --- |
| `rzv_sandbox_create` | `rzv sandboxes create`, then `rzv sandboxes ssh-config <id> --write` |
| `rzv_sandbox_status` | `rzv sandboxes get <id>` or `rzv sandboxes list` |
| `rzv_sandbox_connect` | `rzv sandboxes ssh-config <id> --write` |
| `rzv_sandbox_exec` | `ssh <id>.rzv <command>` |
| `rzv_sandbox_stop` | `rzv sandboxes stop <id>` |
| `rzv_sandbox_start` | `rzv sandboxes start <id>` |
| `rzv_sandbox_delete` | `rzv sandboxes delete <id>`, after you approve |

Every call uses your current `rzv` profile and selected workspace. Set `RZV_PROFILE` or run `rzv workspaces select <workspace>` before you start OpenCode to change them.

## Create

Options: `size` (`2vcpu-8gb` default, `4vcpu-16gb`, `8vcpu-32gb`, `16vcpu-64gb`), `lifetime` (`8h` default, `12h`, `24h`), `disk_gib` (5 to 64) and `name`. `rzv sandboxes sizes` shows what your workspace can use. The tool waits up to five minutes for the sandbox to run.

## Connect and run commands

`rzv_sandbox_exec` runs one command through the SSH alias with OpenSSH in batch mode (default timeout 300 seconds, at most 3600) and returns its output and exit status. For an interactive shell, run `ssh <id>.rzv` in a terminal, or `rzv sandboxes ssh <id>`.

## Sleep, wake and lifetime

Stop ends running processes and the compute charge. Files in `/workspace` stay; keep your work there or push it. A sandbox lives 8, 12 or 24 hours, even while stopped; 12h and 24h are offered only where Runzivo has turned them on. The timer starts when the sandbox first runs. At the end it stops for good and its files are deleted. It cannot be extended.

## Cost

`rzv_sandbox_status` shows run time and credits used so far. A 2 vCPU sandbox costs one equivalent minute per running minute; 4, 8 and 16 vCPU cost 2x, 4x and 8x. A stopped sandbox costs nothing. Prices: [runzivo.dev](https://runzivo.dev).

## Delete

OpenCode asks before it deletes. `opencode run` without `--auto` refuses the delete. To skip the question, set `"permission": {"rzv_sandbox_delete": "allow"}`. An agent whose own `permission` allows every tool also skips it.

Back to the [README](../README.md).
