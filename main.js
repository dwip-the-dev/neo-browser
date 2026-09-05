import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fetch from 'node-fetch';
import path from 'path';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, 'assets', 'icon.png');

let mainWindow;
let GLOBAL_SERVER_URL = null;

// ===== SINGLE INSTANCE LOCK =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Register fetch:// protocol
app.setAsDefaultProtocolClient('fetch');

// ===== INTERNAL LOCAL DEV SERVER & P2P RELAY =====
let localServer = null;
const LOCAL_PORT = 8765;

const P2P_SESSIONS = new Map();

function pruneExpiredP2PSessions() {
    const now = Date.now();
    for (const [id, sess] of P2P_SESSIONS.entries()) {
        if (now - sess.last_heartbeat > 1800000) { // 30 minutes
            P2P_SESSIONS.delete(id);
        }
    }
}

function readJsonBody(request) {
    return new Promise((resolve) => {
        let body = '';
        request.on('data', chunk => { body += chunk; });
        request.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch {
                resolve({});
            }
        });
        request.on('error', () => resolve({}));
    });
}

function startLocalServer() {
    const backendSitesDir = path.join(__dirname, '..', 'neobrowser-bcknd', 'sites');
    const backendRegPath = path.join(__dirname, '..', 'neobrowser-bcknd', 'registry.json');
    if (!fs.existsSync(backendSitesDir)) {
        return false;
    }

    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg'
    };

    try {
        localServer = http.createServer(async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            const parsedUrl = new URL(req.url, `http://127.0.0.1:${LOCAL_PORT}`);
            const pathname = decodeURIComponent(parsedUrl.pathname);

            // Status endpoint
            if (pathname === '/status') {
                let reg = {};
                try { reg = JSON.parse(fs.readFileSync(backendRegPath, 'utf8')); } catch {}
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'online',
                    service: 'NeoBrowser Local Server',
                    entries: Object.keys(reg).length,
                    local: true
                }));
                return;
            }

            // Search or load endpoint
            if (pathname === '/search' || pathname === '/load') {
                const query = (parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('domain') || '').trim().toLowerCase();
                let reg = {};
                try { reg = JSON.parse(fs.readFileSync(backendRegPath, 'utf8')); } catch {}
                const domain = query.endsWith('.neo') ? query : `${query}.neo`;
                if (reg[domain]) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ url: `http://127.0.0.1:${LOCAL_PORT}/site/${domain}/` }));
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Could not resolve ${domain}` }));
                return;
            }

            // ===== P2P EPHEMERAL TRANSFER COORDINATOR ENDPOINTS =====
            const CLOUD_COORDINATOR = 'https://neobrowser-bcknd.vercel.app';

            async function proxyCloudP2P(targetPath, method, bodyObj, authHeader) {
                try {
                    const headers = { 'Content-Type': 'application/json' };
                    if (authHeader) {
                        headers['Authorization'] = authHeader;
                    }
                    const opts = {
                        method: method || 'GET',
                        headers: headers,
                        cache: 'no-store'
                    };
                    if (bodyObj && (method === 'POST' || method === 'PUT')) {
                        opts.body = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
                    }
                    const cloudRes = await fetch(`${CLOUD_COORDINATOR}${targetPath}`, opts);
                    const text = await cloudRes.text();
                    res.writeHead(cloudRes.status, { 'Content-Type': 'application/json' });
                    res.end(text);
                    return true;
                } catch (e) {
                    return false;
                }
            }

            if (pathname === '/api/p2p/register' && req.method === 'POST') {
                pruneExpiredP2PSessions();
                const data = await readJsonBody(req);
                const filename = data.filename || 'unnamed.bin';
                const size = data.size ?? data.fileSize ?? 0;
                const mime = data.mime ?? data.mimeType ?? 'application/octet-stream';
                const sha256 = data.sha256 ?? data.fileHash ?? '';
                const total_chunks = data.total_chunks ?? data.totalChunks ?? 1;

                const existingId = (data.id || data.sessionId || '').trim().toUpperCase();
                const rawId = crypto.randomBytes(4).toString('hex').toUpperCase();
                const sessionId = existingId || `NEO-${rawId.substring(0, 4)}-${rawId.substring(4, 8)}`;

                const sess = P2P_SESSIONS.get(sessionId) || {
                    id: sessionId,
                    signals: new Map(),
                    chunks: new Map(),
                    needed_chunks: [],
                    downloader_seen: 0,
                    created_at: Date.now()
                };
                sess.filename = filename;
                sess.size = size;
                sess.mime = mime;
                sess.sha256 = sha256;
                sess.total_chunks = total_chunks;
                sess.last_heartbeat = Date.now();
                sess.uploader_online = true;
                P2P_SESSIONS.set(sessionId, sess);

                // Also sync to cloud coordinator so remote peers can discover it
                fetch(`${CLOUD_COORDINATOR}/api/p2p/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: sessionId,
                        filename,
                        size,
                        mime,
                        sha256,
                        total_chunks
                    })
                }).catch(() => {});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    success: true,
                    id: sessionId,
                    sessionId: sessionId,
                    message: 'Ephemeral P2P session initialized. Maintain heartbeat.'
                }));
                return;
            }

            if (pathname === '/api/p2p/heartbeat' && req.method === 'POST') {
                pruneExpiredP2PSessions();
                const data = await readJsonBody(req);
                const sid = (data.id || data.sessionId || '').trim().toUpperCase();
                if (P2P_SESSIONS.has(sid)) {
                    const sess = P2P_SESSIONS.get(sid);
                    sess.last_heartbeat = Date.now();
                    sess.uploader_online = true;
                    const needed = sess.needed_chunks || [];
                    const downloader_active = (Date.now() - (sess.downloader_seen || 0)) < 60000;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'ok',
                        active: true,
                        id: sid,
                        sessionId: sid,
                        needed_chunks: needed,
                        downloader_active: downloader_active,
                        has_downloader: downloader_active
                    }));
                } else {
                    const handled = await proxyCloudP2P('/api/p2p/heartbeat', 'POST', data);
                    if (!handled) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', active: false, message: 'Session expired or offline' }));
                    }
                }
                return;
            }

            const sessionMatch = pathname.match(/^\/api\/p2p\/session\/([^\/]+)$/);
            if (sessionMatch && req.method === 'GET') {
                pruneExpiredP2PSessions();
                const sid = sessionMatch[1].trim().toUpperCase();
                const sess = P2P_SESSIONS.get(sid);
                if (sess) {
                    sess.downloader_seen = Date.now();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'ok',
                        success: true,
                        session: {
                            id: sess.id,
                            sessionId: sess.id,
                            filename: sess.filename,
                            size: sess.size,
                            mime: sess.mime,
                            sha256: sess.sha256,
                            total_chunks: sess.total_chunks,
                            created_at: sess.created_at,
                            uploader_online: true
                        }
                    }));
                } else {
                    const handled = await proxyCloudP2P(`/api/p2p/session/${sid}`, 'GET');
                    if (!handled) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: 'error',
                            error: 'peer_offline',
                            message: 'Uploader is offline or transfer session has vanished from the network.'
                        }));
                    }
                }
                return;
            }

            if (pathname === '/api/p2p/signal' && req.method === 'POST') {
                pruneExpiredP2PSessions();
                const data = await readJsonBody(req);
                const sid = (data.id || data.sessionId || '').trim().toUpperCase();
                const toPeer = data.to_peer || '';
                const signalData = data.data;
                if (P2P_SESSIONS.has(sid)) {
                    const sess = P2P_SESSIONS.get(sid);
                    if (!sess.signals.has(toPeer)) sess.signals.set(toPeer, []);
                    sess.signals.get(toPeer).push(signalData);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', success: true }));
                } else {
                    const handled = await proxyCloudP2P('/api/p2p/signal', 'POST', data);
                    if (!handled) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', message: 'Session offline' }));
                    }
                }
                return;
            }

            const signalMatch = pathname.match(/^\/api\/p2p\/signal\/([^\/]+)$/);
            if (signalMatch && req.method === 'GET') {
                pruneExpiredP2PSessions();
                const sid = signalMatch[1].trim().toUpperCase();
                const peerId = parsedUrl.searchParams.get('peer') || '';
                if (P2P_SESSIONS.has(sid)) {
                    const sess = P2P_SESSIONS.get(sid);
                    const list = sess.signals.get(peerId) || [];
                    sess.signals.delete(peerId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', signals: list }));
                } else {
                    const handled = await proxyCloudP2P(`/api/p2p/signal/${sid}?peer=${encodeURIComponent(peerId)}`, 'GET');
                    if (!handled) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', error: 'peer_offline' }));
                    }
                }
                return;
            }

            if (pathname === '/api/p2p/chunk' && req.method === 'POST') {
                pruneExpiredP2PSessions();
                const data = await readJsonBody(req);
                const sid = (data.id || data.sessionId || '').trim().toUpperCase();
                const index = data.index;
                const chunkData = data.data;
                if (!P2P_SESSIONS.has(sid)) {
                    P2P_SESSIONS.set(sid, {
                        id: sid,
                        filename: 'unnamed.bin',
                        size: 0,
                        mime: 'application/octet-stream',
                        sha256: '',
                        total_chunks: 1,
                        created_at: Date.now(),
                        last_heartbeat: Date.now(),
                        uploader_online: true,
                        signals: new Map(),
                        chunks: new Map(),
                        needed_chunks: [],
                        downloader_seen: 0
                    });
                }
                const sess = P2P_SESSIONS.get(sid);
                sess.last_heartbeat = Date.now();
                sess.chunks.set(String(index), { data: chunkData, ts: Date.now() });

                // Fulfill needed chunk
                if (sess.needed_chunks) {
                    sess.needed_chunks = sess.needed_chunks.filter(x => x !== index && x !== Number(index));
                }

                // Also relay chunk to cloud coordinator so remote downloaders can retrieve it
                fetch(`${CLOUD_COORDINATOR}/api/p2p/chunk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: sid, index, data: chunkData })
                }).catch(() => {});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', success: true }));
                return;
            }

            const chunkMatch = pathname.match(/^\/api\/p2p\/chunk\/([^\/]+)\/([^\/]+)$/);
            if (chunkMatch && req.method === 'GET') {
                pruneExpiredP2PSessions();
                const sid = chunkMatch[1].trim().toUpperCase();
                const index = chunkMatch[2];
                if (P2P_SESSIONS.has(sid)) {
                    const sess = P2P_SESSIONS.get(sid);
                    sess.downloader_seen = Date.now();
                    const chunkEntry = sess.chunks.get(String(index));
                    if (chunkEntry) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', success: true, index, data: chunkEntry.data }));
                    } else {
                        // Mark needed chunk
                        if (!sess.needed_chunks) sess.needed_chunks = [];
                        const numIdx = Number(index);
                        if (!sess.needed_chunks.includes(numIdx)) {
                            sess.needed_chunks.push(numIdx);
                        }
                        res.writeHead(202, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'waiting', message: `Chunk ${index} requested from peer stream`, needed_chunks: sess.needed_chunks }));
                    }
                } else {
                    const handled = await proxyCloudP2P(`/api/p2p/chunk/${sid}/${index}`, 'GET');
                    if (!handled) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', message: 'Session offline' }));
                    }
                }
                return;
            }

            if (pathname === '/api/p2p/unregister' && req.method === 'POST') {
                const data = await readJsonBody(req);
                const sid = (data.id || data.sessionId || '').trim().toUpperCase();
                if (P2P_SESSIONS.has(sid)) {
                    P2P_SESSIONS.delete(sid);
                }
                fetch(`${CLOUD_COORDINATOR}/api/p2p/unregister`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: sid })
                }).catch(() => {});
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', success: true, message: 'Session destroyed.' }));
                return;
            }

            // NeoChat & User.neo API proxy
            if (pathname.startsWith('/api/chat/') || pathname.startsWith('/api/user/')) {
                const search = parsedUrl.search || '';
                let body = null;
                if (req.method === 'POST' || req.method === 'PUT') {
                    body = await readJsonBody(req);
                }
                const authHeader = req.headers['authorization'] || '';
                const handled = await proxyCloudP2P(pathname + search, req.method, body, authHeader);
                if (!handled) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', error: 'Backend unreachable' }));
                }
                return;
            }

            // Site files endpoint: /site/<domain>/...
            const siteMatch = pathname.match(/^\/site\/([^\/]+)(?:\/(.*))?$/);
            if (siteMatch) {
                const domain = siteMatch[1].toLowerCase();
                let subPath = siteMatch[2] || '';
                if (!subPath || subPath.endsWith('/')) subPath += 'index.html';

                let reg = {};
                try { reg = JSON.parse(fs.readFileSync(backendRegPath, 'utf8')); } catch {}
                let filePath = null;

                if (domain === 'user.neo') {
                    const filename = path.basename(subPath);
                    const sitesRoot = path.join(__dirname, '..', 'neobrowser-bcknd');
                    const userDir = path.join(sitesRoot, 'sites', 'official', 'user');
                    if (filename && path.extname(filename)) {
                        const candidateAsset = path.join(userDir, filename);
                        if (fs.existsSync(candidateAsset) && fs.statSync(candidateAsset).isFile()) {
                            filePath = candidateAsset;
                        }
                    }
                    if (!filePath) {
                        filePath = path.join(userDir, 'index.html');
                    }
                }

                if (!filePath && reg[domain] && reg[domain].path) {
                    const baseDir = path.dirname(reg[domain].path);
                    filePath = path.join(__dirname, '..', 'neobrowser-bcknd', baseDir, subPath);
                }

                if (!filePath || !fs.existsSync(filePath)) {
                    const cleanName = domain.replace(/\.neo$/, '');
                    try {
                        const categories = fs.readdirSync(backendSitesDir);
                        for (const cat of categories) {
                            const candidate = path.join(backendSitesDir, cat, cleanName, subPath);
                            if (fs.existsSync(candidate)) {
                                filePath = candidate;
                                break;
                            }
                        }
                    } catch {}
                }

                if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const ext = path.extname(filePath).toLowerCase();
                    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                    fs.createReadStream(filePath).pipe(res);
                    return;
                }
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });

        localServer.on('error', (err) => {
            console.warn('[LOCAL-SERVER] Could not bind port 8765:', err.message);
        });

        localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
            console.log(`[OK] Local backend server running on http://127.0.0.1:${LOCAL_PORT}`);
        });
        return true;
    } catch (e) {
        console.warn('[LOCAL-SERVER] Failed to start:', e.message);
        return false;
    }
}

// ===== FETCH SERVER URL =====
async function loadServerURL() {
    startLocalServer();
    // Wait briefly for local server socket to open and verify
    await new Promise(r => setTimeout(r, 100));
    try {
        const localCheck = await fetch(`http://127.0.0.1:${LOCAL_PORT}/status`, { cache: "no-store" });
        if (localCheck.ok) {
            GLOBAL_SERVER_URL = `http://127.0.0.1:${LOCAL_PORT}`;
            console.log("[OK] Active server URL (Local Workspace):", GLOBAL_SERVER_URL);
            return;
        }
    } catch {
        // Fallback if local server failed
    }

    const VERCEL_BACKEND = "https://neobrowser-bcknd.vercel.app";
    try {
        const res = await fetch("https://neobrowser-backend.github.io/key/index.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.GLOBAL_SERVER_URL) throw new Error("Missing GLOBAL_SERVER_URL in JSON");

        let candidate = (data.GLOBAL_SERVER_URL || "").trim().replace(/\/+$/, '');
        try {
            const check = await fetch(`${candidate}/status`, { cache: "no-store" });
            if (check.ok) {
                GLOBAL_SERVER_URL = candidate;
                console.log("[OK] Loaded server URL:", GLOBAL_SERVER_URL);
                return;
            }
        } catch {}
        GLOBAL_SERVER_URL = VERCEL_BACKEND;
    } catch (err) {
        GLOBAL_SERVER_URL = VERCEL_BACKEND;
    }
    if (GLOBAL_SERVER_URL) {
        GLOBAL_SERVER_URL = GLOBAL_SERVER_URL.replace(/\/+$/, '');
    }
    console.log("[OK] Active server URL:", GLOBAL_SERVER_URL);
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
        title: "NeoBrowser",
        icon: appIconPath,
        autoHideMenuBar: true,
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

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        mainWindow.webContents.send('open-in-new-tab', url);
        return { action: 'deny' };
    });
}

app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('open-in-new-tab', url);
        }
        return { action: 'deny' };
    });
});

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

ipcMain.on('open-external-browser', (event, url) => {
    if (url && typeof url === 'string') {
        shell.openExternal(url).catch(err => {
            console.error('Failed to open external browser:', err.message);
        });
    }
});

ipcMain.on('open-neogoogle', () => {
    if (!mainWindow) return;
    const googleWin = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 600,
        minHeight: 400,
        title: "NeoGoogle - Web Search",
        icon: appIconPath,
        autoHideMenuBar: true,
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
        console.error("[ERR] App failed to start:", err.message);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (!mainWindow) createWindow();
});
