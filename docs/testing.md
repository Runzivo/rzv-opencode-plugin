# Testing

## Checks (CI)

```sh
npm ci --ignore-scripts
npx tsc --noEmit
npm test
shellcheck scripts/*.sh
```

The unit tests in `test/` cover finding `rzv`, the version check, sandbox names, error messages and running commands without a shell. They use a fake `rzv` and never reach Runzivo.

## Live end-to-end test

`scripts/20-shared-e2e.sh` drives OpenCode itself: each step is one `opencode run` turn that calls a plugin tool, and `rzv` checks the result. It covers create, exec, status and credits, stop, start, that `/workspace` survives the stop, a refused delete without approval, and the approved delete. A trap deletes the sandbox if any step fails.

```sh
OPENCODE_BIN=<path to opencode 1.19.5> OPENAI_KEY_FILE=<mode 600 key file> \
  E2E_DIR=<empty directory> scripts/20-shared-e2e.sh
```

It refuses to run unless `rzv whoami` shows `Environment: shared`, uses OpenCode with its own config directories under `E2E_DIR`, and checks that the key does not appear in the saved output. Use the cheapest model your provider offers (default `openai/gpt-5-nano`).

Run it before every release. Set `PLUGIN_SPEC=github:Runzivo/rzv-opencode-plugin#vX.Y.Z` to test the published tag.

Back to the [README](../README.md).
