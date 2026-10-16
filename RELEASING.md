# Releasing A Window

## Publishing a version

1. Push this project to GitHub.
2. Update `version` in `package.json` (for example `1.0.1`) and commit.
3. Tag and push the tag:

   ```sh
   git tag v1.0.1
   git push origin main --tags
   ```

4. The **Release** workflow (`.github/workflows/release.yml`) builds the Mac, Windows and Linux installers on GitHub's
   machines (about 10–15 minutes) and attaches them to a **draft** release.
5. Open the repository's **Releases** page, check the draft, write a few lines about what changed, and click **Publish**.
   People can then download it by following `INSTALL.md`.

The **Check** workflow type-checks, tests and builds every push, so a broken change shows up before you tag it.

## Removing the security warnings (optional, paid)

Out of the box the installers are unsigned, which is why Mac users right-click → Open the first time and Windows shows
SmartScreen. Both go away with signing:

- **macOS** needs an Apple Developer account ($99/year). Create a "Developer ID Application" certificate, then add these
  repository secrets: `CSC_LINK` (the certificate as base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. In `package.json`, remove `"identity": null` from `build.mac`, add
  `"notarize": true`, and remove `afterPack` (it only exists to ad-hoc sign unsigned builds).
- **Windows** needs a code-signing certificate (from about $100/year, or Azure Trusted Signing at a few dollars a month).
  Add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets.

Signed and notarized Mac builds can also update themselves automatically with `electron-updater`.

## Before a wider launch

- Choose a license and add a `LICENSE` file (MIT is common for a free app).
- Open-Meteo's free API is for non-commercial use. If you ever charge for the app, take one of their commercial plans.
- Album art for Apple Music and for Windows comes from Apple's public iTunes Search API, which needs no key.
