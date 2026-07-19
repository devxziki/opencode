# Windows ARM64 Build

## Architecture Overview

This project is an **Electron** desktop application (not Tauri). The build system uses:

- **electron-vite** — Vite-based build tool for Electron main/preload/renderer processes
- **electron-builder** — Packaging and installer generation
- **Bun** — JavaScript runtime and package manager (v1.3.14)
- **Node.js 24** — Used by electron-builder and native module compilation

There is **no Rust source code** compiled in this repository. The project produces:

- A standalone Electron desktop application (`opencode-desktop`)
- A CLI tool (`opencode`) — distributed as pre-compiled Bun binaries downloaded as sidecar artifacts at build time

## Rust Target

While no Rust is compiled from source in this repo, the `aarch64-pc-windows-msvc` target triple is used for:

- **Sidecar binary mapping** — Maps platform/architecture to the correct pre-built CLI binary artifact name in `packages/desktop/scripts/utils.ts`
- **electron-builder arch flag** — `--arm64` directs electron-builder to produce ARM64 NSIS installers

The target triple is purely a platform identifier string; no Rust toolchain is required to build.

## Required Toolchain

| Component | Version | Notes |
|-----------|---------|-------|
| Bun | 1.3.14 (from `package.json`) | ARM64 Windows builds are supported natively |
| Node.js | 24.x | Required for electron-builder and native module builds |
| electron-builder | 26.15.2 | `electron-builder --win --arm64` produces ARM64 NSIS installers |
| electron-vite | ^5 | Build tooling |
| Windows ARM64 runner | `windows-2025` | Native ARM64 GitHub-hosted runner |

## Native Modules

Native Node.js modules are distributed as pre-built platform-specific packages:

- `@lydell/node-pty-win32-arm64` — PTY support for Windows ARM64 (optional dependency)
- `@parcel/watcher-win32-arm64` — File watcher for Windows ARM64 (optional dependency)

No native modules need to be compiled from source. The correct platform package is resolved at build time by a Vite plugin in `electron.vite.config.ts`:

```ts
const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`
```

## CI/CD Workflows

### `build-desktop.yml` (CI validation)

**File:** `.github/workflows/build-desktop.yml`

Builds the Electron desktop application on every push and pull request. Uses a build matrix:

```yaml
matrix:
  arch:
    - host: windows-2025
      target: aarch64-pc-windows-msvc
      platform_flag: --win --arm64
    - host: blacksmith-4vcpu-windows-2025
      target: x86_64-pc-windows-msvc
      platform_flag: --win
```

| Step | Description |
|------|-------------|
| Checkout | `actions/checkout` |
| Setup Bun | Reuses `.github/actions/setup-bun` (handles caching) |
| Setup Node | `actions/setup-node` with Node 24 |
| Prepare | Runs `packages/desktop/scripts/prepare.ts` (builds node backend, copies icons) |
| Build | `bun run build` (electron-vite build for main, preload, renderer) |
| Package | `npx electron-builder --win --arm64 --publish never` |
| Upload artifacts | Uploads installer and unpacked build to GitHub Actions |

### `publish.yml` (Release)

**File:** `.github/workflows/publish.yml`

Full release workflow that produces signed, notarized distributables for all platforms.
Already includes Windows ARM64 in the build matrix as `windows-2025` with `--win --arm64`.

Triggered by:
- Push to `dev`, `beta`, `ci`, `snapshot-*` branches
- Manual `workflow_dispatch` with version bump choice

## How to Trigger the Workflow

### CI validation (every push)

Simply push any branch or open a pull request. The `build-desktop.yml` workflow automatically runs and validates the Windows ARM64 build.

### Release build

Push to the `dev` branch to trigger `publish.yml`, or use `workflow_dispatch` in the GitHub UI:

1. Go to Actions → `publish` workflow
2. Click "Run workflow"
3. Select branch (`dev` or `beta`)
4. Choose bump level (major/minor/patch) or override version

## Expected Artifacts

After a successful Windows ARM64 CI build, the following artifacts are uploaded:

### CI workflow (`build-desktop.yml`)

- `opencode-desktop-aarch64-pc-windows-msvc/`
  - `opencode-desktop-win-arm64-setup.exe` — NSIS installer (single-file installer)
  - `opencode-desktop-win-arm64.exe` — Portable executable (if unpacked target is included)
  - `latest.yml` — Auto-update metadata
  - `*.blockmap` — Differential update blockmap

### Release workflow (`publish.yml`)

All of the above, plus:
- Code-signed executables (Authenticode via Azure Trusted Signing)
- Published to GitHub Releases under the tag `v<version>`
- Uploaded to the repository's auto-update channel

### Filename pattern

electron-builder `artifactName` is configured as:
```
opencode-desktop-${os}-${arch}.${ext}
```

For Windows ARM64 this produces:
- `opencode-desktop-win-arm64-setup.exe` (installer)
- `opencode-desktop-win-arm64.exe` (portable)
- `latest.yml` (auto-update metadata)

### Download location

- **CI artifacts:** GitHub Actions run page → Artifacts section → `opencode-desktop-aarch64-pc-windows-msvc`
- **Release artifacts:** GitHub Releases page → `v<version>` tag → Assets section

## Release Process

1. Push to `dev` (or use `workflow_dispatch`)
2. `publish.yml` runs:
   - `version` job — computes next version, creates draft release
   - `build-cli` job — compiles CLI binaries for all platforms
   - `sign-cli-windows` job — signs Windows CLI binaries with Azure Trusted Signing
   - `build-electron` job — builds, signs, and packages Electron desktop app for all architectures (including ARM64)
   - `publish` job — uploads all artifacts to GitHub Release and publishes to auto-update channels
3. Release is published and available for download

## Known Limitations

- **No Rust cross-compilation:** ARM64 Windows builds require a native ARM64 Windows runner (`windows-2025`). Blacksmith's x64 runner (`blacksmith-4vcpu-windows-2025`) cannot cross-compile for ARM64 (no MSVC ARM64 cross-toolchain).
- **No Tauri:** Despite common assumptions, this project uses Electron, not Tauri. There is no `tauri.conf.json` or Rust compilation required.
- **electron-vite ARM64 quirks:** The `nodePtyPkg` resolution uses `process.arch` dynamic import. This works correctly on native ARM64 runners because `process.arch` returns `arm64`.
- **CI-only signing:** Authenticode signing uses Azure Trusted Signing with production certificate. This only happens in the release workflow, not in the CI validation workflow.
- **electron-builder ARM64 support:** Requires electron-builder >= 24 for reliable Windows ARM64 support. Current version (26.15.2) is well above this threshold.

## Troubleshooting

### Build fails with "arm64" not recognized

Ensure electron-builder >= 24 is used. Check `packages/desktop/package.json` for `"electron-builder": "26.15.2"`.

### Missing `@lydell/node-pty-win32-arm64`

This is listed as an optional dependency. Run `bun install --linker hoisted` on the Windows ARM64 runner to ensure it's fetched.

### `process.arch` returns `x64` on ARM64 runner

This can happen if running under x64 emulation. Verify with `uname -m` or `[Environment]::Is64BitOperatingSystem` in PowerShell. The `windows-2025` runner is a native ARM64 VM.

### "MSVC ARM64 cross-compiler not found"

This error is expected on x64 runners attempting ARM64 builds. Always use a native ARM64 runner (`windows-2025`) for ARM64 targets.

### CLI binary not bundled

The CLI sidecar binary (`resources/opencode-cli`) is downloaded from CI artifacts during the release workflow. CI validation builds skip this step; the resulting package will not include the CLI binary but will still validate the build and packaging process.
