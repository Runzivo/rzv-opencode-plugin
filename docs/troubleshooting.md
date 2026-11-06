# Troubleshooting

| Message | What to do |
| --- | --- |
| `The rzv CLI was not found` | Install it with `curl -fsSL https://runzivo.dev/downloads/rzv/install.sh \| sh`, or set `RZV_BIN` to its path. Restart OpenCode. |
| `This plugin needs rzv 0.26.0 or later` | Run the install command again to update `rzv`. |
| `Sign in with rzv login first` or `Your sign-in has expired` | Run `rzv login` in a terminal. The next tool call works without restarting OpenCode. |
| `credit_exhausted` | The workspace is out of credit. Add credit in the Runzivo portal, then start the sandbox again. |
| `sandbox_capacity_busy` or `no_capacity` | No free capacity for that size right now. Try again in a few minutes, or pick a smaller size. |
| `sandbox_limit_reached` | The workspace runs its maximum number of sandboxes. Stop or delete one (`/rzv-status` lists them). |
| `size_unavailable` | That size is not offered. `rzv sandboxes sizes` lists the ones you can use. |
| `sandbox_expired` | The lifetime ended. Create a new sandbox. |
| `SSH to <id>.rzv failed` | The sandbox must be running: `/rzv-wake <id>`. Check `ssh -V` works. |
| Delete says permission rejected | You declined, or you used `opencode run` without `--auto`. Run it again and approve. |
| The tools do not appear | Check the `plugin` entry, then restart OpenCode. `opencode debug config` shows the loaded commands. |

A sandbox you forget about still stops and is deleted at the end of its lifetime. `rzv sandboxes list` shows every sandbox in the workspace, and `rzv sandboxes delete <id>` removes one.

Back to the [README](../README.md).
