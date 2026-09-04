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
    if (webviewContainer) webviewContainer.classList.add('visible');
    if (errorOverlay) errorOverlay.style.display = 'none';
}

function hideWebview() {
    const searchView = document.getElementById('search-view');
    const webviewContainer = document.getElementById('webview-container');
    const errorOverlay = document.getElementById('error-overlay');
    if (searchView) searchView.style.display = 'flex';
    if (webviewContainer) webviewContainer.classList.remove('visible');
    if (errorOverlay) errorOverlay.style.display = 'none';
    updateNavButtons();
}

function loadNeoDomain(domain) {
    domain = domain.trim().toLowerCase().replace('fetch://', '').replace(/\/$/, '');
    currentLoadedDomain = domain;
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');
    const protocolChip = document.getElementById('protocol-chip');

    if (omniboxInput) omniboxInput.value = `${domain}/`;
    if (protocolText) protocolText.textContent = "fetch://";
    if (protocolChip) protocolChip.style.color = "#38bdf8";

    if (typeof navigateTab === 'function' && typeof getActiveTab === 'function') {
        const curTab = getActiveTab();
        if (curTab) {
            navigateTab(curTab, domain);
            return;
        }
    }

    const baseUrl = (GLOBAL_SERVER_URL || "").replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/site/${domain}/`;
    console.log(`[NAV] Loading .neo site [${domain}] -> ${targetUrl}`);

    showWebview();
    showLoading();
}

function loadWebUrl(url) {
    currentLoadedDomain = null;
    const omniboxInput = document.getElementById('omnibox-input');
    const protocolText = document.getElementById('protocol-text');
    const protocolChip = document.getElementById('protocol-chip');

    if (omniboxInput) omniboxInput.value = url;
    if (protocolText) protocolText.textContent = url.startsWith('https') ? "https://" : "http://";
    if (protocolChip) protocolChip.style.color = "#22c55e";

    showWebview();
    showLoading();

    if (typeof getActiveTab === 'function') {
        const tab = getActiveTab();
        if (tab && tab.webview) {
            tab.domain = url;
            tab.title = url;
            tab.webview.src = url;
            tab.webview.style.display = 'flex';
        }
    }
}

function updateNavButtons() {
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');
    let wv = null;
    if (typeof getActiveTab === 'function') {
        const tab = getActiveTab();
        if (tab && tab.webview) wv = tab.webview;
    }
    if (!wv) wv = document.getElementById('webview');

    try {
        if (btnBack) btnBack.disabled = !wv || !wv.canGoBack();
        if (btnForward) btnForward.disabled = !wv || !wv.canGoForward();
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
        const baseUrl = (GLOBAL_SERVER_URL || "").replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status === "online") {
            serverStatusPill.className = "status-pill";
            statusText.textContent = `${data.entries || Object.keys(REGISTRY).length} Sites Online`;
            serverStatusPill.title = `Connected to Global Server: ${data.server || GLOBAL_SERVER_URL}`;
            
            // Auto-update registry if server version changed
            if (data.version && data.version !== REGISTRY_VERSION) {
                console.log(`[SYNC] New server registry version detected [${data.version}], syncing dynamically...`);
                syncRegistryFromServer();
            }
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
