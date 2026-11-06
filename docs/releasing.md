# Releasing

1. Update `version` in `package.json`, the tag in the README install snippet, and `CHANGELOG.md`.
2. Merge to `main` with the `check` status green.
3. Run the live test in [testing](testing.md) against `main`.
4. Tag and release:

   ```sh
   git tag -s vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
   gh release create vX.Y.Z --notes-file <notes>
   ```

5. Run the live test again with `PLUGIN_SPEC=github:Runzivo/rzv-opencode-plugin#vX.Y.Z`.

## Install channels

- GitHub (current): `"plugin": ["github:Runzivo/rzv-opencode-plugin#vX.Y.Z"]`. OpenCode installs it with npm's installer, without running install scripts, so `src/` ships as TypeScript and OpenCode loads it directly.
- npm: not published yet. When it is, the package name is `opencode-runzivo` and users write `"plugin": ["opencode-runzivo"]`.

## OpenCode ecosystem list

The plugin is listed on [opencode.ai/docs/ecosystem](https://opencode.ai/docs/ecosystem) through a pull request to `packages/web/src/content/docs/ecosystem.mdx` in [anomalyco/opencode](https://github.com/anomalyco/opencode). Update the entry only if the repository moves.

Back to the [README](../README.md).
