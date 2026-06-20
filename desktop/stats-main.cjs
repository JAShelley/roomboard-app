const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

let mainWindow = null;
let staticServer = null;
let isQuitting = false;

function getStaticRoot() {
  return path.resolve(__dirname, "..", "public", "stats-viewer");
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendResponse(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

async function resolveRequestPath(rootDir, requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(rootDir, `.${normalizedPath}`);

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error("FORBIDDEN");
  }

  const stats = await fs.promises.stat(filePath).catch(() => null);
  if (!stats) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
  if (stats.isDirectory()) return path.join(filePath, "index.html");
  return filePath;
}

function createStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const filePath = await resolveRequestPath(rootDir, decodeURIComponent(url.pathname));
        const fileBuffer = await fs.promises.readFile(filePath);
        sendResponse(res, 200, fileBuffer, {
          "Content-Type": getMimeType(filePath)
        });
      } catch (error) {
        if (error && error.message === "FORBIDDEN") {
          sendResponse(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
          return;
        }

        if (error && error.code === "ENOENT") {
          sendResponse(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
          return;
        }

        console.error("RoomBoard Stats server error:", error);
        sendResponse(res, 500, "RoomBoard Stats server error", {
          "Content-Type": "text/plain; charset=utf-8"
        });
      }
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Stats server failed to bind to a local port."));
        return;
      }
      resolve({ port: address.port, server });
    });
  });
}

async function ensureStaticServer() {
  if (staticServer) return staticServer;
  const rootDir = getStaticRoot();
  await fs.promises.access(path.join(rootDir, "index.html"), fs.constants.R_OK);
  staticServer = await createStaticServer(rootDir);
  return staticServer;
}

function closeStaticServer() {
  if (!staticServer || !staticServer.server) return;
  try {
    staticServer.server.close();
  } catch (error) {
    console.warn("RoomBoard Stats server close warning:", error);
  } finally {
    staticServer = null;
  }
}

function isAllowedAppUrl(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch (_error) {
    return false;
  }
}

async function createMainWindow() {
  const { port } = await ensureStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#07111f",
    height: 920,
    minHeight: 680,
    minWidth: 980,
    show: false,
    title: "RoomBoard Stats",
    width: 1320,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (process.platform !== "darwin" || isQuitting) return;
    event.preventDefault();
    if (mainWindow) mainWindow.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url, baseUrl)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url, baseUrl)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  await mainWindow.loadURL(`${baseUrl}/index.html`);
}

async function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) await createMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === "darwin" && typeof app.focus === "function") {
    app.focus({ steal: true });
  }
}

app.setName("RoomBoard Stats");

app.on("activate", () => {
  showMainWindow().catch((error) => {
    console.error("RoomBoard Stats activate failed:", error);
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady()
  .then(showMainWindow)
  .catch((error) => {
    console.error("RoomBoard Stats startup failed:", error);
    app.quit();
  });

app.on("will-quit", () => {
  closeStaticServer();
});
