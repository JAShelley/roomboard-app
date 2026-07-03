const { app, dialog } = require("electron");

const DEFAULT_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 10 * 1000;

function setupAutoUpdate(options = {}) {
  if (!app.isPackaged) return null;

  const feedUrl = options.feedUrl;
  const sendStatus = typeof options.sendStatus === "function" ? options.sendStatus : () => {};
  const checkIntervalMs = Math.max(60 * 1000, Number(options.checkIntervalMs || DEFAULT_CHECK_INTERVAL_MS));

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (error) {
    console.error("electron-updater is unavailable:", error);
    return null;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
  }

  autoUpdater.on("error", (error) => {
    sendStatus(`Update check failed: ${error?.message || error}`);
  });

  autoUpdater.on("update-available", (info) => {
    sendStatus(`Downloading update ${info?.version || ""}...`.trim());
  });

  autoUpdater.on("update-downloaded", async (info) => {
    sendStatus(`Update ${info?.version || ""} ready to install.`.trim());
    try {
      const { response } = await dialog.showMessageBox({
        buttons: ["Restart now", "Later"],
        cancelId: 1,
        defaultId: 0,
        detail: "Restart now to finish installing, or it will install automatically the next time you quit.",
        message: `Version ${info?.version || "a new version"} has been downloaded.`,
        title: "RoomBoard Capture update ready",
        type: "info"
      });
      if (response === 0) autoUpdater.quitAndInstall();
    } catch (error) {
      console.error("Update prompt failed:", error);
    }
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendStatus(`Update check failed: ${error?.message || error}`);
    });
  };

  setTimeout(checkForUpdates, FIRST_CHECK_DELAY_MS);
  setInterval(checkForUpdates, checkIntervalMs);

  return autoUpdater;
}

module.exports = { setupAutoUpdate };
