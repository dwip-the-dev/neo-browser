// ==================== BROWSER NAVIGATION & WEBVIEW ====================
function showLoading() {
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
        loadingBar.classList.add('active');
        loadingBar.style.width = '70%';
    }
}

function hideLoading() {
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
        loadingBar.style.width = '100%';
        setTimeout(() => {
            loadingBar.classList.remove('active');
            loadingBar.style.width = '0%';
        }, 300);
    }
}

function showWebview() {
    const searchView = document.getElementById('search-view');
    const webviewContainer = document.getElementById('webview-container');
    const errorOverlay = document.getElementById('error-overlay');
    if (searchView) searchView.style.display = 'none';
    if (webviewContainer) webviewContainer.style.display = 'block';
    if (errorOverlay) errorOverlay.style.display = 'none';
}

function hideWebview() {
    const searchView = document.getElementById('search-view');
    const webviewContainer = document.getElementById('webview-container');
    const errorOverlay = document.getElementById('error-overlay');
    if (searchView) searchView.style.display = 'flex';
    if (webviewContainer) webviewContainer.style.display = 'none';
    if (errorOverlay) errorOverlay.style.display = 'none';
    updateNavButtons();
}

function loadNeoDomain(domain) {
    domain = domain.trim().toLowerCase().replace('fetch://', '').replace(/\/$/, '');
    currentLoadedDomain = domain;
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');
    const protocolChip = document.getElementById('protocol-chip');
    const webview = document.getElementById('webview');

    if (omniboxInput) omniboxInput.value = `fetch://${domain}`;
    if (protocolText) protocolText.textContent = "fetch://";
    if (protocolChip) protocolChip.style.color = "#38bdf8";

    const targetUrl = `${GLOBAL_SERVER_URL}/site/${domain}/`;
    console.log(`🚀 Loading .neo site [${domain}] -> ${targetUrl}`);
    
    showWebview();
    showLoading();
    if (webview) webview.src = targetUrl;
}

function loadWebUrl(url) {
    currentLoadedDomain = null;
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');
    const protocolChip = document.getElementById('protocol-chip');
    const webview = document.getElementById('webview');

    if (omniboxInput) omniboxInput.value = url;
    if (protocolText) protocolText.textContent = url.startsWith('https') ? "https://" : "http://";
    if (protocolChip) protocolChip.style.color = "#22c55e";

    showWebview();
    showLoading();
    if (webview) webview.src = url;
}

function updateNavButtons() {
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');
    const webview = document.getElementById('webview');
    try {
        if (btnBack) btnBack.disabled = !webview.canGoBack();
        if (btnForward) btnForward.disabled = !webview.canGoForward();
    } catch {
        if (btnBack) btnBack.disabled = true;
        if (btnForward) btnForward.disabled = true;
    }
}

async function checkServerStatus() {
    const serverStatusPill = document.getElementById('server-status-pill');
    const statusText = document.getElementById('status-text');
    if (!serverStatusPill || !statusText) return;

    try {
        const res = await fetch(`${GLOBAL_SERVER_URL}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status === "online") {
            serverStatusPill.className = "status-pill";
            statusText.textContent = `${data.entries || Object.keys(REGISTRY).length} Sites Online`;
            serverStatusPill.title = `Connected to Global Server: ${data.server || GLOBAL_SERVER_URL}`;
            return;
        }
        throw new Error("Server not online");
    } catch (err) {
        console.warn("Server check failed:", err.message);
        serverStatusPill.className = "status-pill offline";
        statusText.textContent = "Server Offline";
        serverStatusPill.title = `Cannot reach server: ${err.message}`;
    }
}
