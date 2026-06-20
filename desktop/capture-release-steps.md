# RoomBoard Capture Release Steps

Use this flow so the website upload stays small and the large Electron installers live in GitHub Releases.

## 1. Pick the release tag

Use one shared tag for both platforms:

```text
capture-v0.1.5
```

When the next app build is needed, increase only the version number.

## 2. Push the latest source code

The Mac menu-bar app and Windows tray app are built from the code in GitHub. If the newest source code has not been pushed, the downloaded installer will still have old behavior.

## 3. Build both installers in GitHub Actions

Run both workflows with the same `release_tag`:

```text
Release Capture Windows Installer
Release Capture Mac Installer
```

Use this value for both:

```text
capture-v0.1.5
```

The workflows upload these files to the same GitHub Release:

```text
RoomBoard-Capture-Setup-Windows-x64.exe
RoomBoard-Capture-macOS.dmg
```

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

In `public/roomboard/config.js`, update this one value when a new capture release is ready:

```js
window.__ROOMBOARD_CAPTURE_RELEASE_TAG__ =
  window.__ROOMBOARD_CAPTURE_RELEASE_TAG__ || "capture-v0.1.5";
```

The Windows and Mac download URLs are built from that shared tag.

## 6. Remake the website zip without installers

Build the website upload zip from `public/roomboard` and exclude installer binaries:

```sh
zip -r ../../../RoomBoard-tiiny-upload-v1.1.42.zip . -x 'downloads/*.dmg' -x 'downloads/*.exe' -x '*.DS_Store'
```

The website zip should stay around 2 MB. The `.dmg` and `.exe` files should not be inside it.
