const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const HELPER_RELATIVE_PATH = join("Contents", "Resources", "capture-helper-mac", "RoomBoardCaptureHelper");
const INHERIT_ENTITLEMENT = "com.apple.security.inherit";

const DISTRIBUTABLE_TARGETS = /^(dmg|zip|pkg|mas)$/i;

// Local --dir packs are allowed to ship ad-hoc signatures for quick testing.
// Anything that produces a distributable (dmg/zip) must be properly signed, so
// strict mode is the DEFAULT and a developer has to opt out explicitly.
function isUnsignedAllowed() {
  if (process.env.ROOMBOARD_REQUIRE_NOTARIZATION === "1") return false;
  return process.env.ROOMBOARD_ALLOW_UNSIGNED === "1";
}

// Decide whether to enforce real Developer ID signing + notarization for a build.
// Distributable targets (dmg/zip/pkg) are strict by default; bare --dir packs are
// not. ROOMBOARD_REQUIRE_NOTARIZATION=1 forces strict; ROOMBOARD_ALLOW_UNSIGNED=1
// opts a distributable build out (for an intentional unsigned local build).
function shouldEnforceSigning(targets) {
  if (process.env.ROOMBOARD_REQUIRE_NOTARIZATION === "1") return true;
  if (process.env.ROOMBOARD_ALLOW_UNSIGNED === "1") return false;
  const names = (Array.isArray(targets) ? targets : [])
    .map((target) => (target && target.name ? String(target.name) : ""))
    .filter(Boolean);
  return names.some((name) => DISTRIBUTABLE_TARGETS.test(name));
}

function findAppBundle(dir) {
  if (!dir || !existsSync(dir)) return "";
  const appName = readdirSync(dir).find((entry) => entry.endsWith(".app"));
  return appName ? join(dir, appName) : "";
}

function findCaptureHelper(appPath) {
  const helperPath = join(appPath, HELPER_RELATIVE_PATH);
  return existsSync(helperPath) ? helperPath : "";
}

// `codesign -dvvv` writes its report to stderr, so combine both streams.
function inspectSignature(targetPath) {
  const result = spawnSync("codesign", ["-dvvv", targetPath], { encoding: "utf8" });
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  const flagsMatch = raw.match(/flags=0x[0-9a-f]+\(([^)]*)\)/i);
  const flags = flagsMatch ? flagsMatch[1].toLowerCase() : "";
  const teamMatch = raw.match(/TeamIdentifier=(.+)/);
  const teamIdentifier = teamMatch ? teamMatch[1].trim() : "";

  return {
    raw,
    adhoc: /Signature=adhoc/i.test(raw) || flags.split(",").includes("adhoc"),
    hardenedRuntime: flags.split(",").includes("runtime"),
    teamIdentifier: teamIdentifier === "not set" ? "" : teamIdentifier,
    hasDeveloperId: /Authority=Developer ID Application/i.test(raw),
  };
}

function inspectEntitlements(targetPath) {
  const result = spawnSync("codesign", ["-d", "--entitlements", "-", targetPath], { encoding: "utf8" });
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

// Throws when the app (or its bundled capture helper) is not signed in a way
// that will survive Gatekeeper and keep the helper's Accessibility / Screen
// Recording TCC grants stable. Returns a short summary when everything checks out.
function assertDistributionSigning(appPath) {
  const problems = [];
  const app = inspectSignature(appPath);
  if (app.adhoc || !app.teamIdentifier) {
    problems.push(`App bundle is ad-hoc signed (no Developer ID / Team Identifier): ${appPath}`);
  } else if (!app.hardenedRuntime) {
    problems.push(`App bundle is missing the hardened runtime flag: ${appPath}`);
  }

  const helperPath = findCaptureHelper(appPath);
  if (helperPath) {
    const helper = inspectSignature(helperPath);
    if (helper.adhoc || !helper.teamIdentifier) {
      problems.push(`Capture helper is ad-hoc signed (no Developer ID / Team Identifier): ${helperPath}`);
    } else if (!helper.hardenedRuntime) {
      problems.push(`Capture helper is missing the hardened runtime flag: ${helperPath}`);
    }
    if (!inspectEntitlements(helperPath).includes(INHERIT_ENTITLEMENT)) {
      problems.push(
        `Capture helper is missing the '${INHERIT_ENTITLEMENT}' entitlement; it will not inherit the app's Accessibility / Screen Recording permissions: ${helperPath}`,
      );
    }
  }

  if (problems.length) {
    throw new Error(
      [
        "Mac signing integrity check failed:",
        ...problems.map((problem) => `  - ${problem}`),
        "",
        "Load the Developer ID identity (RoomBoard-DeveloperID.p12) and notary credentials, then rebuild.",
        "For an intentional unsigned local build, set ROOMBOARD_ALLOW_UNSIGNED=1.",
      ].join("\n"),
    );
  }

  return {
    teamIdentifier: app.teamIdentifier,
    helperPresent: !!helperPath,
  };
}

module.exports = {
  HELPER_RELATIVE_PATH,
  INHERIT_ENTITLEMENT,
  isUnsignedAllowed,
  shouldEnforceSigning,
  findAppBundle,
  findCaptureHelper,
  inspectSignature,
  inspectEntitlements,
  assertDistributionSigning,
};
