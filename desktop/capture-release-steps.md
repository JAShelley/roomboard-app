# RoomBoard Capture Release Steps

Use this flow so the website upload stays small and the large Electron installers live in GitHub Releases.

## 0. One-time cutover from the legacy repo (do this for the next release)

All published capture releases (through `capture-v0.1.5`) live on the legacy
`JAShelley/Roomboard` repo, and `public/app/config.js` currently points its
download URLs there so the website buttons keep working. `JAShelley/roomboard-app`
(this repo) is canonical going forward but has no releases yet. To cut over:

1. Add the Mac signing secrets to **this** repo (list in step 3 below).
2. Push `main` including `.github/workflows/` and `desktop/auto-update.cjs`.
3. Tag and push `capture-v0.1.6` (root `package.json` version is already `0.1.6`;
   keep tag and package version in sync — the auto-update feed reads the package
   version). Both workflows run and publish the release plus the rolling
   `capture-latest` auto-update feed on this repo.
4. Confirm the release assets per step 4 below.
5. In `public/app/config.js`: set `__ROOMBOARD_CAPTURE_RELEASE_TAG__` to
   `capture-v0.1.6`, change `__ROOMBOARD_CAPTURE_RELEASE_BASE_URL__` from
   `JAShelley/Roomboard` to `JAShelley/roomboard-app`, and restore the computed
   Mac download URL (see the comment on `__ROOMBOARD_CAPTURE_MAC_DOWNLOAD_URL__`
   — it is deliberately `""` until then). Remove the legacy-repo comments, bump
   the `config.js?v=` cache-bust query in `public/app/index.html`, then deploy
   the website.

Until step 5 ships, the website serves the legacy `capture-v0.1.5` **Windows**
installer only. The Mac download card is hidden: the legacy Mac DMG turned out
to be ad-hoc signed and Gatekeeper rejects it (`spctl --assess: rejected`,
verified 2026-07-03), so it must not be offered to customers. Neither legacy
installer includes the auto-updater, so there is no live update feed to break.

## 1. Pick the release tag

Use one shared tag for both platforms:

```text
capture-v0.1.6
```

When the next app build is needed, increase only the version number, and bump
the root `package.json` version to match.

## 2. Push the latest source code

The Mac menu-bar app and Windows tray app are built from the code in GitHub. If the newest source code has not been pushed, the downloaded installer will still have old behavior.

## 3. Build both installers in GitHub Actions

Either push a `capture-v*` tag (both workflows trigger automatically and use the
tag name as the release tag), or run both workflows manually from the Actions tab
with the same `release_tag` input:

```text
Release Capture Windows Installer   (.github/workflows/release-capture-windows.yml)
Release Capture Mac Installer       (.github/workflows/release-capture-mac.yml)
```

Use this value for both:

```text
capture-v0.1.6
```

Each workflow creates the GitHub Release for that tag if it doesn't exist yet and
uploads its installer to it, so run order between the two doesn't matter. The
workflows upload these files to the same GitHub Release:

```text
RoomBoard-Capture-Setup-Windows-x64.exe
RoomBoard-Capture-macOS.dmg
```

The Mac workflow needs these repo secrets set (Settings > Secrets and variables >
Actions) before it can sign and notarize:

```text
MAC_CSC_LINK              base64-encoded RoomBoard-DeveloperID.p12
MAC_CSC_KEY_PASSWORD      password for that .p12
APPLE_TEAM_ID             Apple Developer Team ID

# then either an App Store Connect API key...
APPLE_API_KEY_P8          the .p8 private key contents
APPLE_API_KEY_ID          App Store Connect API key ID
APPLE_API_ISSUER          App Store Connect API issuer ID

# ...or an Apple ID + app-specific password
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
```

These are GitHub repo secrets, not shared across repos — if a Mac Developer ID
identity and notary credentials were already set up for a different repo, the
values need to be copied into this repo's secrets under these same names.

The Windows workflow does not require any secrets — it produces an unsigned
`.exe`, so first-run installs will show a SmartScreen warning until/unless a
Windows code-signing certificate is added.

## 4. Confirm the release assets

The GitHub Release must contain both installer files before uploading a new website zip.

For the Mac installer, the `Release Capture Mac Installer` workflow must pass these checks before the DMG is safe to publish:

```text
codesign --verify
Developer ID Application certificate check
xcrun stapler validate
spctl Gatekeeper assessment
```

If any of those checks fail, do not use that DMG on the website.

### Build-time signing gate

Any `dmg`/`zip` Mac build now self-fails (in `scripts/notarize-mac.cjs`) if the app
or the bundled `RoomBoardCaptureHelper` is ad-hoc signed, is missing the hardened
runtime, or the helper is missing the `com.apple.security.inherit` entitlement. An
ad-hoc helper cannot hold stable Accessibility / Screen Recording permissions, so
capture silently falls back to flaky OCR — which is why this is enforced.

To produce an installer you must have the Developer ID identity (`CSC_LINK` /
`RoomBoard-DeveloperID.p12`) and notary credentials loaded. For an intentional
**unsigned local build** (e.g. `npm run capture:pack`), set `ROOMBOARD_ALLOW_UNSIGNED=1`
to bypass the gate. Bare `--dir` packs are exempt automatically.

You can re-check an already-built app or DMG with `npm run mac:verify -- <path>`.

## 5. Update the website downloader version

In `public/app/config.js`, update this one value when a new capture release is ready:

```js
window.__ROOMBOARD_CAPTURE_RELEASE_TAG__ =
  window.__ROOMBOARD_CAPTURE_RELEASE_TAG__ || "capture-v0.1.6";
```

The Windows and Mac download URLs are built from that shared tag.

## 6. Remake the website zip without installers

Build the website upload zip from `public/app` and exclude installer binaries:

```sh
cd public/app && zip -r ../../RoomBoard-tiiny-upload.zip . -x 'downloads/*.dmg' -x 'downloads/*.exe' -x '*.DS_Store'
```

The website zip should stay small. The `.dmg` and `.exe` files should not be inside it.
