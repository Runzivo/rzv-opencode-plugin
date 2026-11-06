# Security

## What the plugin does

It runs the `rzv` CLI and `ssh` on your machine, with fixed argument lists and no shell. It makes no network calls of its own, stores nothing, and does not read, copy or upload files from your project. The source is two short TypeScript files in `src/`.

## Your Runzivo sign-in

`rzv` keeps your sign-in in its own owner-only credentials file. The plugin never sees the token, never prints it and never passes it to a sandbox. Every action uses Runzivo's workspace roles: you can only see or change sandboxes in workspaces where you have `sandboxes:read` or `sandboxes:write`.

## SSH

`rzv sandboxes ssh-config <id> --write` writes `~/.ssh/rzv/<id>.conf`, included from `~/.ssh/config`. Connections use a short-lived user certificate, strict host verification against the Runzivo host CA, and no agent or X11 forwarding. The sandbox has no public SSH port; `rzv` relays the connection.

## AI provider keys

The plugin bundles no AI keys and never touches yours. OpenCode on your machine talks to your provider as usual. If you run an AI tool inside the sandbox, send its key over SSH into a mode 600 file in your home directory, for example:

```sh
<password-manager-command> | ssh <id>.rzv 'umask 077; cat > ~/.openai.key'
```

Never put keys in `/workspace`, in a `rzv_sandbox_exec` command, or in `rzv sandboxes exec --env`: commands can end up in logs and shell history.

## Commands the agent runs

`rzv_sandbox_exec` runs whatever command the agent picks, inside the sandbox only. Like OpenCode's own `bash` tool it is allowed by default. To review each one, set `"permission": {"rzv_sandbox_exec": "ask"}`. Deletes always ask unless you allow them.

Back to the [README](../README.md).
