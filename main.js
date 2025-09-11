import { app, BrowserWindow, ipcMain } from 'electron';
import fetch from 'node-fetch';

let mainWindow;
let GLOBAL_SERVER_URL = null;

// ===== FETCH SERVER URL FROM GITHUB JSON =====
async function loadServerURL() {
    try {
        const res = await fetch("https://neobrowser-backend.github.io/key/index.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.GLOBAL_SERVER_URL) throw new Error("Missing GLOBAL_SERVER_URL in JSON");
        GLOBAL_SERVER_URL = data.GLOBAL_SERVER_URL;
        console.log("✅ Loaded server URL:", GLOBAL_SERVER_URL);
    } catch (err) {
        console.error("❌ Failed to load server URL:", err.message);
        GLOBAL_SERVER_URL = "http://localhost:5000"; // fallback for dev
    }
}

// ===== FETCH WITH RETRY =====
async function fetchWithRetry(url, retries = 1, delay = 500) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ===== CREATE MAIN WINDOW =====
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#0b0b0b',
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => (mainWindow = null));
}

// ===== SERVER STATUS CHECK =====
async function checkServerStatus() {
    if (!GLOBAL_SERVER_URL || !mainWindow) return;

    try {
        const data = await fetchWithRetry(`${GLOBAL_SERVER_URL}/status`, 1, 300);
        mainWindow.webContents.send('server-status', { ...data, server: GLOBAL_SERVER_URL });
        console.log('Server online:', { ...data, server: GLOBAL_SERVER_URL });
    } catch (err) {
        console.warn('Server offline:', err.message);
        mainWindow.webContents.send('server-status', { status: 'offline', error: err.message });
    }
}

// ===== IPC HANDLERS =====
ipcMain.handle('get-server-url', () => GLOBAL_SERVER_URL);

ipcMain.on('search', async (event, query) => {
    if (!GLOBAL_SERVER_URL) return;
    try {
        const data = await fetchWithRetry(`${GLOBAL_SERVER_URL}/search?query=${encodeURIComponent(query)}`, 1, 500);
        if (data.url) mainWindow.webContents.send('load-url', data.url);
        else mainWindow.webContents.send('search-results', data.results || []);
    } catch (err) {
        console.error('Search error:', err.message);
        mainWindow.webContents.send('search-error', 'Cannot connect to server: ' + err.message);
    }
});

ipcMain.on('load-site', async (event, domain) => {
    if (!GLOBAL_SERVER_URL) return;
    try {
        const data = await fetchWithRetry(`${GLOBAL_SERVER_URL}/load?domain=${encodeURIComponent(domain)}`, 1, 500);
        if (data.url) mainWindow.webContents.send('load-url', data.url);
        else mainWindow.webContents.send('search-error', data.error || 'Failed to load site');
    } catch (err) {
        console.error('Load site error:', err.message);
        mainWindow.webContents.send('search-error', 'Cannot connect to server: ' + err.message);
    }
});

ipcMain.on('open-neogoogle', () => {
    if (!mainWindow) return;
    const googleWin = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: '#0b0b0b',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });
    googleWin.loadFile('neogoogle.html');
});

// ===== APP EVENTS =====
app.on('ready', async () => {
    try {
        await loadServerURL(); // dynamically load URL
        createWindow();

        // Auto-load the main URL into the webview on launch
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('load-url', GLOBAL_SERVER_URL);
        });

        setTimeout(checkServerStatus, 1000);
        setInterval(checkServerStatus, 30000);
    } catch (err) {
        console.error("❌ App failed to start:", err.message);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (!mainWindow) createWindow();
});
