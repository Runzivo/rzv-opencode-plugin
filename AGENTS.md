# rzv-opencode-plugin agent guide

Runzivo-wide rules: [rzv-business/operating-policy.md](https://github.com/Runzivo/rzv-business/blob/main/operating-policy.md) (local checkout: ../rzv-business/operating-policy.md). This file adds only plugin guidance.

- The plugin only runs the `rzv` CLI and `ssh`. Sandbox logic belongs in `rzv` in Runzivo/rzv-cli; no API calls, tokens or AI keys here.
- Keep runtime dependencies to `@opencode-ai/plugin`. `src/` ships as TypeScript; there is no build step.
- Run the checks in docs/testing.md on every change, and the live test before a tag.
- The repository is public: no internal hostnames, inventory, secrets or unreleased plans.
