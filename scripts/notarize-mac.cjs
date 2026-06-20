const { existsSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { basename, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { shouldEnforceSigning, findAppBundle, assertDistributionSigning } = require("./lib/mac-signing.cjs");

const temporaryKeyDirs = [];

exports.default = async function notarizeMac(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = findAppBundle(context.appOutDir);
  if (!appPath) throw new Error(`No .app bundle found in ${context.appOutDir}`);

  // Fail loudly before notarization if the signature would not survive Gatekeeper
  // or would break the capture helper's Accessibility / Screen Recording grants.
  // Bare --dir packs are exempt; distributable (dmg/zip) builds are strict by default.
  if (!shouldEnforceSigning(context.targets)) {
    console.warn(`Skipping Mac signing + notarization for ${appPath} (non-distributable or ROOMBOARD_ALLOW_UNSIGNED=1).`);
    return;
  }
  assertDistributionSigning(appPath);

  const authArgs = getNotaryAuthArgs();
  if (!authArgs.length) {
    throw new Error(
      "Apple notarization credentials are not configured. Set APPLE_API_KEY_ID/APPLE_API_ISSUER/APPLE_API_KEY (or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID), or set ROOMBOARD_ALLOW_UNSIGNED=1 for an intentional unsigned local build.",
    );
  }

  const tempDir = mkdtempSync(join(tmpdir(), "roomboard-notary-"));
  const zipPath = join(tempDir, `${basename(appPath, ".app")}.zip`);

  try {
    run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);
    const submit = run("xcrun", [
      "notarytool",
      "submit",
      zipPath,
      "--wait",
      "--output-format",
      "json",
      ...authArgs
    ]);
    const payload = parseJson(submit.stdout);
    if (payload.status !== "Accepted") {
      if (payload.id) {
        const log = run("xcrun", ["notarytool", "log", payload.id, ...authArgs], { required: false });
        if (log.stdout || log.stderr) {
          console.error(log.stdout || log.stderr);
        }
      }
      throw new Error(`Apple notarization failed with status: ${payload.status || "unknown"}`);
    }

    run("xcrun", ["stapler", "staple", appPath]);
    run("xcrun", ["stapler", "validate", appPath]);
    console.log(`Apple notarization accepted and stapled for ${appPath}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    for (const dir of temporaryKeyDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
};

function getNotaryAuthArgs() {
  const keyId = process.env.APPLE_API_KEY_ID || process.env.ASC_KEY_ID || "";
  const issuer = process.env.APPLE_API_ISSUER || process.env.ASC_ISSUER_ID || "";
  const keyPath = process.env.APPLE_API_KEY_PATH || process.env.ASC_API_KEY_PATH || "";
  const keyValue = process.env.APPLE_API_KEY || process.env.ASC_API_KEY || "";

  if (keyId && issuer && (keyPath || keyValue)) {
    const resolvedKeyPath = resolveApiKeyPath(keyValue || keyPath, keyId);
    return ["--key", resolvedKeyPath, "--key-id", keyId, "--issuer", issuer];
  }

  const appleId = process.env.APPLE_ID || "";
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD || "";
  const teamId = process.env.APPLE_TEAM_ID || "";
  if (appleId && password && teamId) {
    return ["--apple-id", appleId, "--password", password, "--team-id", teamId];
  }

  return [];
}

function resolveApiKeyPath(value, keyId) {
  if (existsSync(value)) return value;
  if (!value.includes("BEGIN PRIVATE KEY")) return value;

  const dir = mkdtempSync(join(tmpdir(), "roomboard-notary-key-"));
  temporaryKeyDirs.push(dir);
  const keyPath = join(dir, `AuthKey_${keyId}.p8`);
  writeFileSync(keyPath, value.replace(/\\n/g, "\n"));
  return keyPath;
}

function run(command, args, options = {}) {
  const required = options.required !== false;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (required && result.status !== 0) {
    throw new Error(`Failed to run ${command} ${redactArgs(args).join(" ")}\n${result.stderr || result.stdout}`);
  }

  return result;
}

function redactArgs(args) {
  const redacted = [];
  for (let i = 0; i < args.length; i += 1) {
    redacted.push(args[i]);
    if (["--password", "--key"].includes(args[i])) {
      i += 1;
      redacted.push("[redacted]");
    }
  }
  return redacted;
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch (error) {
    throw new Error(`Could not parse notarytool JSON output: ${error.message}`);
  }
}
